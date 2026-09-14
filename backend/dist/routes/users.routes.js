"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
function toSafeUser(u) {
    const { password_hash, ...safe } = u;
    return safe;
}
// Lightweight full directory (id, file_number, name, role only — no
// designation/dates/etc) for populating Assign-to dropdowns, where every
// active account needs to be selectable, not just the first 500 matching
// a search term. Kept separate from the main GET / above so that route
// can stay paginated/search-limited without this needing the same cap.
router.get('/directory', auth_1.requireAuth, async (_req, res, next) => {
    try {
        const [rows] = await db_1.pool.query(`SELECT id, file_number, name, role FROM users WHERE is_active = 1 ORDER BY name ASC`);
        res.json({ users: rows });
    }
    catch (err) {
        next(err);
    }
});
// List / search users. Any authenticated user can view the directory;
// only admins get to see everything including inactive accounts.
router.get('/', auth_1.requireAuth, [(0, express_validator_1.query)('search').optional().trim().isLength({ max: 255 })], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const includeInactive = req.user.role === 'admin' && req.query.includeInactive === 'true';
        let sql = 'SELECT * FROM users WHERE 1=1';
        const params = [];
        if (!includeInactive) {
            sql += ' AND is_active = 1';
        }
        if (search) {
            sql += ' AND (name LIKE ? OR file_number LIKE ? OR designation LIKE ?)';
            const like = `%${search}%`;
            params.push(like, like, like);
        }
        sql += ' ORDER BY name ASC LIMIT 500';
        const [rows] = await db_1.pool.query(sql, params);
        res.json({ users: rows.map(toSafeUser) });
    }
    catch (err) {
        next(err);
    }
});
// Create a new user account (admin only). Default password = ID number,
// falling back to file number if no ID is on record — matching the
// original system's convention — but it's stored as a bcrypt hash and
// the account is flagged must_change_password.
const SUB_CATEGORIES = [
    'personal', 'interns', 'retired', 'deceased', 'transferred',
    'dismissed', 'end_contract', 'resigned', 'gov_appointee', 'olkalau',
];
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [
    (0, express_validator_1.body)('fileNumber').trim().notEmpty().isLength({ max: 64 }),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('designation').optional().trim().isLength({ max: 255 }),
    (0, express_validator_1.body)('idNumber').optional({ nullable: true }).trim().isLength({ max: 64 }),
    (0, express_validator_1.body)('role').optional().isIn(['admin', 'user', 'special']),
    (0, express_validator_1.body)('fileCategory').optional().isIn(SUB_CATEGORIES),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { fileNumber, name, designation = '', idNumber = null, role = 'user', fileCategory = 'personal', } = req.body;
        const defaultPassword = idNumber || fileNumber;
        const passwordHash = await bcryptjs_1.default.hash(String(defaultPassword), 12);
        await db_1.pool.query(`INSERT INTO users (file_number, name, designation, id_number, role, file_category, password_hash, must_change_password, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`, [fileNumber, name, designation, idNumber, role, fileCategory, passwordHash]);
        res.status(201).json({ success: true });
    }
    catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'A user with that file number already exists' });
        }
        next(err);
    }
});
// Bulk edit (designation / role / fileCategory) — admin only.
router.patch('/bulk', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [
    (0, express_validator_1.body)('fileNumbers').isArray({ min: 1 }),
    (0, express_validator_1.body)('fileNumbers.*').isString().trim().notEmpty(),
    (0, express_validator_1.body)('designation').optional().trim().isLength({ max: 255 }),
    (0, express_validator_1.body)('role').optional().isIn(['admin', 'user', 'special']),
    (0, express_validator_1.body)('fileCategory').optional().isIn(SUB_CATEGORIES),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { fileNumbers, designation, role, fileCategory } = req.body;
        if (!designation && !role && !fileCategory) {
            return res.status(400).json({ error: 'Nothing to update' });
        }
        const sets = [];
        const params = [];
        if (designation) {
            sets.push('designation = ?');
            params.push(designation);
        }
        if (role) {
            sets.push('role = ?');
            params.push(role);
        }
        if (fileCategory) {
            sets.push('file_category = ?');
            params.push(fileCategory);
        }
        const placeholders = fileNumbers.map(() => '?').join(',');
        const sql = `UPDATE users SET ${sets.join(', ')} WHERE file_number IN (${placeholders})`;
        const [result] = await db_1.pool.query(sql, [...params, ...fileNumbers]);
        res.json({ success: true, updated: result.affectedRows });
    }
    catch (err) {
        next(err);
    }
});
// Single-user edit — supports name and ID number, which don't make
// sense as bulk fields (each person's name/ID is unique, unlike
// designation/role/fileCategory which are reasonably shared across many
// accounts at once via /bulk above).
router.patch('/:fileNumber', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [
    (0, express_validator_1.param)('fileNumber').trim().notEmpty(),
    (0, express_validator_1.body)('name').optional().trim().isLength({ min: 1, max: 255 }),
    (0, express_validator_1.body)('idNumber').optional({ nullable: true }).trim().isLength({ max: 64 }),
    (0, express_validator_1.body)('designation').optional().trim().isLength({ max: 255 }),
    (0, express_validator_1.body)('role').optional().isIn(['admin', 'user', 'special']),
    (0, express_validator_1.body)('fileCategory').optional().isIn(SUB_CATEGORIES),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { name, idNumber, designation, role, fileCategory } = req.body;
        if (name === undefined && idNumber === undefined && !designation && !role && !fileCategory) {
            return res.status(400).json({ error: 'Nothing to update' });
        }
        const sets = [];
        const params = [];
        if (name) {
            sets.push('name = ?');
            params.push(name);
        }
        if (idNumber !== undefined) {
            sets.push('id_number = ?');
            params.push(idNumber || null);
        }
        if (designation) {
            sets.push('designation = ?');
            params.push(designation);
        }
        if (role) {
            sets.push('role = ?');
            params.push(role);
        }
        if (fileCategory) {
            sets.push('file_category = ?');
            params.push(fileCategory);
        }
        const [result] = await db_1.pool.query(`UPDATE users SET ${sets.join(', ')} WHERE file_number = ?`, [...params, req.params.fileNumber]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// Bulk deactivate — admin only. Same soft-delete semantics as the
// single-user deactivate route, just applied to several accounts at once.
router.post('/bulk-deactivate', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [
    (0, express_validator_1.body)('fileNumbers').isArray({ min: 1 }),
    (0, express_validator_1.body)('fileNumbers.*').isString().trim().notEmpty(),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { fileNumbers } = req.body;
        const placeholders = fileNumbers.map(() => '?').join(',');
        const [result] = await db_1.pool.query(`UPDATE users SET is_active = 0 WHERE file_number IN (${placeholders})`, fileNumbers);
        res.json({ success: true, deactivated: result.affectedRows });
    }
    catch (err) {
        next(err);
    }
});
// Deactivate login (admin only). This is a soft delete — personnel file
// record and all history are preserved, matching the original system.
router.post('/:fileNumber/deactivate', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [(0, express_validator_1.param)('fileNumber').trim().notEmpty()], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const [result] = await db_1.pool.query('UPDATE users SET is_active = 0 WHERE file_number = ?', [req.params.fileNumber]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:fileNumber/reactivate', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [(0, express_validator_1.param)('fileNumber').trim().notEmpty()], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const [result] = await db_1.pool.query('UPDATE users SET is_active = 1 WHERE file_number = ?', [req.params.fileNumber]);
        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// NOTE: intentionally no DELETE route for users. Accounts are only ever
// deactivated/reactivated so that personnel history stays intact.
exports.default = router;
