import { getDb }    from '../../database/db';
import { AppError } from '../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────

export interface Department {
  id:   number;
  name: string;
}

// ─── Service Functions ────────────────────────────────────────

export async function getAllDepartments(): Promise<Department[]> {
  return getDb().all(`SELECT * FROM departments ORDER BY name ASC`);
}

export async function createDepartment(name: string): Promise<{ id: number; name: string }> {
  const result = await getDb().run(
    `INSERT INTO departments (name) VALUES (?)`,
    [name],
  );
  return { id: result.lastID!, name };
}

export async function updateDepartment(id: string, name: string): Promise<void> {
  const result = await getDb().run(
    `UPDATE departments SET name = ? WHERE id = ?`,
    [name, id],
  );
  if (!result.changes) throw new AppError(404, 'Department not found.', 'NOT_FOUND');
}

export async function deleteDepartment(id: string): Promise<void> {
  // Unlink employees before deleting so FK constraint doesn't block
  await getDb().run(
    `UPDATE employees SET department_id = NULL WHERE department_id = ?`,
    [id],
  );
  const result = await getDb().run(
    `DELETE FROM departments WHERE id = ?`,
    [id],
  );
  if (!result.changes) throw new AppError(404, 'Department not found.', 'NOT_FOUND');
}