import { Router, Request, Response } from 'express';
const { getDb } = require('../../database/db');

const router = Router();

// ─── GET /departments ─────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db   = getDb();
    const deps = await db.all(`SELECT * FROM departments ORDER BY name ASC`);
    res.json(deps);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /departments ────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ status: 'error', message: 'Department name is required.' });
      return;
    }
    const db     = getDb();
    const result = await db.run(`INSERT INTO departments (name) VALUES (?)`, [name.trim()]);
    res.status(201).json({ status: 'ok', id: result.lastID, name: name.trim() });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      res.status(409).json({ status: 'error', message: 'Department already exists.' });
      return;
    }
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── PUT /departments/:id ─────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ status: 'error', message: 'Department name is required.' });
      return;
    }
    const db = getDb();
    await db.run(`UPDATE departments SET name = ? WHERE id = ?`, [name.trim(), req.params.id]);
    res.json({ status: 'ok', message: 'Department updated.' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── DELETE /departments/:id ──────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db.run(`UPDATE employees SET department_id = NULL WHERE department_id = ?`, [req.params.id]);
    await db.run(`DELETE FROM departments WHERE id = ?`, [req.params.id]);
    res.json({ status: 'ok', message: 'Department deleted.' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

module.exports = router;