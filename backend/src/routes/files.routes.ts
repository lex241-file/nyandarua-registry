import { NextFunction, Request, Response, Router } from 'express';
import { body, query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleValidation } from '../middleware/errorHandler';

const router = Router();

router.get(
  '/',
  requireAuth,
  [
    query('search').optional().trim().isLength({ max: 255 }),
    query('category').optional().isIn(['general', 'personal', 'custom']),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = (req.query.search as string) || '';
      const category = req.query.category as string | undefined;

      let sql = 'SELECT * FROM registry_files WHERE 1=1';
      const params: any[] = [];

      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (search) {
        sql += ' AND (file_name LIKE ? OR file_number LIKE ? OR file_id LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      sql += ' ORDER BY file_name ASC LIMIT 1000';

      const [rows] = await pool.query(sql, params);
      res.json({ files: rows });
    } catch (err) {
      next(err);
    }
  }
);

// Add a custom file to the registry (admin only).
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('fileName').trim().notEmpty().isLength({ max: 255 }),
    body('fileNumber').trim().notEmpty().isLength({ max: 64 }),
    body('category').optional().isIn(['general', 'personal', 'custom']),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileName, fileNumber, category = 'custom' } = req.body;
      const prefix = category === 'personal' ? 'PERS_' : 'CF_';
      const fileId = `${prefix}${fileNumber}`;

      await pool.query(
        `INSERT INTO registry_files (file_id, file_name, file_number, category)
         VALUES (?, ?, ?, ?)`,
        [fileId, fileName, fileNumber, category]
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

// Remove a custom file entry (admin only). This never touches user records.
router.delete(
  '/:fileId',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [result] = await pool.query<any>(
        "DELETE FROM registry_files WHERE file_id = ? AND category = 'custom'",
        [req.params.fileId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Custom file not found (only custom files can be removed)' });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
