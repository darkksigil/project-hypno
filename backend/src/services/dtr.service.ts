import { getDb } from '../../database/db';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────

export interface PunchLog {
  id:          number;
  employee_id: string;
  punched_at:  string;
}

export interface DtrRecord {
  date:   string;
  am_in:  string | null;
  am_out: string | null;
  pm_in:  string | null;
  pm_out: string | null;
}

export interface PaginatedResult<T> {
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface ExportDtrResult {
  from:      string;
  to:        string;
  employees: EmployeeExport[];
}

export interface EmployeeExport {
  employee_id:   string;
  name:          string;
  employee_type: string;
  department:    string;
  records:       unknown[];
}

// ─── Constants ───────────────────────────────────────────────
const DEDUP_MINUTES = 5;
const MAX_SHIFT_MS  = 18 * 60 * 60 * 1000;

// ─── Pure Helpers (exported for unit tests) ───────────────────

export function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export function dedupPunches(punches: PunchLog[]): { kept: PunchLog[]; filtered: PunchLog[] } {
  const kept: PunchLog[]     = [];
  const filtered: PunchLog[] = [];
  let lastTime = -Infinity;

  for (const p of punches) {
    const t    = toMs(p.punched_at);
    const diff = (t - lastTime) / 60000;
    if (diff >= DEDUP_MINUTES) {
      kept.push(p);
      lastTime = t;
    } else {
      filtered.push(p);
    }
  }
  return { kept, filtered };
}

export function assignColumns(
  punches: PunchLog[],
): Pick<DtrRecord, 'am_in' | 'am_out' | 'pm_in' | 'pm_out'> {
  const n = punches.length;
  if (n === 0) return { am_in: null, am_out: null, pm_in: null, pm_out: null };
  if (n === 1) return { am_in: punches[0].punched_at, am_out: null, pm_in: null, pm_out: null };
  if (n === 2) return { am_in: punches[0].punched_at, am_out: null, pm_in: null, pm_out: punches[1].punched_at };
  if (n === 3) return { am_in: punches[0].punched_at, am_out: null, pm_in: null, pm_out: punches[2].punched_at };
  return {
    am_in:  punches[0].punched_at,
    am_out: punches[1].punched_at,
    pm_in:  punches[n - 2].punched_at,
    pm_out: punches[n - 1].punched_at,
  };
}

export function buildDtrRecords(punches: PunchLog[]): DtrRecord[] {
  if (!punches.length) return [];

  const byDate = new Map<string, PunchLog[]>();
  for (const p of punches) {
    const date = p.punched_at.split('T')[0];
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(p);
  }

  const dates       = Array.from(byDate.keys()).sort();
  const records: DtrRecord[] = [];
  const borrowedIds = new Set<number>();

  for (let d = 0; d < dates.length; d++) {
    const date       = dates[d];
    const dayPunches = byDate.get(date)!.filter((p) => !borrowedIds.has(p.id));
    if (!dayPunches.length) continue;

    const last      = dayPunches[dayPunches.length - 1];
    const nextDate  = dates[d + 1];
    const nextDay   = nextDate ? byDate.get(nextDate)!.filter((p) => !borrowedIds.has(p.id)) : [];
    const nextFirst = nextDay[0] ?? null;

    let nextDayRecord: DtrRecord | null = null;

    const nextHour = nextFirst ? new Date(nextFirst.punched_at).getHours() : -1;
    if (dayPunches.length === 1 && nextHour >= 4 && nextHour <= 10 && nextFirst) {
      const gap = toMs(nextFirst.punched_at) - toMs(last.punched_at);
      if (gap > 0 && gap <= MAX_SHIFT_MS) {
        borrowedIds.add(nextFirst.id);
        nextDayRecord = {
          date:   nextDate,
          am_in:  null,
          am_out: null,
          pm_in:  null,
          pm_out: nextFirst.punched_at,
        };
      }
    }

    records.push({ date, ...assignColumns(dayPunches) });
    if (nextDayRecord) records.push(nextDayRecord);
  }

  const merged = new Map<string, DtrRecord>();
  for (const rec of records) {
    if (!merged.has(rec.date)) {
      merged.set(rec.date, { ...rec });
    } else {
      const existing = merged.get(rec.date)!;
      if (!existing.am_in  && rec.am_in)  existing.am_in  = rec.am_in;
      if (!existing.am_out && rec.am_out) existing.am_out = rec.am_out;
      if (!existing.pm_in  && rec.pm_in)  existing.pm_in  = rec.pm_in;
      if (!existing.pm_out && rec.pm_out) existing.pm_out = rec.pm_out;
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Service Functions ────────────────────────────────────────

export async function computeDtr(): Promise<{ records: number; message: string }> {
  const db = getDb();

  const rawPunches: PunchLog[] = await db.all(`
    SELECT id, employee_id, punched_at
    FROM   punch_logs
    WHERE  used = 0 AND filtered = 0
    ORDER  BY employee_id ASC, punched_at ASC
  `);

  if (!rawPunches.length) {
    return { records: 0, message: 'No new punches to process.' };
  }

  const byEmployee = new Map<string, PunchLog[]>();
  for (const p of rawPunches) {
    if (!byEmployee.has(p.employee_id)) byEmployee.set(p.employee_id, []);
    byEmployee.get(p.employee_id)!.push(p);
  }

  let recordsInserted    = 0;
  const usedIds:     number[] = [];
  const filteredIds: number[] = [];

  for (const [, empPunches] of byEmployee) {
    const { kept, filtered } = dedupPunches(empPunches);
    filteredIds.push(...filtered.map((p) => p.id));
    const dtrRecords = buildDtrRecords(kept);
    for (const rec of dtrRecords) {
      recordsInserted++;
    }
    usedIds.push(...kept.map((p) => p.id));
  }

  // Rebuild per-employee data for transactional write
  await db.run('BEGIN');
  try {
    for (const [, empPunches] of byEmployee) {
      const { kept, filtered } = dedupPunches(empPunches);
      const dtrRecords = buildDtrRecords(kept);

      for (const rec of dtrRecords) {
        await db.run(
          `INSERT INTO dtr_records (employee_id, date, am_in, am_out, pm_in, pm_out)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [empPunches[0].employee_id, rec.date, rec.am_in, rec.am_out, rec.pm_in, rec.pm_out],
        );
      }
    }

    if (usedIds.length) {
      await db.run(
        `UPDATE punch_logs SET used = 1 WHERE id IN (${usedIds.map(() => '?').join(',')})`,
        usedIds,
      );
    }
    if (filteredIds.length) {
      await db.run(
        `UPDATE punch_logs SET filtered = 1 WHERE id IN (${filteredIds.map(() => '?').join(',')})`,
        filteredIds,
      );
    }

    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }

  logger.info(`DTR computed: ${recordsInserted} records inserted.`);
  return { records: recordsInserted, message: 'DTR computed successfully.' };
}

export async function getPunchLogs(
  filter: string,
  page: number,
  limit: number,
): Promise<PaginatedResult<unknown>> {
  const db     = getDb();
  const offset = (page - 1) * limit;

  let where = '';
  if (filter === 'processed') where = 'WHERE p.used = 1 AND p.filtered = 0';
  else if (filter === 'pending')  where = 'WHERE p.used = 0 AND p.filtered = 0';
  else if (filter === 'filtered') where = 'WHERE p.filtered = 1';

  // ✅ FIX: use separate awaits instead of destructuring db.get() which returns T | undefined
  const countRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) AS total FROM punch_logs p JOIN employees e ON e.id = p.employee_id ${where}`,
  );
  const total = countRow?.total ?? 0;

  const data = await db.all(
    `SELECT p.id, p.employee_id, e.name, dep.name AS department,
            p.punched_at, p.used, p.filtered
     FROM   punch_logs p
     JOIN   employees  e   ON e.id   = p.employee_id
     LEFT JOIN departments dep ON dep.id = e.department_id
     ${where}
     ORDER BY p.punched_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDtrRecords(
  page: number,
  limit: number,
): Promise<PaginatedResult<unknown>> {
  const db     = getDb();
  const offset = (page - 1) * limit;

  // ✅ FIX: same pattern — separate await, safe optional chaining
  const countRow = await db.get<{ total: number }>(`SELECT COUNT(*) AS total FROM dtr_records`);
  const total    = countRow?.total ?? 0;

  const data = await db.all(
    `SELECT d.id, d.employee_id, e.name, e.employee_type,
            dep.name AS department, d.date, d.am_in, d.am_out, d.pm_in, d.pm_out
     FROM   dtr_records  d
     JOIN   employees    e   ON e.id   = d.employee_id
     LEFT JOIN departments dep ON dep.id = e.department_id
     ORDER BY d.date DESC, e.name ASC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDtrByEmployee(employeeId: string): Promise<unknown[]> {
  const db = getDb();
  return db.all(
    `SELECT d.id, d.employee_id, e.name, d.date, d.am_in, d.am_out, d.pm_in, d.pm_out
     FROM   dtr_records d
     JOIN   employees   e ON e.id = d.employee_id
     WHERE  d.employee_id = ?
     ORDER BY d.date ASC`,
    [employeeId],
  );
}

export async function exportDtr(params: {
  from:           string;
  to:             string;
  department_id?: number;
  employee_type?: string;
}): Promise<ExportDtrResult> {
  const db = getDb();

  let query = `
    SELECT d.employee_id, e.name, e.employee_type,
           dep.name AS department,
           d.date, d.am_in, d.am_out, d.pm_in, d.pm_out
    FROM   dtr_records  d
    JOIN   employees    e   ON e.id   = d.employee_id
    LEFT JOIN departments dep ON dep.id = e.department_id
    WHERE  d.date BETWEEN ? AND ?
  `;
  const queryParams: (string | number)[] = [params.from, params.to];

  if (params.department_id) {
    query += ` AND e.department_id = ?`;
    queryParams.push(params.department_id);
  }
  if (params.employee_type) {
    query += ` AND e.employee_type = ?`;
    queryParams.push(params.employee_type);
  }
  query += ` ORDER BY e.name ASC, d.date ASC`;

  const records = await db.all(query, queryParams);

  const byEmployee = new Map<string, EmployeeExport>();
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

  return { from: params.from, to: params.to, employees: Array.from(byEmployee.values()) };
}