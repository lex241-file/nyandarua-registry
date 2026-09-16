import { NextFunction, Request, Response, Router } from 'express';
import { query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { handleValidation } from '../middleware/errorHandler';

const router = Router();

// This router deliberately exposes GET only. There is no PATCH/PUT/DELETE
// here, and the underlying `movements` table also rejects UPDATE/DELETE
// at the database level (see sql/01_schema.sql triggers) and the app's
// DB user has no UPDATE/DELETE grant on it (see sql/03_app_user.sql).
// The audit trail is immutable through every layer, including for admins.
// Each row here represents one COMPLETED file cycle (requested through
// returned), not a raw audit-log entry — a file that's been assigned
// and returned shows up exactly once here, when it reaches 'returned'.
// This is a display simplification only: the underlying `movements`
// table still records every individual state change immutably, in
// full, regardless of what this page shows. It's never queried below
// on purpose — the summary comes straight from the `requests` row
// itself, which already carries the full completed-cycle detail.
router.get(
  '/',
  requireAuth,
  [
    query('fileId').optional().isInt({ min: 1 }),
    query('userId').optional().isInt({ min: 1 }),
    query('search').optional().trim().isLength({ max: 255 }),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let sql = `
        SELECT r.id, r.file_id, f.file_name, f.file_number AS file_number_label,
               r.registry_code,
               r.requester_id, ru.name AS requester_name,
               r.assigned_to_id, au.name AS assigned_to_name,
               r.requested_date, r.assigned_date, r.accepted_date, r.returned_date,
               r.action_folio, r.last_folio, r.reason, r.file_status, r.proceed_to_dest, r.bring_up_note,
               r.returned_by_id, rb.name AS returned_by_name
        FROM requests r
        JOIN registry_files f ON f.id = r.file_id
        LEFT JOIN users ru ON ru.id = r.requester_id
        LEFT JOIN users au ON au.id = r.assigned_to_id
        LEFT JOIN users rb ON rb.id = r.returned_by_id
        WHERE r.status = 'returned'
      `;
      const params: any[] = [];

      if (req.query.fileId) {
        sql += ' AND r.file_id = ?';
        params.push(req.query.fileId);
      }
      if (req.query.userId) {
        sql += ' AND (r.requester_id = ? OR r.assigned_to_id = ? OR r.returned_by_id = ?)';
        params.push(req.query.userId, req.query.userId, req.query.userId);
      }
      if (req.query.search) {
        sql += ' AND (f.file_name LIKE ? OR f.file_number LIKE ?)';
        const like = `%${req.query.search}%`;
        params.push(like, like);
      }
      sql += ' ORDER BY r.returned_date DESC LIMIT 500';

      const [rows] = await pool.query(sql, params);
      res.json({ movements: rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
