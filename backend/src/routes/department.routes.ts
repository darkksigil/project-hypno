import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../../database/db';
import { asyncHandler, AppError } from '../middlewares/error.middleware';

const router = Router();

const deptBodySchema = z.object({
  name: z.string().trim().min(1, 'Department name is required.'),
});

// GET /departments
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const db   = getDb();
  const deps = await db.all(`SELECT * FROM departments ORDER BY name ASC`);
  res.json({ status: 'ok', data: deps });
}));

// POST /departments
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name } = deptBodySchema.parse(req.body);
  const db       = getDb();
  const result   = await db.run(`INSERT INTO departments (name) VALUES (?)`, [name]);
  res.status(201).json({ status: 'ok', id: result.lastID, name });
}));

// PUT /departments/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name } = deptBodySchema.parse(req.body);
  const db       = getDb();
  const result   = await db.run(`UPDATE departments SET name = ? WHERE id = ?`, [name, req.params.id]);
  if (!result.changes) throw new AppError(404, 'Department not found.', 'NOT_FOUND');
  res.json({ status: 'ok', message: 'Department updated.' });
}));

// DELETE /departments/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  await db.run(`UPDATE employees SET department_id = NULL WHERE department_id = ?`, [req.params.id]);
  const result = await db.run(`DELETE FROM departments WHERE id = ?`, [req.params.id]);
  if (!result.changes) throw new AppError(404, 'Department not found.', 'NOT_FOUND');
  res.json({ status: 'ok', message: 'Department deleted.' });
}));

export default router;
