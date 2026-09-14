"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// This router deliberately exposes GET only. There is no PATCH/PUT/DELETE
// here, and the underlying `movements` table also rejects UPDATE/DELETE
// at the database level (see sql/01_schema.sql triggers) and the app's
// DB user has no UPDATE/DELETE grant on it (see sql/03_app_user.sql).
// The audit trail is immutable through every layer, including for admins.
router.get('/', auth_1.requireAuth, [
    (0, express_validator_1.query)('fileId').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('userId').optional().isInt({ min: 1 }),
    (0, express_validator_1.query)('search').optional().trim().isLength({ max: 255 }),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        let sql = `
        SELECT m.*, f.file_name, f.file_number AS file_number_label,
               actor.name AS actor_name, subject.name AS subject_name,
               r.assigned_date AS request_assigned_date,
               r.returned_date AS request_returned_date
        FROM movements m
        JOIN registry_files f ON f.id = m.file_id
        LEFT JOIN users actor ON actor.id = m.actor_user_id
        LEFT JOIN users subject ON subject.id = m.subject_user_id
        LEFT JOIN requests r ON r.id = m.request_id
        WHERE 1=1
      `;
        const params = [];
        if (req.query.fileId) {
            sql += ' AND m.file_id = ?';
            params.push(req.query.fileId);
        }
        if (req.query.userId) {
            sql += ' AND (m.actor_user_id = ? OR m.subject_user_id = ?)';
            params.push(req.query.userId, req.query.userId);
        }
        if (req.query.search) {
            sql += ' AND (f.file_name LIKE ? OR f.file_number LIKE ?)';
            const like = `%${req.query.search}%`;
            params.push(like, like);
        }
        sql += ' ORDER BY m.created_at DESC LIMIT 1000';
        const [rows] = await db_1.pool.query(sql, params);
        res.json({ movements: rows });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
