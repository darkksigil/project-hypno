import { getDb } from '../../database/db';
import { AppError } from '../middlewares/error.middleware';

export async function getAllEmployees(): Promise<unknown[]> {
  const db = getDb();
  return db.all(`
    SELECT e.id, e.name, e.employee_type, e.department_id, d.name AS department
    FROM   employees    e
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY e.name ASC
  `);
}

export async function getEmployeeById(id: string): Promise<unknown> {
  const db       = getDb();
  const employee = await db.get(
    `SELECT e.id, e.name, e.employee_type, e.department_id, d.name AS department
     FROM   employees e
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE  e.id = ?`,
    [id],
  );
  if (!employee) throw new AppError(404, 'Employee not found.', 'NOT_FOUND');
  return employee;
}

export async function updateEmployee(
  id: string,
  body: { name?: string; department_id?: number | null; employee_type?: string },
): Promise<void> {
  const db = getDb();
  const result = await db.run(
    `UPDATE employees
     SET name          = COALESCE(?, name),
         department_id = ?,
         employee_type = COALESCE(?, employee_type)
     WHERE id = ?`,
    [body.name ?? null, body.department_id ?? null, body.employee_type ?? null, id],
  );
  if (!result.changes) throw new AppError(404, 'Employee not found.', 'NOT_FOUND');
}
