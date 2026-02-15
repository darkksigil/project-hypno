import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
const { getDb } = require('../../database/db');
import csvRoutes      from '../routes/csv.routes';
import dtrRoutes      from '../routes/dtr.routes';
import employeeRoutes from '../routes/employee.routes';

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(morgan('dev'));

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
app.use(cors({ origin: allowedOrigin }));

// ─── Routes ──────────────────────────────────────────────────
console.log('csvRoutes type:', typeof csvRoutes);
console.log('csvRoutes value:', csvRoutes);
app.use('/csv',       csvRoutes);
app.use('/dtr',       dtrRoutes);
app.use('/employees', employeeRoutes);
console.log('✅ Routes mounted');

// ─── Health check ─────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.get('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      db:     'failed',
      error:  err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── Catch-all 404 ───────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

export default app;