import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import session from 'express-session';
const { getDb }          = require('../../database/db');
const { requireAuth }    = require('./auth.middleware');
import csvRoutes          from '../routes/csv.routes';
import dtrRoutes          from '../routes/dtr.routes';
import employeeRoutes     from '../routes/employee.routes';
import departmentRoutes   from '../routes/department.routes';
const authRoutes          = require('../routes/auth.routes');
const printRoutes         = require('../routes/print.routes');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(morgan('dev'));

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
app.use(cors({
  origin:      allowedOrigin,
  credentials: true,
}));

app.use(session({
  secret:            process.env.SESSION_SECRET ?? 'imiss-fallback-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ─── Public routes ────────────────────────────────────────────
app.use('/auth', authRoutes);

app.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.get('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'failed' });
  }
});

// ─── Protected routes ─────────────────────────────────────────
app.use('/csv',         requireAuth, csvRoutes);
app.use('/dtr',         requireAuth, printRoutes);   // ← print first so /print and /test-pdf aren't swallowed by dtrRoutes
app.use('/dtr',         requireAuth, dtrRoutes);
app.use('/employees',   requireAuth, employeeRoutes);
app.use('/departments', requireAuth, departmentRoutes);

// ─── Catch-all 404 ───────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

export default app;