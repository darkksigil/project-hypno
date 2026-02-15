import { Router, Request, Response } from 'express';
const { getDb } = require('../../database/db');

const router = Router();

// ─── GET /employees ───────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db        = getDb();
    const employees = await db.all(`
      SELECT
        e.id,
        e.name,
        e.employee_type,
        e.department_id,
        d.name AS department
      FROM   employees    e
      LEFT JOIN departments d ON d.id = e.department_id
      ORDER  BY e.name ASC
    `);
    res.json(employees);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /employees/:id ───────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db       = getDb();
    const employee = await db.get(`
      SELECT
        e.id,
        e.name,
        e.employee_type,
        e.department_id,
        d.name AS department
      FROM   employees    e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE  e.id = ?
    `, [req.params.id]);

    if (!employee) {
      res.status(404).json({ status: 'error', message: 'Employee not found.' });
      return;
    }
    res.json(employee);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── PUT /employees/:id ───────────────────────────────────────
// Update department and employee type
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { department_id, employee_type, name } = req.body;
    const db = getDb();

    await db.run(`
      UPDATE employees
      SET
        name          = COALESCE(?, name),
        department_id = ?,
        employee_type = COALESCE(?, employee_type)
      WHERE id = ?
    `, [name ?? null, department_id ?? null, employee_type ?? null, req.params.id]);

    res.json({ status: 'ok', message: 'Employee updated.' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

module.exports = router;