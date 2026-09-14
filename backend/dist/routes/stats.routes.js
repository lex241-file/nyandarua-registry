"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (_req, res, next) => {
    try {
        const [[genRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM registry_files WHERE category = 'general'");
        const [[persTotalRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM registry_files WHERE category = 'personal'");
        const [[persActiveRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM registry_files WHERE category = 'personal' AND (sub_category IS NULL OR sub_category = 'personal')");
        const [[internsRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM registry_files WHERE category = 'personal' AND sub_category = 'interns'");
        const [[semiActiveRow]] = await db_1.pool.query(`SELECT COUNT(*) AS c FROM registry_files
       WHERE category = 'personal' AND sub_category NOT IN ('personal','interns') AND sub_category IS NOT NULL`);
        const [[customRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM registry_files WHERE category IN ('custom','confidential')");
        const [[usersRow]] = await db_1.pool.query('SELECT COUNT(*) AS c FROM users WHERE is_active = 1');
        const [[adminsRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM users WHERE is_active = 1 AND role = 'admin'");
        const [[pendingRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM requests WHERE status = 'pending'");
        const [[overdueRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM requests WHERE due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('returned','rejected_auto')");
        const [[assignedRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM requests WHERE status IN ('pending_accept','accepted')");
        const [[rejectedRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM requests WHERE status = 'rejected_auto'");
        const totalFiles = Number(genRow.c) + Number(persTotalRow.c) + Number(customRow.c);
        const assignedFiles = Number(assignedRow.c);
        res.json({
            totalFiles,
            breakdown: {
                general: Number(genRow.c),
                personalTotal: Number(persTotalRow.c),
                personalActive: Number(persActiveRow.c),
                interns: Number(internsRow.c),
                semiActive: Number(semiActiveRow.c),
                custom: Number(customRow.c),
            },
            totalActiveUsers: Number(usersRow.c),
            totalAdmins: Number(adminsRow.c),
            totalRegularUsers: Number(usersRow.c) - Number(adminsRow.c),
            pendingRequests: Number(pendingRow.c),
            overdueRequests: Number(overdueRow.c),
            assignedFiles,
            remainingFiles: totalFiles - assignedFiles,
            rejectedFiles: Number(rejectedRow.c),
        });
    }
    catch (err) {
        next(err);
    }
});
// Notification counts — bell icon badge. Admin sees pending (awaiting
// approval) requests; regular users see files assigned to them awaiting
// their acceptance.
router.get('/notifications', auth_1.requireAuth, async (req, res, next) => {
    try {
        let count = 0;
        if (req.user.role === 'admin') {
            const [[requestRow]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM requests WHERE status = 'pending'");
            const [[noteRow]] = await db_1.pool.query('SELECT COUNT(*) AS c FROM notes WHERE is_read = 0');
            count = Number(requestRow.c) + Number(noteRow.c);
        }
        else {
            const [[row]] = await db_1.pool.query("SELECT COUNT(*) AS c FROM requests WHERE assigned_to_id = ? AND status = 'pending_accept'", [req.user.sub]);
            count = Number(row.c);
        }
        res.json({ count });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
