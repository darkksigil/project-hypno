import { getDb }    from '../../database/db';
import { AppError } from '../middlewares/error.middleware';

// ─── Helper: build display name from parts ────────────────────
// Output: DELA CRUZ, Juan A.
function buildDisplayName(surname: string, firstName: string, middleName?: string | null): string {
  const last  = surname.trim().toUpperCase();
  const first = firstName.trim();
  const mi    = middleName?.trim();
  const middle = mi ? ` ${mi.charAt(0).toUpperCase()}.` : '';
  return `${last}, ${first}${middle}`;
}

// ─── Queries ──────────────────────────────────────────────────

export async function getAllEmployees(): Promise<unknown[]> {
  return getDb().all(`
    SELECT e.id, e.name, e.employee_type, e.department_id,
           e.surname, e.first_name, e.middle_name, e.birthday,
           d.name AS department
    FROM   employees e
    LEFT JOIN departments d ON d.id = e.department_id
    ORDER BY e.name ASC
  `);
}

export async function getEmployeeById(id: string): Promise<unknown> {
  const employee = await getDb().get(
    `SELECT e.id, e.name, e.employee_type, e.department_id,
            e.surname, e.first_name, e.middle_name, e.birthday,
            d.name AS department
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
  body: {
    name?:          string;
    department_id?: number | null;
    employee_type?: string;
    surname?:       string;
    first_name?:    string;
    middle_name?:   string;
    birthday?:      string;
  },
): Promise<void> {
  // If all three name parts are provided, derive the display name
  const derivedName =
    body.surname && body.first_name
      ? buildDisplayName(body.surname, body.first_name, body.middle_name)
      : body.name ?? null;

  const result = await getDb().run(
    `UPDATE employees
     SET name          = COALESCE(?, name),
         department_id = ?,
         employee_type = COALESCE(?, employee_type),
         surname       = COALESCE(?, surname),
         first_name    = COALESCE(?, first_name),
         middle_name   = ?,
         birthday      = COALESCE(?, birthday)
     WHERE id = ?`,
    [
      derivedName,
      body.department_id ?? null,
      body.employee_type ?? null,
      body.surname    ?? null,
      body.first_name ?? null,
      body.middle_name ?? null,   // allow clearing middle name
      body.birthday   ?? null,
      id,
    ],
  );
  if (!result.changes) throw new AppError(404, 'Employee not found.', 'NOT_FOUND');
}