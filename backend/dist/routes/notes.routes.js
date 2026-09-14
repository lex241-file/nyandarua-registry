"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Files are kept in memory only long enough to write them into the
// database as a BLOB - nothing is ever written to local disk, which
// matters on Render/most PaaS hosts since local disk isn't persisted
// across deploys/restarts anyway.
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 5,
    },
});
router.post('/', auth_1.requireAuth, (req, res, next) => {
    upload.array('files', 5)(req, res, (err) => {
        if (err) {
            if (err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Each attachment must be 10 MB or smaller.' });
            }
            if (err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ error: 'You can attach at most 5 files per note.' });
            }
            return next(err);
        }
        next();
    });
}, [
    (0, express_validator_1.body)('noteText').trim().notEmpty().withMessage('Please write a note').isLength({ max: 5000 }),
    (0, express_validator_1.body)('relatedFileId').optional().isInt({ min: 1 }),
], errorHandler_1.handleValidation, async (req, res, next) => {
    const conn = await db_1.pool.getConnection();
    try {
        const { noteText, relatedFileId } = req.body;
        const files = req.files || [];
        await conn.beginTransaction();
        const [result] = await conn.query('INSERT INTO notes (sender_id, related_file_id, note_text) VALUES (?, ?, ?)', [req.user.sub, relatedFileId || null, noteText]);
        const noteId = result.insertId;
        for (const file of files) {
            await conn.query('INSERT INTO note_attachments (note_id, file_name, mime_type, file_size, file_data) VALUES (?, ?, ?, ?, ?)', [noteId, file.originalname, file.mimetype, file.size, file.buffer]);
        }
        await conn.commit();
        res.status(201).json({ success: true, noteId, attachmentCount: files.length });
    }
    catch (err) {
        await conn.rollback();
        next(err);
    }
    finally {
        conn.release();
    }
});
router.get('/', auth_1.requireAuth, [(0, express_validator_1.query)('unreadOnly').optional().isBoolean()], errorHandler_1.handleValidation, async (req, res, next) => {
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
        const params = [];
        if (req.user.role !== 'admin') {
            sql += ' AND n.sender_id = ?';
            params.push(req.user.sub);
        }
        if (req.query.unreadOnly === 'true') {
            sql += ' AND n.is_read = 0';
        }
        sql += ' ORDER BY n.created_at DESC LIMIT 300';
        const [rows] = await db_1.pool.query(sql, params);
        res.json({ notes: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/attachments', auth_1.requireAuth, [(0, express_validator_1.param)('id').isInt({ min: 1 })], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const noteId = Number(req.params.id);
        const [noteRows] = await db_1.pool.query('SELECT sender_id FROM notes WHERE id = ?', [noteId]);
        if (noteRows.length === 0)
            return res.status(404).json({ error: 'Note not found' });
        if (req.user.role !== 'admin' && noteRows[0].sender_id !== req.user.sub) {
            return res.status(403).json({ error: 'Not your note' });
        }
        const [rows] = await db_1.pool.query('SELECT id, note_id, file_name, mime_type, file_size, created_at FROM note_attachments WHERE note_id = ?', [noteId]);
        res.json({ attachments: rows });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/attachments/:attachmentId/download', auth_1.requireAuth, [(0, express_validator_1.param)('id').isInt({ min: 1 }), (0, express_validator_1.param)('attachmentId').isInt({ min: 1 })], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const noteId = Number(req.params.id);
        const attachmentId = Number(req.params.attachmentId);
        const [noteRows] = await db_1.pool.query('SELECT sender_id FROM notes WHERE id = ?', [noteId]);
        if (noteRows.length === 0)
            return res.status(404).json({ error: 'Note not found' });
        if (req.user.role !== 'admin' && noteRows[0].sender_id !== req.user.sub) {
            return res.status(403).json({ error: 'Not your note' });
        }
        const [rows] = await db_1.pool.query('SELECT file_name, mime_type, file_data FROM note_attachments WHERE id = ? AND note_id = ?', [attachmentId, noteId]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Attachment not found' });
        const attachment = rows[0];
        res.setHeader('Content-Type', attachment.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.file_name)}"`);
        res.send(attachment.file_data);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/mark-read', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [(0, express_validator_1.param)('id').isInt({ min: 1 })], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const [result] = await db_1.pool.query('UPDATE notes SET is_read = 1, read_at = NOW() WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0)
            throw new errorHandler_1.HttpError(404, 'Note not found');
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
