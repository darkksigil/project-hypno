import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller';

const router = Router();

router.get('/',    employeeController.getAll);
router.get('/:id', employeeController.getById);
router.put('/:id', employeeController.update);

export default router;
