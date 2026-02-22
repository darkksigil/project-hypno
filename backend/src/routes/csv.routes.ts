import { Router } from 'express';
import multer from 'multer';
import * as csvController from '../controllers/csv.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /csv/parse  — preview only, no DB write
router.post('/parse',  upload.single('file'), csvController.parseCSV);

// POST /csv/upload — parse + save to DB in one step (same as original behavior)
router.post('/upload', upload.single('file'), csvController.uploadCSV);

export default router;