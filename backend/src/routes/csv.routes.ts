import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
const { parseCsv, uploadToDatabase } = require('../services/csv.service');

const router = Router();

// ─── Multer config ────────────────────────────────────────────
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

// ─── Zod Schemas ──────────────────────────────────────────────

const PunchSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required').max(50),
  name:        z.string().min(1, 'Name is required'),
  punched_at:  z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid timestamp format'
  })
});

const BulkUploadSchema = z.object({
  punches: z.array(PunchSchema).min(1, 'At least one punch record required')
});

// ─── POST /csv/parse ──────────────────────────────────────────
// Step 1: Parse CSV and validate, return JSON preview (no DB insert)

router.post('/parse', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No file uploaded.' });
      return;
    }

    console.log('[CSV-PARSE] Processing file:', req.file.originalname);

    // Parse CSV using service
    const rawPunches = await parseCsv(req.file.buffer);
    console.log('[CSV-PARSE] Parsed:', rawPunches.length, 'raw records');

    if (rawPunches.length === 0) {
      res.status(400).json({ status: 'error', message: 'No valid punch records found in CSV' });
      return;
    }

    // Validate each punch with Zod
    const validated = [];
    const errors = [];

    for (let i = 0; i < rawPunches.length; i++) {
      const result = PunchSchema.safeParse(rawPunches[i]);
      if (result.success) {
        validated.push(result.data);
      } else {
        const issues = result.error.issues.map(iss => iss.message).join(', ');
        errors.push(`Record ${i + 1}: ${issues}`);
      }
    }

    console.log('[CSV-PARSE] Validated:', validated.length, 'records');
    console.log('[CSV-PARSE] Errors:', errors.length);

    if (validated.length === 0) {
      res.status(400).json({ 
        status: 'error', 
        message: 'No valid records after validation',
        errors: errors.slice(0, 10)
      });
      return;
    }

    // Return validated data for preview
    res.json({ 
      status: 'ok', 
      data: validated,
      warnings: errors.length > 0 ? `${errors.length} records skipped due to validation errors` : null
    });

  } catch (err) {
    console.error('[CSV-PARSE] Error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: err instanceof Error ? err.message : 'Parse failed' 
    });
  }
});

// ─── POST /csv/upload ─────────────────────────────────────────
// Step 2: Receive validated JSON and insert into database

router.post('/upload', async (req: Request, res: Response) => {
  try {
    console.log('[CSV-UPLOAD] Received payload');

    // Validate request body with Zod
    const result = BulkUploadSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        status: 'error', 
        message: 'Invalid payload',
        errors: result.error.issues.map(iss => iss.message)
      });
      return;
    }

    const { punches } = result.data;
    console.log('[CSV-UPLOAD] Uploading', punches.length, 'records to database');

    // Upload to database using service
    const uploadResult = await uploadToDatabase(punches);

    res.json({
      status:    'ok',
      message:   'CSV uploaded successfully.',
      inserted:  uploadResult.inserted,
      skipped:   uploadResult.skipped,
      employees: uploadResult.employees,
    });

  } catch (err) {
    console.error('[CSV-UPLOAD] Error:', err);
    res.status(500).json({
      status:  'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

module.exports = router;