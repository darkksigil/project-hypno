import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { updateEmployeeSchema } from '../validators/employee.validator';
import * as employeeService from '../services/employee.service';

// GET /employees
export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const employees = await employeeService.getAllEmployees();
  res.json({ status: 'ok', data: employees });
});

// GET /employees/:id
export const getById = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getEmployeeById(req.params.id);
  res.json({ status: 'ok', data: employee });
});

// PUT /employees/:id
export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = updateEmployeeSchema.parse(req.body);
  await employeeService.updateEmployee(req.params.id, body);
  res.json({ status: 'ok', message: 'Employee updated.' });
});
