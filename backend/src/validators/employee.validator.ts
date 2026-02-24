import { z } from 'zod';

export const updateEmployeeSchema = z.object({
  name:          z.string().trim().min(1).optional(),
  department_id: z.number().int().positive().nullable().optional(),
  employee_type: z.enum(['permanent', 'cos']).optional(),
  surname:       z.string().trim().min(1).optional(),
  first_name:    z.string().trim().min(1).optional(),
  middle_name:   z.string().trim().optional(),
  birthday:      z.string().trim().optional(),
}).strict();

export const employeeIdParamSchema = z.object({
  id: z.string().trim().min(1),
});