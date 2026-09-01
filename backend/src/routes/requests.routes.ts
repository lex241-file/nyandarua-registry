import { NextFunction, Request, Response, Router } from 'express';
import { body, param, query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleValidation } from '../middleware/errorHandler';
import { computeDueDate } from '../utils/dueDate';
import { Role } from '../types';

const router = Router();

const AUTO_REJECT_HOURS = 12;

/**
 * Lazily expires any 'pending_accept' request older than 12 hours to
 * 'rejected_auto' — special-role recipients are exempt (mirrors the
 * original app's rule that special users don't auto-reject). Called at
 * the top of every GET so status is always current without needing a
 * separate cron/scheduler (which wouldn't run reliably on a free-tier
 * host that spins down when idle anyway).
 */
async function expireStaleAssignments(): Promise<void> {
  await pool.query(
    `UPDATE requests r
     JOIN users u ON u.id = r.assigned_to_id
     SET r.status = 'rejected_auto'
     WHERE r.status = 'pending_accept'
       AND u.role != 'special'
       AND r.assigned_date IS NOT NULL
       AND r.assigned_date < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [AUTO_REJECT_HOURS]
  );
}

async function isFileUnavailable(fileId: number): Promise<boolean> {
  const [rows] = await pool.query<any[]>(
    `SELECT 1 FROM requests
     WHERE file_id = ? AND status IN ('pending_accept','accepted')
     LIMIT 1`,
    [fileId]
  );
  return rows.length > 0;
}

router.get(
  '/',
  requireAuth,
  [
    query('status').optional().isIn(['pending', 'pending_accept', 'accepted', 'returned', 'rejected_auto']),
    query('mine').optional().isBoolean(),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await expireStaleAssignments();

      let sql = `
        SELECT r.*, f.file_name, f.file_number AS file_number_label,
               ru.name AS requester_name, au.name AS assigned_to_name,
               rb.name AS returned_by_name
        FROM requests r
        JOIN registry_files f ON f.id = r.file_id
        LEFT JOIN users ru ON ru.id = r.requester_id
        LEFT JOIN users au ON au.id = r.assigned_to_id
        LEFT JOIN users rb ON rb.id = r.returned_by_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (req.query.status) {
        sql += ' AND r.status = ?';
        params.push(req.query.status);
      }
      if (req.query.mine === 'true') {
        sql += ' AND (r.requester_id = ? OR r.assigned_to_id = ?)';
        params.push(req.user!.sub, req.user!.sub);
      }
      sql += ' ORDER BY r.created_at DESC LIMIT 500';

      const [rows] = await pool.query(sql, params);
      res.json({ requests: rows });
    } catch (err) {
      next(err);
    }
  }
);

// Staff member requests one or more files for themselves (batch request —
// each file becomes its own request row, but they're submitted together).
// Also accepts ad-hoc confidentialFiles (file number + name typed in by
// the requester, not pre-registered) — a matching registry_files row is
// created on the fly (category='confidential') if one doesn't exist yet,
// mirroring the original app's "type it in and request it" flow.
router.post(
  '/',
  requireAuth,
  [
    body('fileIds').optional().isArray(),
    body('fileIds.*').optional().isInt({ min: 1 }),
    body('confidentialFiles').optional().isArray(),
    body('confidentialFiles.*.fileNumber').optional().trim().isLength({ min: 1, max: 64 }),
    body('confidentialFiles.*.fileName').optional().trim().isLength({ min: 1, max: 255 }),
    body().custom((v) => (v.fileIds?.length || 0) + (v.confidentialFiles?.length || 0) > 0)
      .withMessage('Provide at least one fileId or confidential file entry'),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const fileIds: number[] = req.body.fileIds || [];
      const confidentialFiles: { fileNumber: string; fileName: string }[] = req.body.confidentialFiles || [];
      const created: number[] = [];
      const skipped: number[] = [];

      await conn.beginTransaction();

      // Resolve ad-hoc confidential entries to real file IDs first (find-or-create).
      for (const cf of confidentialFiles) {
        const fileId = `CONF_${cf.fileNumber}`;
        await conn.query(
          `INSERT INTO registry_files (file_id, file_name, file_number, category)
           VALUES (?, ?, ?, 'confidential')
           ON DUPLICATE KEY UPDATE file_name = VALUES(file_name)`,
          [fileId, cf.fileName, cf.fileNumber]
        );
        const [rows] = await conn.query<any[]>('SELECT id FROM registry_files WHERE file_id = ?', [fileId]);
        fileIds.push(rows[0].id);
      }

      for (const fileId of fileIds) {
        if (await isFileUnavailable(fileId)) {
          skipped.push(fileId);
          continue;
        }
        const [result] = await conn.query<any>(
          `INSERT INTO requests (file_id, requester_id, status, requested_date)
           VALUES (?, ?, 'pending', NOW())`,
          [fileId, req.user!.sub]
        );
        const requestId = result.insertId;
        await conn.query(
          `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id)
           VALUES (?, ?, 'requested', ?, ?)`,
          [requestId, fileId, req.user!.sub, req.user!.sub]
        );
        created.push(requestId);
      }
      await conn.commit();
      res.status(201).json({ success: true, created, skipped });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

// "Request Again" — for a file that's overdue but still accepted by the
// same person. Mirrors the original exactly: the old (overdue) request
// is left untouched, and a fresh 'pending' request is created for the
// same file, intentionally bypassing the normal unavailability check
// (which would otherwise block it, since the file is still technically
// out under the existing request).
router.post(
  '/:id/request-again',
  requireAuth,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const requestId = Number(req.params.id);
      const [rows] = await conn.query<any[]>('SELECT * FROM requests WHERE id = ?', [requestId]);
      const request = rows[0];
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.assigned_to_id !== req.user!.sub && request.requester_id !== req.user!.sub) {
        return res.status(403).json({ error: 'This is not your file to re-request' });
      }
      if (request.status !== 'accepted') {
        return res.status(400).json({ error: 'Only an accepted file can be re-requested' });
      }
      if (!request.due_date || new Date(request.due_date) > new Date()) {
        return res.status(400).json({ error: 'This file is not yet overdue' });
      }

      await conn.beginTransaction();
      const [result] = await conn.query<any>(
        `INSERT INTO requests (file_id, requester_id, status, requested_date)
         VALUES (?, ?, 'pending', NOW())`,
        [request.file_id, req.user!.sub]
      );
      const newRequestId = result.insertId;
      await conn.query(
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id)
         VALUES (?, ?, 'requested', ?, ?)`,
        [newRequestId, request.file_id, req.user!.sub, req.user!.sub]
      );
      await conn.commit();
      res.status(201).json({ success: true, requestId: newRequestId });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

// Admin approves a pending request OR assigns a file directly — either
// way the file moves to 'pending_accept', awaiting the recipient.
router.post(
  '/assign',
  requireAuth,
  requireRole('admin'),
  [
    body('fileId').isInt({ min: 1 }),
    body('assignedToId').isInt({ min: 1 }),
    body('requestId').optional().isInt({ min: 1 }),
    body('registryCode').optional().trim().isLength({ max: 100 }),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { fileId, assignedToId, requestId, registryCode } = req.body;

      const [userRows] = await conn.query<any[]>('SELECT role FROM users WHERE id = ?', [assignedToId]);
      if (userRows.length === 0) return res.status(404).json({ error: 'Assignee not found' });
      const role = userRows[0].role as Role;
      const dueDate = computeDueDate(role, new Date());

      await conn.beginTransaction();
      let finalRequestId: number;

      if (requestId) {
        await conn.query(
          `UPDATE requests SET status = 'pending_accept', assigned_to_id = ?, assigned_date = NOW(),
             due_date = ?, registry_code = COALESCE(?, registry_code) WHERE id = ?`,
          [assignedToId, dueDate, registryCode || null, requestId]
        );
        finalRequestId = requestId;
      } else {
        const [result] = await conn.query<any>(
          `INSERT INTO requests (file_id, assigned_to_id, status, assigned_date, due_date, registry_code)
           VALUES (?, ?, 'pending_accept', NOW(), ?, ?)`,
          [fileId, assignedToId, dueDate, registryCode || null]
        );
        finalRequestId = result.insertId;
      }

      await conn.query(
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id, registry_code)
         VALUES (?, ?, 'pending_accept', ?, ?, ?)`,
        [finalRequestId, fileId, req.user!.sub, assignedToId, registryCode || null]
      );
      await conn.commit();
      res.status(201).json({ success: true, requestId: finalRequestId, dueDate });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

// Recipient accepts an assigned file.
router.post(
  '/:id/accept',
  requireAuth,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const requestId = Number(req.params.id);
      const [rows] = await conn.query<any[]>('SELECT * FROM requests WHERE id = ?', [requestId]);
      const request = rows[0];
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (request.status !== 'pending_accept') {
        return res.status(400).json({ error: `Cannot accept a request in '${request.status}' status` });
      }
      if (request.assigned_to_id !== req.user!.sub && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'This file was not assigned to you' });
      }

      const [userRows] = await conn.query<any[]>('SELECT role FROM users WHERE id = ?', [request.assigned_to_id]);
      const role = (userRows[0]?.role as Role) || 'user';
      const dueDate = computeDueDate(role, new Date());

      await conn.beginTransaction();
      await conn.query(
        `UPDATE requests SET status = 'accepted', accepted_date = NOW(), due_date = ? WHERE id = ?`,
        [dueDate, requestId]
      );
      await conn.query(
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id)
         VALUES (?, ?, 'accepted', ?, ?)`,
        [requestId, request.file_id, req.user!.sub, request.assigned_to_id]
      );
      await conn.commit();
      res.json({ success: true, dueDate });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

// File returned to the registry, with the full original tracking fields.
router.post(
  '/:id/return',
  requireAuth,
  [
    param('id').isInt({ min: 1 }),
    body('actionFolio').optional().trim().isLength({ max: 100 }),
    body('lastFolio').optional().trim().isLength({ max: 100 }),
    body('reason').optional().trim().isLength({ max: 2000 }),
    body('fileStatus').optional().isIn(['actioned', 'not_actioned', 'proceed_to']),
    body('proceedToDest').optional().isIn([
      'chief_public_service', 'cs', 'dhrm', 'ddhrm', 'hro', 'payroll', 'fleet_manager',
    ]),
    body('bringUpNote').optional().trim().isLength({ max: 2000 }),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const requestId = Number(req.params.id);
      const { actionFolio, lastFolio, reason, fileStatus, proceedToDest, bringUpNote } = req.body;

      const [rows] = await conn.query<any[]>('SELECT * FROM requests WHERE id = ?', [requestId]);
      const request = rows[0];
      if (!request) return res.status(404).json({ error: 'Request not found' });

      await conn.beginTransaction();
      await conn.query(
        `UPDATE requests SET status = 'returned', returned_date = NOW(), returned_by_id = ?,
           action_folio = ?, last_folio = ?, reason = ?, file_status = ?, proceed_to_dest = ?,
           bring_up_note = ?
         WHERE id = ?`,
        [
          req.user!.sub, actionFolio || null, lastFolio || null, reason || null,
          fileStatus || null, proceedToDest || null, bringUpNote || null, requestId,
        ]
      );
      await conn.query(
        `INSERT INTO movements
           (request_id, file_id, action, actor_user_id, subject_user_id,
            action_folio, last_folio, reason, file_status, proceed_to_dest, bring_up_note)
         VALUES (?, ?, 'returned', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId, request.file_id, req.user!.sub, request.assigned_to_id,
          actionFolio || null, lastFolio || null, reason || null,
          fileStatus || null, proceedToDest || null, bringUpNote || null,
        ]
      );
      await conn.commit();
      res.json({ success: true });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

export default router;
