import { Router, Request, Response } from 'express';
import multer from 'multer';
const { processCsv } = require('../services/csv.service');

console.log('✅ csv.routes.ts loaded');

const router = Router();

// ─── Multer config ────────────────────────────────────────────
// Store file in memory (no disk write needed — we process immediately)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// ─── POST /csv/upload ─────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No file uploaded.' });
      return;
    }

    const result = await processCsv(req.file.buffer);

    res.json({
      status:    'ok',
      message:   'CSV processed successfully.',
      inserted:  result.inserted,
      skipped:   result.skipped,
      employees: result.employees,
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    res.status(500).json({
      status:  'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

module.exports = router;