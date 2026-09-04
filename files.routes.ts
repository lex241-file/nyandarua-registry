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
        sql += ' AND (f.file_name LIKE ? OR f.file_number LIKE ? OR f.file_id LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like);
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

router.delete(
  '/:fileId',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [result] = await pool.query<any>(
        "DELETE FROM registry_files WHERE file_id = ? AND category IN ('custom','confidential')",
        [req.params.fileId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Custom/confidential file not found (only those can be removed)' });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
