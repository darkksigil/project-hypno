import { Router, Request, Response } from 'express';
const { getDb } = require('../../database/db');

const router = Router();

// ─── Types ────────────────────────────────────────────────────

interface PunchLog {
  id:          number;
  employee_id: string;
  punched_at:  string;
}

interface DtrPair {
  date:        string;
  time_in:     string | null;
  time_out:    string | null;
  total_hours: number | null;
}

// ─── Constants ───────────────────────────────────────────────
const MAX_SHIFT_HOURS = 18; // 16h max shift + 2h grace

// ─── Helpers ─────────────────────────────────────────────────

function computeHours(timeIn: string, timeOut: string): number {
  const diff = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  return Math.round((diff / 3600000) * 100) / 100;
}

function diffHours(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
}

// Pair punches with 18h cap:
// - Alternating IN/OUT
// - Gap > 18h after IN → missing OUT, next punch = new IN
// - Date stored = date the shift STARTED (handles overnight)
function pairPunches(punches: PunchLog[]): DtrPair[] {
  const pairs: DtrPair[] = [];
  let i = 0;

  while (i < punches.length) {
    const inPunch  = punches[i];
    const outPunch = punches[i + 1] ?? null;
    const timeIn   = inPunch.punched_at;
    const date     = timeIn.split('T')[0];

    if (outPunch) {
      const gap = diffHours(timeIn, outPunch.punched_at);
      if (gap <= MAX_SHIFT_HOURS) {
        pairs.push({
          date,
          time_in:     timeIn,
          time_out:    outPunch.punched_at,
          total_hours: computeHours(timeIn, outPunch.punched_at),
        });
        i += 2;
      } else {
        // Gap too large — forgotten OUT
        pairs.push({ date, time_in: timeIn, time_out: null, total_hours: null });
        i += 1;
      }
    } else {
      // Last punch — no OUT
      pairs.push({ date, time_in: timeIn, time_out: null, total_hours: null });
      i += 1;
    }
  }

  return pairs;
}

// ─── POST /dtr/compute ────────────────────────────────────────
router.post('/compute', async (_req: Request, res: Response) => {
  try {
    const db = getDb();

    const punches: PunchLog[] = await db.all(`
      SELECT id, employee_id, punched_at
      FROM   punch_logs
      WHERE  used = 0
      ORDER  BY employee_id ASC, punched_at ASC
    `);

    if (!punches.length) {
      res.json({ status: 'ok', message: 'No new punches to process.', records: 0 });
      return;
    }

    // Group by employee only — NOT by date (overnight shifts span two dates)
    const grouped = new Map<string, PunchLog[]>();
    for (const punch of punches) {
      if (!grouped.has(punch.employee_id)) grouped.set(punch.employee_id, []);
      grouped.get(punch.employee_id)!.push(punch);
    }

    let recordsInserted = 0;
    const usedIds: number[] = [];

    for (const [employeeId, empPunches] of grouped) {
      const pairs = pairPunches(empPunches);

      for (const pair of pairs) {
        await db.run(
          `INSERT INTO dtr_records (employee_id, date, time_in, time_out, total_hours)
           VALUES (?, ?, ?, ?, ?)`,
          [employeeId, pair.date, pair.time_in, pair.time_out, pair.total_hours]
        );
        recordsInserted++;
      }

      usedIds.push(...empPunches.map((p: PunchLog) => p.id));
    }

    if (usedIds.length) {
      await db.run(
        `UPDATE punch_logs SET used = 1 WHERE id IN (${usedIds.map(() => '?').join(',')})`,
        usedIds
      );
    }

    res.json({ status: 'ok', message: 'DTR computed successfully.', records: recordsInserted });
  } catch (err) {
    console.error('DTR compute error:', err);
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /dtr/logs ────────────────────────────────────────────
// Raw punch logs — must be before /:employeeId route
router.get('/logs', async (_req: Request, res: Response) => {
  try {
    const db   = getDb();
    const logs = await db.all(`
      SELECT
        p.id,
        p.employee_id,
        e.name,
        dep.name  AS department,
        p.punched_at,
        p.used
      FROM   punch_logs  p
      JOIN   employees   e   ON e.id   = p.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      ORDER  BY p.punched_at DESC
      LIMIT  1000
    `);
    res.json(logs);
  } catch (err) {
    console.error('Error fetching punch logs:', err);
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /dtr/export ─────────────────────────────────────────
// Structured DTR data for PDF — must be before /:employeeId route
router.get('/export', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { department_id, from, to, employee_type } = req.query;

    if (!from || !to) {
      res.status(400).json({ status: 'error', message: 'from and to dates are required.' });
      return;
    }

    let query = `
      SELECT
        d.employee_id,
        e.name,
        e.employee_type,
        dep.name  AS department,
        d.date,
        d.time_in,
        d.time_out,
        d.total_hours
      FROM   dtr_records  d
      JOIN   employees    e   ON e.id   = d.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      WHERE  d.date BETWEEN ? AND ?
    `;
    const params: (string | number)[] = [from as string, to as string];

    if (department_id) {
      query += ` AND e.department_id = ?`;
      params.push(Number(department_id));
    }
    if (employee_type) {
      query += ` AND e.employee_type = ?`;
      params.push(employee_type as string);
    }

    query += ` ORDER BY e.name ASC, d.date ASC`;

    const records = await db.all(query, params);

    // Group by employee
    const byEmployee = new Map<string, {
      employee_id:   string;
      name:          string;
      employee_type: string;
      department:    string;
      records:       typeof records;
    }>();

    for (const r of records) {
      if (!byEmployee.has(r.employee_id)) {
        byEmployee.set(r.employee_id, {
          employee_id:   r.employee_id,
          name:          r.name,
          employee_type: r.employee_type ?? 'permanent',
          department:    r.department    ?? 'Unassigned',
          records:       [],
        });
      }
      byEmployee.get(r.employee_id)!.records.push(r);
    }

    res.json({
      from,
      to,
      employees: Array.from(byEmployee.values()),
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /dtr ─────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db      = getDb();
    const records = await db.all(`
      SELECT
        d.id,
        d.employee_id,
        e.name,
        e.employee_type,
        dep.name  AS department,
        d.date,
        d.time_in,
        d.time_out,
        d.total_hours
      FROM   dtr_records  d
      JOIN   employees    e   ON e.id   = d.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      ORDER  BY d.date DESC, e.name ASC
    `);
    res.json(records);
  } catch (err) {
    console.error('Error fetching DTR records:', err);
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /dtr/:employeeId ─────────────────────────────────────
router.get('/:employeeId', async (req: Request, res: Response) => {
  try {
    const db      = getDb();
    const records = await db.all(`
      SELECT
        d.id,
        d.employee_id,
        e.name,
        d.date,
        d.time_in,
        d.time_out,
        d.total_hours
      FROM   dtr_records d
      JOIN   employees   e ON e.id = d.employee_id
      WHERE  d.employee_id = ?
      ORDER  BY d.date ASC
    `, [req.params.employeeId]);

    if (!records.length) {
      res.status(404).json({ status: 'error', message: 'No DTR records found for this employee.' });
      return;
    }
    res.json(records);
  } catch (err) {
    console.error('Error fetching employee DTR:', err);
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

module.exports = router;