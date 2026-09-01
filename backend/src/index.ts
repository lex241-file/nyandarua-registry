import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { pingDb } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import filesRoutes from './routes/files.routes';
import requestsRoutes from './routes/requests.routes';
import movementsRoutes from './routes/movements.routes';
import statsRoutes from './routes/stats.routes';

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// General API rate limit (separate, stricter limit is applied to /auth/login).
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', async (_req, res) => {
  try {
    await pingDb();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    // Log the real MySQL/connection error server-side (visible in Render's
    // Logs tab) without exposing DB details to whoever hits this endpoint.
    console.error('Health check DB connection failed:', err);
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/movements', movementsRoutes);
app.use('/api/stats', statsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Nyandarua Registry API listening on port ${PORT}`);
});
