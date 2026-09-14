"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const SUB_CATEGORIES = [
    'personal', 'interns', 'retired', 'deceased', 'transferred',
    'dismissed', 'end_contract', 'resigned', 'gov_appointee', 'olkalau',
];
router.get('/', auth_1.requireAuth, [
    (0, express_validator_1.query)('search').optional().trim().isLength({ max: 255 }),
    (0, express_validator_1.query)('category').optional().isIn(['general', 'personal', 'custom', 'confidential']),
    (0, express_validator_1.query)('subCategory').optional().isIn(SUB_CATEGORIES),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const category = req.query.category;
        const subCategory = req.query.subCategory;
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
        const params = [];
        if (category) {
            sql += ' AND f.category = ?';
            params.push(category);
        }
        if (subCategory) {
            if (subCategory === 'personal') {
                sql += " AND (f.sub_category IS NULL OR f.sub_category = 'personal')";
            }
            else {
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
        const [rows] = await db_1.pool.query(sql, params);
        res.json({ files: rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), [
    (0, express_validator_1.body)('fileName').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('fileNumber').trim().notEmpty().isLength({ max: 64 }),
    (0, express_validator_1.body)('category').optional().isIn(['general', 'personal', 'custom', 'confidential']),
    (0, express_validator_1.body)('subCategory').optional().isIn(SUB_CATEGORIES),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { fileName, fileNumber, category = 'custom', subCategory = null } = req.body;
        const prefix = category === 'personal' ? 'PERS_' : category === 'confidential' ? 'CONF_' : 'CF_';
        const fileId = `${prefix}${fileNumber}`;
        await db_1.pool.query(`INSERT INTO registry_files (file_id, file_name, file_number, category, sub_category)
         VALUES (?, ?, ?, ?, ?)`, [fileId, fileName, fileNumber, category, subCategory]);
        res.status(201).json({ success: true, fileId });
    }
    catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'A file with that number already exists' });
        }
        next(err);
    }
});
router.delete('/:fileId', auth_1.requireAuth, (0, auth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const [result] = await db_1.pool.query("DELETE FROM registry_files WHERE file_id = ? AND category IN ('custom','confidential')", [req.params.fileId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Custom/confidential file not found (only those can be removed)' });
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
