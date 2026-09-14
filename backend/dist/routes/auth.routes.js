"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const db_1 = require("../config/db");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Throttle login attempts per-IP to slow down credential-stuffing / brute force.
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN || 15) * 60 * 1000,
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' },
});
function toSafeUser(u) {
    const { password_hash, ...safe } = u;
    return safe;
}
router.post('/login', loginLimiter, [
    (0, express_validator_1.body)('fileNumber').trim().notEmpty().withMessage('File number is required').isLength({ max: 64 }),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required').isLength({ max: 128 }),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { fileNumber, password } = req.body;
        // Parameterized query — fileNumber is never concatenated into SQL.
        const [rows] = await db_1.pool.query('SELECT * FROM users WHERE file_number = ? LIMIT 1', [fileNumber]);
        const user = rows[0];
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Incorrect file number or password' });
        }
        const ok = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Incorrect file number or password' });
        }
        const token = (0, auth_1.signToken)({ sub: user.id, fileNumber: user.file_number, role: user.role });
        res.json({ token, user: toSafeUser(user) });
    }
    catch (err) {
        next(err);
    }
});
router.get('/me', auth_1.requireAuth, async (req, res, next) => {
    try {
        const [rows] = await db_1.pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json({ user: toSafeUser(user) });
    }
    catch (err) {
        next(err);
    }
});
router.post('/change-password', auth_1.requireAuth, [
    (0, express_validator_1.body)('currentPassword').notEmpty(),
    (0, express_validator_1.body)('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], errorHandler_1.handleValidation, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const [rows] = await db_1.pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
        const user = rows[0];
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const ok = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!ok)
            return res.status(401).json({ error: 'Current password is incorrect' });
        const newHash = await bcryptjs_1.default.hash(newPassword, 12);
        await db_1.pool.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [newHash, user.id]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
