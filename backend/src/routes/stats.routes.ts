import { NextFunction, Request, Response, Router } from 'express';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [[genRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM registry_files WHERE category = 'general'"
    );
    const [[persTotalRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM registry_files WHERE category = 'personal'"
    );
    const [[persActiveRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM registry_files WHERE category = 'personal' AND (sub_category IS NULL OR sub_category = 'personal')"
    );
    const [[internsRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM registry_files WHERE category = 'personal' AND sub_category = 'interns'"
    );
    const [[semiActiveRow]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS c FROM registry_files
       WHERE category = 'personal' AND sub_category NOT IN ('personal','interns') AND sub_category IS NOT NULL`
    );
    const [[customRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM registry_files WHERE category IN ('custom','confidential')"
    );
    const [[usersRow]] = await pool.query<any[]>(
      'SELECT COUNT(*) AS c FROM users WHERE is_active = 1'
    );
    const [[pendingRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM requests WHERE status = 'pending'"
    );
    const [[overdueRow]] = await pool.query<any[]>(
      "SELECT COUNT(*) AS c FROM requests WHERE due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('returned','rejected_auto')"
    );

    const totalFiles = Number(genRow.c) + Number(persTotalRow.c) + Number(customRow.c);

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
      pendingRequests: Number(pendingRow.c),
      overdueRequests: Number(overdueRow.c),
    });
  } catch (err) {
    next(err);
  }
});

// Notification counts — bell icon badge. Admin sees pending (awaiting
// approval) requests; regular users see files assigned to them awaiting
// their acceptance.
router.get('/notifications', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let count = 0;
    if (req.user!.role === 'admin') {
      const [[row]] = await pool.query<any[]>(
        "SELECT COUNT(*) AS c FROM requests WHERE status = 'pending'"
      );
      count = Number(row.c);
    } else {
      const [[row]] = await pool.query<any[]>(
        "SELECT COUNT(*) AS c FROM requests WHERE assigned_to_id = ? AND status = 'pending_accept'",
        [req.user!.sub]
      );
      count = Number(row.c);
    }
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

export default router;
