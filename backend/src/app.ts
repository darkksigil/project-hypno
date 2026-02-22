import express, { Request, Response } from 'express';
import cors    from 'cors';
import morgan  from 'morgan';
import session from 'express-session';

import { getDb }        from '../database/db';
import { requireAuth }  from './middlewares/auth.middleware';
import { apiLimiter }   from './middlewares/rateLimit.middleware';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';

import authRoutes       from './routes/auth.routes';
import csvRoutes        from './routes/csv.routes';
import dtrRoutes        from './routes/dtr.routes';
import employeeRoutes   from './routes/employee.routes';
import departmentRoutes from './routes/department.routes';

const app = express();

// ─── Core Middleware ─────────────────────────────────────────
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', apiLimiter);

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use(session({
  secret:            process.env.SESSION_SECRET ?? 'imiss-fallback-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
}));

// ─── Public Routes ───────────────────────────────────────────
app.use('/auth', authRoutes);

app.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.get('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', db: 'failed' });
  }
});

// ─── Protected Routes ────────────────────────────────────────
// dtr.routes.ts handles both print (/print, /test-pdf) and dtr internally
app.use('/csv',         requireAuth, csvRoutes);
app.use('/dtr',         requireAuth, dtrRoutes);
app.use('/employees',   requireAuth, employeeRoutes);
app.use('/departments', requireAuth, departmentRoutes);

// ─── Error Handling — must be last ───────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;