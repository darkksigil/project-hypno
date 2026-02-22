import { Router } from 'express';
import * as dtrController   from '../controllers/dtr.controller';
import * as printController from '../controllers/print.controller';

const router = Router();

// ─── Print routes (must come before /:employeeId) ────────────
router.get('/test-pdf', printController.testPdf);
router.post('/print',   printController.printDtr);

// ─── DTR routes ───────────────────────────────────────────────
router.post('/compute',    dtrController.compute);
router.get('/logs',        dtrController.getLogs);
router.get('/export',      dtrController.exportRecords);
router.get('/',            dtrController.getAll);
router.get('/:employeeId', dtrController.getByEmployee);

export default router;