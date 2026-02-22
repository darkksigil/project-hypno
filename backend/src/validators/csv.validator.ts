import { z } from 'zod';

// Validates the body sent to POST /csv/upload (after parse step)
export const uploadBodySchema = z.object({
  // The parsed punches are held in memory by the controller;
  // this schema validates any query/body params for the upload endpoint.
  // Extend as needed when you add filters.
}).strict();

// Validates multer file presence — used in controller, not Zod
export function assertCsvFile(file: Express.Multer.File | undefined): asserts file {
  if (!file) throw new Error('No file uploaded.');
}
