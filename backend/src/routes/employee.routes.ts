import { Router, Request, Response } from 'express';
const { getDb } = require('../../database/db');

const router = Router();

// ─── GET /employees ───────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db        = getDb();
    const employees = await db.all('SELECT * FROM employees ORDER BY name ASC');
    res.json(employees);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({
      status: 'error',
      error:  err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── GET /employees/:id ───────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db       = getDb();
    const employee = await db.get(
      'SELECT * FROM employees WHERE id = ?',
      [req.params.id]
    );

    if (!employee) {
      res.status(404).json({ status: 'error', message: 'Employee not found.' });
      return;
    }

    res.json(employee);
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({
      status: 'error',
      error:  err instanceof Error ? err.message : String(err),
    });
  }
});

module.exports = router;