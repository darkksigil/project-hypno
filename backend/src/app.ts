import express, { Request, Response } from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';
import session from 'express-session';
import BetterSqlite3  from 'better-sqlite3';
import SqliteStore    from 'better-sqlite3-session-store';

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

// ─── Security ────────────────────────────────────────────────
app.use(helmet());

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
app.use(cors({ origin: allowedOrigin, credentials: true }));

// ─── Core Middleware ─────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

// ─── Session Store (SQLite-backed — no memory leak) ──────────
const SqliteSession = SqliteStore(session);
const sessionDb     = new BetterSqlite3('./database/sessions.sqlite');

app.use(session({
  store: new SqliteSession({
    client: sessionDb,
    expired: {
      clear:       true,
      intervalMs:  900_000, // clean up expired sessions every 15 minutes
    },
  }),
  secret:            process.env.SESSION_SECRET ?? 'test-secret-not-for-production',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
    maxAge:   8 * 60 * 60 * 1000,                   // 8 hours
  },
}));

// ─── Public Routes ───────────────────────────────────────────
app.use('/api/auth', authRoutes);

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.get('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', db: 'failed' });
  }
});

// ─── Protected Routes ────────────────────────────────────────
app.use('/api/csv',         requireAuth, csvRoutes);
app.use('/api/dtr',         requireAuth, dtrRoutes);
app.use('/api/employees',   requireAuth, employeeRoutes);
app.use('/api/departments', requireAuth, departmentRoutes);

// ─── Error Handling — must be last ───────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;