import { NextFunction, Request, Response, Router } from 'express';
import { body, query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleValidation } from '../middleware/errorHandler';

const router = Router();

const SUB_CATEGORIES = [
  'personal', 'interns', 'retired', 'deceased', 'transferred',
  'dismissed', 'end_contract', 'resigned', 'gov_appointee', 'olkalau',
];

router.get(
  '/',
  requireAuth,
  [
    query('search').optional().trim().isLength({ max: 255 }),
    query('category').optional().isIn(['general', 'personal', 'custom', 'confidential']),
    query('subCategory').optional().isIn(SUB_CATEGORIES),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = (req.query.search as string) || '';
      const category = req.query.category as string | undefined;
      const subCategory = req.query.subCategory as string | undefined;

      // "Unavailable" mirrors the original app: a file currently out
      // (pending_accept or accepted on any request) can't be requested
      // again until it's returned.
      let sql = `
        SELECT f.*,
          EXISTS(
            SELECT 1 FROM requests r
            WHERE r.file_id = f.id AND r.status IN ('pending_accept','accepted')
          ) AS is_unavailable
        FROM registry_files f
        LEFT JOIN users owner ON owner.id = f.owner_user_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (category) {
        sql += ' AND f.category = ?';
        params.push(category);
      }
      if (subCategory) {
        if (subCategory === 'personal') {
          sql += " AND (f.sub_category IS NULL OR f.sub_category = 'personal')";
        } else {
          sql += ' AND f.sub_category = ?';
          params.push(subCategory);
        }
      }
      if (search) {
        // Matches file name, file number, or — for personal files — the
        // owning staff member's designation (e.g. searching "Medical
        // officer" finds every personal file belonging to someone with
        // that designation).
        sql += ' AND (f.file_name LIKE ? OR f.file_number LIKE ? OR f.file_id LIKE ? OR owner.designation LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like, like);
      }
      sql += ' ORDER BY f.file_name ASC LIMIT 1000';

      const [rows] = await pool.query(sql, params);
      res.json({ files: rows });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('fileName').trim().notEmpty().isLength({ max: 255 }),
    body('fileNumber').trim().notEmpty().isLength({ max: 64 }),
    body('category').optional().isIn(['general', 'personal', 'custom', 'confidential']),
    body('subCategory').optional().isIn(SUB_CATEGORIES),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileName, fileNumber, category = 'custom', subCategory = null } = req.body;
      const prefix = category === 'personal' ? 'PERS_' : category === 'confidential' ? 'CONF_' : 'CF_';
      const fileId = `${prefix}${fileNumber}`;

      await pool.query(
        `INSERT INTO registry_files (file_id, file_name, file_number, category, sub_category)
         VALUES (?, ?, ?, ?, ?)`,
        [fileId, fileName, fileNumber, category, subCategory]
      );
      res.status(201).json({ success: true, fileId });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A file with that number already exists' });
      }
      next(err);
    }
  }
);

// Removes a file entry entirely. Any category can be removed now (not
// just custom/confidential) — but the database itself still protects
// against deleting a file that has ever been part of a request/movement
// (fk_req_file is ON DELETE RESTRICT), so this will cleanly fail with a
// clear message for any file with real history, rather than silently
// destroying that history.
router.delete(
  '/:fileId',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [result] = await pool.query<any>(
        'DELETE FROM registry_files WHERE file_id = ?',
        [req.params.fileId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.errno === 1451) {
        return res.status(409).json({
          error: 'This file has request/movement history and cannot be deleted. Only files with no history can be removed.',
        });
      }
      next(err);
    }
  }
);

export default router;
