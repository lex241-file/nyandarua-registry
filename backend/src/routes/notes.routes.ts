import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { body, param, query } from 'express-validator';
import { pool } from '../config/db';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleValidation, HttpError } from '../middleware/errorHandler';

const router = Router();

// Files are kept in memory only long enough to write them into the
// database as a BLOB - nothing is ever written to local disk, which
// matters on Render/most PaaS hosts since local disk isn't persisted
// across deploys/restarts anyway.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

router.post(
  '/',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.array('files', 5)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Each attachment must be 10 MB or smaller.' });
        }
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'You can attach at most 5 files per note.' });
        }
        return next(err);
      }
      next();
    });
  },
  [
    body('noteText').trim().notEmpty().withMessage('Please write a note').isLength({ max: 5000 }),
    body('relatedFileId').optional().isInt({ min: 1 }),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    const conn = await pool.getConnection();
    try {
      const { noteText, relatedFileId } = req.body;
      const files = (req.files as Express.Multer.File[]) || [];

      await conn.beginTransaction();
      const [result] = await conn.query<any>(
        'INSERT INTO notes (sender_id, related_file_id, note_text) VALUES (?, ?, ?)',
        [req.user!.sub, relatedFileId || null, noteText]
      );
      const noteId = result.insertId;

      for (const file of files) {
        await conn.query(
          'INSERT INTO note_attachments (note_id, file_name, mime_type, file_size, file_data) VALUES (?, ?, ?, ?, ?)',
          [noteId, file.originalname, file.mimetype, file.size, file.buffer]
        );
      }

      await conn.commit();
      res.status(201).json({ success: true, noteId, attachmentCount: files.length });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  }
);

router.get(
  '/',
  requireAuth,
  [query('unreadOnly').optional().isBoolean()],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let sql = `
        SELECT n.*, s.name AS sender_name, s.file_number AS sender_file_number,
               f.file_name AS related_file_name, f.file_number AS related_file_number,
               (SELECT COUNT(*) FROM note_attachments a WHERE a.note_id = n.id) AS attachment_count
        FROM notes n
        JOIN users s ON s.id = n.sender_id
        LEFT JOIN registry_files f ON f.id = n.related_file_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (req.user!.role !== 'admin') {
        sql += ' AND n.sender_id = ?';
        params.push(req.user!.sub);
      }
      if (req.query.unreadOnly === 'true') {
        sql += ' AND n.is_read = 0';
      }
      sql += ' ORDER BY n.created_at DESC LIMIT 300';

      const [rows] = await pool.query(sql, params);
      res.json({ notes: rows });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/attachments',
  requireAuth,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noteId = Number(req.params.id);
      const [noteRows] = await pool.query<any[]>('SELECT sender_id FROM notes WHERE id = ?', [noteId]);
      if (noteRows.length === 0) return res.status(404).json({ error: 'Note not found' });
      if (req.user!.role !== 'admin' && noteRows[0].sender_id !== req.user!.sub) {
        return res.status(403).json({ error: 'Not your note' });
      }
      const [rows] = await pool.query(
        'SELECT id, note_id, file_name, mime_type, file_size, created_at FROM note_attachments WHERE note_id = ?',
        [noteId]
      );
      res.json({ attachments: rows });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/attachments/:attachmentId/download',
  requireAuth,
  [param('id').isInt({ min: 1 }), param('attachmentId').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noteId = Number(req.params.id);
      const attachmentId = Number(req.params.attachmentId);

      const [noteRows] = await pool.query<any[]>('SELECT sender_id FROM notes WHERE id = ?', [noteId]);
      if (noteRows.length === 0) return res.status(404).json({ error: 'Note not found' });
      if (req.user!.role !== 'admin' && noteRows[0].sender_id !== req.user!.sub) {
        return res.status(403).json({ error: 'Not your note' });
      }

      const [rows] = await pool.query<any[]>(
        'SELECT file_name, mime_type, file_data FROM note_attachments WHERE id = ? AND note_id = ?',
        [attachmentId, noteId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });

      const attachment = rows[0];
      res.setHeader('Content-Type', attachment.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.file_name)}"`);
      res.send(attachment.file_data);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/mark-read',
  requireAuth,
  requireRole('admin'),
  [param('id').isInt({ min: 1 })],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [result] = await pool.query<any>(
        'UPDATE notes SET is_read = 1, read_at = NOW() WHERE id = ?',
        [req.params.id]
      );
      if (result.affectedRows === 0) throw new HttpError(404, 'Note not found');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
