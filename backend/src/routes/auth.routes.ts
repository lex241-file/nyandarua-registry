import { NextFunction, Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { pool } from '../config/db';
import { handleValidation } from '../middleware/errorHandler';
import { signToken, requireAuth } from '../middleware/auth';
import { UserRow, SafeUser } from '../types';

const router = Router();

// Throttle login attempts per-IP to slow down credential-stuffing / brute force.
const loginLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MIN || 15) * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function toSafeUser(u: UserRow): SafeUser {
  const { password_hash, ...safe } = u;
  return safe;
}

router.post(
  '/login',
  loginLimiter,
  [
    body('fileNumber').trim().notEmpty().withMessage('File number is required').isLength({ max: 64 }),
    body('password').notEmpty().withMessage('Password is required').isLength({ max: 128 }),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileNumber, password } = req.body as { fileNumber: string; password: string };

      // Parameterized query — fileNumber is never concatenated into SQL.
      const [rows] = await pool.query<any[]>(
        'SELECT * FROM users WHERE file_number = ? LIMIT 1',
        [fileNumber]
      );
      const user = rows[0] as UserRow | undefined;

      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Incorrect file number or password' });
      }

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Incorrect file number or password' });
      }

      const token = signToken({ sub: user.id, fileNumber: user.file_number, role: user.role });
      res.json({ token, user: toSafeUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user!.sub]);
    const user = rows[0] as UserRow | undefined;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  handleValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
      const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user!.sub]);
      const user = rows[0] as UserRow | undefined;
      if (!user) return res.status(404).json({ error: 'User not found' });

      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

      const newHash = await bcrypt.hash(newPassword, 12);
      await pool.query(
        'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
        [newHash, user.id]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
