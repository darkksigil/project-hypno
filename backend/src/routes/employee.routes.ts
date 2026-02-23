import { Router, Request, Response, NextFunction } from 'express';
import { z }      from 'zod';
import { ParamsDictionary } from 'express-serve-static-core';
import * as employeeController from '../controllers/employee.controller';
import { employeeIdParamSchema } from '../validators/employee.validator';

const router = Router();

// ─── Reusable param validator ─────────────────────────────────
function validateParams(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(result.error);
    req.params = result.data as ParamsDictionary;
    next();
  };
}

router.get('/',    employeeController.getAll);
router.get('/:id', validateParams(employeeIdParamSchema), employeeController.getById);
router.put('/:id', validateParams(employeeIdParamSchema), employeeController.update);

export default router;