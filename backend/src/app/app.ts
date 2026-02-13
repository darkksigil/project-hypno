// backend/src/app/app.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { getDb } from '../../database/db';

const app = express();

// Middleware
app.use(express.json());
app.use(cors({ origin: 'http://localhost:4200' }));

// GET /users
app.get('/users', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const users = await db.all('SELECT * FROM users');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /health
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.get('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'failed', error: err instanceof Error ? err.message : String(err) });
  }
});

// Catch-all
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Endpoint not found' });
});

export default app;
