import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const printSchema = z.object({
  employee_ids:  z.array(z.string().trim().min(1)).min(1, 'At least one employee is required.'),
  employee_type: z.enum(['permanent', 'casual', 'contractual']),
  from:          isoDate,
  to:            isoDate,
}).refine((d) => d.from <= d.to, { message: '`from` must be before or equal to `to`' });
