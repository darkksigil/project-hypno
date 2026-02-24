import { Router, Request, Response } from 'express';
import { z }                         from 'zod';
import { asyncHandler }              from '../middlewares/error.middleware';
import * as deptService              from '../services/department.service';

const router = Router();

const deptBodySchema = z.object({
  name: z.string().trim().min(1, 'Department name is required.'),
});

// GET /departments
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const data = await deptService.getAllDepartments();
  res.json({ status: 'ok', data });
}));

// POST /departments
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name } = deptBodySchema.parse(req.body);
  const result   = await deptService.createDepartment(name);
  res.status(201).json({ status: 'ok', ...result });
}));

// PUT /departments/:id
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { name } = deptBodySchema.parse(req.body);
  await deptService.updateDepartment(req.params.id, name);
  res.json({ status: 'ok', message: 'Department updated.' });
}));

// DELETE /departments/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await deptService.deleteDepartment(req.params.id);
  res.json({ status: 'ok', message: 'Department deleted.' });
}));

export default router;