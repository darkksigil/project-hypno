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
  time_in:     string | null;
  time_out:    string | null;
  total_hours: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────

function computeHours(timeIn: string, timeOut: string): number {
  const diff = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  return Math.round((diff / 3600000) * 100) / 100; // round to 2 decimal places
}

// Alternate punches: 1st = IN, 2nd = OUT, 3rd = IN, 4th = OUT...
function pairPunches(punches: PunchLog[]): DtrPair[] {
  const pairs: DtrPair[] = [];

  for (let i = 0; i < punches.length; i += 2) {
    const timeIn   = punches[i]?.punched_at     ?? null;
    const timeOut  = punches[i + 1]?.punched_at ?? null;

    pairs.push({
      time_in:     timeIn,
      time_out:    timeOut,
      total_hours: timeIn && timeOut ? computeHours(timeIn, timeOut) : null,
    });
  }

  return pairs;
}

// ─── POST /dtr/compute ────────────────────────────────────────
// Reads unused punch_logs, computes IN/OUT pairs, writes to dtr_records
router.post('/compute', async (_req: Request, res: Response) => {
  try {
    const db = getDb();

    // Get all unused punches, sorted by employee + time
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

    // Group punches by employee + date
    const grouped = new Map<string, PunchLog[]>();

    for (const punch of punches) {
      const date = punch.punched_at.split('T')[0]; // YYYY-MM-DD
      const key  = `${punch.employee_id}__${date}`;

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(punch);
    }

    let recordsInserted = 0;
    const usedIds: number[] = [];

    for (const [key, dayPunches] of grouped) {
      const [employeeId, date] = key.split('__');
      const pairs = pairPunches(dayPunches);

      for (const pair of pairs) {
        await db.run(
          `INSERT INTO dtr_records (employee_id, date, time_in, time_out, total_hours)
           VALUES (?, ?, ?, ?, ?)`,
          [employeeId, date, pair.time_in, pair.time_out, pair.total_hours]
        );
        recordsInserted++;
      }

      // Mark all punches for this employee+date as used
      usedIds.push(...dayPunches.map(p => p.id));
    }

    // Mark punch_logs as used in one query
    if (usedIds.length) {
      await db.run(
        `UPDATE punch_logs SET used = 1 WHERE id IN (${usedIds.map(() => '?').join(',')})`,
        usedIds
      );
    }

    res.json({
      status:  'ok',
      message: 'DTR computed successfully.',
      records: recordsInserted,
    });
  } catch (err) {
    console.error('DTR compute error:', err);
    res.status(500).json({
      status: 'error',
      error:  err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── GET /dtr ─────────────────────────────────────────────────
// Returns all DTR records joined with employee name
router.get('/', async (_req: Request, res: Response) => {
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
      ORDER  BY d.date DESC, e.name ASC
    `);

    res.json(records);
  } catch (err) {
    console.error('Error fetching DTR records:', err);
    res.status(500).json({
      status: 'error',
      error:  err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── GET /dtr/:employeeId ─────────────────────────────────────
// Returns DTR records for a specific employee
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
    `,
      [req.params.employeeId]
    );

    if (!records.length) {
      res.status(404).json({ status: 'error', message: 'No DTR records found for this employee.' });
      return;
    }

    res.json(records);
  } catch (err) {
    console.error('Error fetching employee DTR:', err);
    res.status(500).json({
      status: 'error',
      error:  err instanceof Error ? err.message : String(err),
    });
  }
});

module.exports = router;