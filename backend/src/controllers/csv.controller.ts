import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../middlewares/error.middleware';
import * as csvService from '../services/csv.service';

// POST /csv/parse  — parse & validate, return preview only (no DB write)
export const parseCSV = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError(400, 'No CSV file uploaded.', 'MISSING_FILE');

  const punches = await csvService.parseCsv(req.file.buffer);

  res.json({
    status:  'ok',
    count:   punches.length,
    preview: punches.slice(0, 10),
    data:    punches,
  });
});

// POST /csv/upload — accepts the CSV file directly and saves to DB in one step
export const uploadCSV = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError(400, 'No CSV file uploaded.', 'MISSING_FILE');

  const punches = await csvService.parseCsv(req.file.buffer);
  const result  = await csvService.uploadToDatabase(punches);

  res.json({ status: 'ok', ...result });
});