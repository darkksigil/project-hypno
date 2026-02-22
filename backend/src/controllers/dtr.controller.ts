import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import { logFilterSchema, paginationSchema, exportSchema } from '../validators/dtr.validator';
import * as dtrService from '../services/dtr.service';

// POST /dtr/compute
export const compute = asyncHandler(async (_req: Request, res: Response) => {
  const result = await dtrService.computeDtr();
  res.json({ status: 'ok', ...result });
});

// GET /dtr/logs?filter=all&page=1&limit=50
export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const { filter, page, limit } = logFilterSchema.parse(req.query);
  const result = await dtrService.getPunchLogs(filter, page, limit);
  res.json({ status: 'ok', ...result });
});

// GET /dtr/export?from=YYYY-MM-DD&to=YYYY-MM-DD&department_id=1&employee_type=permanent
export const exportRecords = asyncHandler(async (req: Request, res: Response) => {
  const params = exportSchema.parse(req.query);
  // ✅ FIX: exportDtr now returns ExportDtrResult (typed), safe to spread
  const result = await dtrService.exportDtr(params);
  res.json({ status: 'ok', ...result });
});

// GET /dtr?page=1&limit=50
export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await dtrService.getDtrRecords(page, limit);
  res.json({ status: 'ok', ...result });
});

// GET /dtr/:employeeId
export const getByEmployee = asyncHandler(async (req: Request, res: Response) => {
  const records = await dtrService.getDtrByEmployee(req.params.employeeId);
  if (!records.length) throw new AppError(404, 'No DTR records found for this employee.', 'NOT_FOUND');
  res.json({ status: 'ok', data: records });
});