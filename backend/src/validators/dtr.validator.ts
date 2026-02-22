import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const dateRangeSchema = z.object({
  from: isoDate,
  to:   isoDate,
}).refine((d) => d.from <= d.to, { message: '`from` must be before or equal to `to`' });

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const logFilterSchema = z.object({
  filter: z.enum(['processed', 'pending', 'filtered', 'all']).default('all'),
}).merge(paginationSchema);

export const exportSchema = dateRangeSchema.extend({
  department_id: z.coerce.number().int().positive().optional(),
  employee_type: z.enum(['permanent', 'casual', 'contractual']).optional(),
});
