import { NextFunction, Request, Response, Router } from 'express';
import { body, param, query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleValidation } from '../middleware/errorHandler';
import { computeDueDate } from '../utils/dueDate';
import { Role } from '../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  [
    query('status').optional().isIn(['requested', 'assigned', 'accepted', 'returned', 'declined']),
    query('mine').optional().isBoolean(),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let sql = `
        SELECT r.*, f.file_name, f.file_number AS file_number_label,
               ru.name AS requester_name, au.name AS assigned_to_name
        FROM requests r
        JOIN registry_files f ON f.id = r.file_id
        LEFT JOIN users ru ON ru.id = r.requester_id
        LEFT JOIN users au ON au.id = r.assigned_to_id
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

// Staff member requests a file for themselves.
router.post(
  '/',
  requireAuth,
  [body('fileId').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query<any>(
        `INSERT INTO requests (file_id, requester_id, status, requested_date)
         VALUES (?, ?, 'requested', NOW())`,
        [req.body.fileId, req.user!.sub]
      );
      const requestId = result.insertId;
      await conn.query(
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id, notes)
         VALUES (?, ?, 'requested', ?, ?, NULL)`,
        [requestId, req.body.fileId, req.user!.sub, req.user!.sub]
      );
      await conn.commit();
      res.status(201).json({ success: true, requestId });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

// Admin assigns a file directly to a user (or special account).
router.post(
  '/assign',
  requireAuth,
  requireRole('admin'),
  [body('fileId').isInt({ min: 1 }), body('assignedToId').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { fileId, assignedToId } = req.body;

      const [userRows] = await conn.query<any[]>('SELECT role FROM users WHERE id = ?', [assignedToId]);
      if (userRows.length === 0) return res.status(404).json({ error: 'Assignee not found' });
      const role = userRows[0].role as Role;
      const dueDate = computeDueDate(role, new Date());

      await conn.beginTransaction();
      const [result] = await conn.query<any>(
        `INSERT INTO requests (file_id, assigned_to_id, status, assigned_date, due_date)
         VALUES (?, ?, 'assigned', NOW(), ?)`,
        [fileId, assignedToId, dueDate]
      );
      const requestId = result.insertId;
      await conn.query(
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id, notes)
         VALUES (?, ?, 'assigned', ?, ?, NULL)`,
        [requestId, fileId, req.user!.sub, assignedToId]
      );
      await conn.commit();
      res.status(201).json({ success: true, requestId, dueDate });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

// Recipient accepts an assigned file — due date is (re)computed from acceptance.
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
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id, notes)
         VALUES (?, ?, 'accepted', ?, ?, NULL)`,
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

// File returned to the registry.
router.post(
  '/:id/return',
  requireAuth,
  [param('id').isInt({ min: 1 }), body('notes').optional().trim().isLength({ max: 2000 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const requestId = Number(req.params.id);
      const [rows] = await conn.query<any[]>('SELECT * FROM requests WHERE id = ?', [requestId]);
      const request = rows[0];
      if (!request) return res.status(404).json({ error: 'Request not found' });

      await conn.beginTransaction();
      await conn.query(`UPDATE requests SET status = 'returned', returned_date = NOW() WHERE id = ?`, [requestId]);
      await conn.query(
        `INSERT INTO movements (request_id, file_id, action, actor_user_id, subject_user_id, notes)
         VALUES (?, ?, 'returned', ?, ?, ?)`,
        [requestId, request.file_id, req.user!.sub, request.assigned_to_id, req.body.notes || null]
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
