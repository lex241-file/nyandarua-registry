import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleValidation } from '../middleware/errorHandler';
import { UserRow, SafeUser } from '../types';

const router = Router();

function toSafeUser(u: UserRow): SafeUser {
  const { password_hash, ...safe } = u;
  return safe;
}

// List / search users. Any authenticated user can view the directory;
// only admins get to see everything including inactive accounts.
router.get(
  '/',
  requireAuth,
  [query('search').optional().trim().isLength({ max: 255 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = (req.query.search as string) || '';
      const includeInactive = req.user!.role === 'admin' && req.query.includeInactive === 'true';

      let sql = 'SELECT * FROM users WHERE 1=1';
      const params: any[] = [];

      if (!includeInactive) {
        sql += ' AND is_active = 1';
      }
      if (search) {
        sql += ' AND (name LIKE ? OR file_number LIKE ? OR designation LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      sql += ' ORDER BY name ASC LIMIT 500';

      const [rows] = await pool.query<any[]>(sql, params);
      res.json({ users: (rows as UserRow[]).map(toSafeUser) });
    } catch (err) {
      next(err);
    }
  }
);

// Create a new user account (admin only). Default password = ID number,
// falling back to file number if no ID is on record — matching the
// original system's convention — but it's stored as a bcrypt hash and
// the account is flagged must_change_password.
const SUB_CATEGORIES = [
  'personal', 'interns', 'retired', 'deceased', 'transferred',
  'dismissed', 'end_contract', 'resigned', 'gov_appointee', 'olkalau',
];

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('fileNumber').trim().notEmpty().isLength({ max: 64 }),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('designation').optional().trim().isLength({ max: 255 }),
    body('idNumber').optional({ nullable: true }).trim().isLength({ max: 64 }),
    body('role').optional().isIn(['admin', 'user', 'special']),
    body('fileCategory').optional().isIn(SUB_CATEGORIES),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        fileNumber, name, designation = '', idNumber = null,
        role = 'user', fileCategory = 'personal',
      } = req.body;
      const defaultPassword = idNumber || fileNumber;
      const passwordHash = await bcrypt.hash(String(defaultPassword), 12);

      await pool.query(
        `INSERT INTO users (file_number, name, designation, id_number, role, file_category, password_hash, must_change_password, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [fileNumber, name, designation, idNumber, role, fileCategory, passwordHash]
      );
      res.status(201).json({ success: true });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A user with that file number already exists' });
      }
      next(err);
    }
  }
);

// Bulk edit (designation / role / fileCategory) — admin only.
router.patch(
  '/bulk',
  requireAuth,
  requireRole('admin'),
  [
    body('fileNumbers').isArray({ min: 1 }),
    body('fileNumbers.*').isString().trim().notEmpty(),
    body('designation').optional().trim().isLength({ max: 255 }),
    body('role').optional().isIn(['admin', 'user', 'special']),
    body('fileCategory').optional().isIn(SUB_CATEGORIES),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileNumbers, designation, role, fileCategory } = req.body as {
        fileNumbers: string[];
        designation?: string;
        role?: string;
        fileCategory?: string;
      };
      if (!designation && !role && !fileCategory) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      const sets: string[] = [];
      const params: any[] = [];
      if (designation) { sets.push('designation = ?'); params.push(designation); }
      if (role) { sets.push('role = ?'); params.push(role); }
      if (fileCategory) { sets.push('file_category = ?'); params.push(fileCategory); }

      const placeholders = fileNumbers.map(() => '?').join(',');
      const sql = `UPDATE users SET ${sets.join(', ')} WHERE file_number IN (${placeholders})`;
      const [result] = await pool.query<any>(sql, [...params, ...fileNumbers]);

      res.json({ success: true, updated: result.affectedRows });
    } catch (err) {
      next(err);
    }
  }
);

// Bulk deactivate — admin only. Same soft-delete semantics as the
// single-user deactivate route, just applied to several accounts at once.
router.post(
  '/bulk-deactivate',
  requireAuth,
  requireRole('admin'),
  [
    body('fileNumbers').isArray({ min: 1 }),
    body('fileNumbers.*').isString().trim().notEmpty(),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileNumbers } = req.body as { fileNumbers: string[] };
      const placeholders = fileNumbers.map(() => '?').join(',');
      const [result] = await pool.query<any>(
        `UPDATE users SET is_active = 0 WHERE file_number IN (${placeholders})`,
        fileNumbers
      );
      res.json({ success: true, deactivated: result.affectedRows });
    } catch (err) {
      next(err);
    }
  }
);

// Deactivate login (admin only). This is a soft delete — personnel file
// record and all history are preserved, matching the original system.
router.post(
  '/:fileNumber/deactivate',
  requireAuth,
  requireRole('admin'),
  [param('fileNumber').trim().notEmpty()],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [result] = await pool.query<any>(
        'UPDATE users SET is_active = 0 WHERE file_number = ?',
        [req.params.fileNumber]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:fileNumber/reactivate',
  requireAuth,
  requireRole('admin'),
  [param('fileNumber').trim().notEmpty()],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [result] = await pool.query<any>(
        'UPDATE users SET is_active = 1 WHERE file_number = ?',
        [req.params.fileNumber]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// NOTE: intentionally no DELETE route for users. Accounts are only ever
// deactivated/reactivated so that personnel history stays intact.

export default router;
