import { parse } from 'csv-parse/sync';
import { getDb } from '../../database/db';

// ─── Types ────────────────────────────────────────────────────

export interface ParsedPunch {
  employee_id: string;
  name:        string;
  punched_at:  string;
}

export interface UploadResult {
  inserted:  number;
  skipped:   number;
  employees: number;
}

// ─── Constants ────────────────────────────────────────────────
const DEDUP_WINDOW_MINUTES = 5;

// ─── Helpers ──────────────────────────────────────────────────

function diffMinutes(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
}

/**
 * Normalize a raw CSV row into { employee_id, name, punched_at }
 * Format A (new): employee_id, name, timestamp
 * Format B (old): employeeId,  name, date, time
 */
function normalizeRow(row: Record<string, string>): ParsedPunch | null {
  if (row.timestamp) {
    const employee_id = (row.employee_id ?? row.employeeId ?? '').trim();
    const name        = (row.name ?? '').trim();
    const punched_at  = row.timestamp.trim();
    if (!employee_id || !name || !punched_at) return null;
    return { employee_id, name, punched_at };
  }

  if (row.date && row.time) {
    const employee_id = (row.employee_id ?? row.employeeId ?? '').trim();
    const name        = (row.name ?? '').trim();
    const punched_at  = `${row.date.trim()}T${row.time.trim()}`;
    if (!employee_id || !name) return null;
    return { employee_id, name, punched_at };
  }

  return null;
}

// ─── Service ──────────────────────────────────────────────────

export async function parseCsv(fileBuffer: Buffer): Promise<ParsedPunch[]> {
  const rawRows: Record<string, string>[] = parse(fileBuffer, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
  });

  if (!rawRows.length) throw new Error('CSV file is empty or has no valid rows.');

  const normalized = rawRows.map(normalizeRow).filter(Boolean) as ParsedPunch[];

  if (!normalized.length) {
    throw new Error('No valid rows found. Check CSV column names (employee_id, name, timestamp).');
  }

  normalized.sort(
    (a, b) => a.employee_id.localeCompare(b.employee_id) || a.punched_at.localeCompare(b.punched_at),
  );

  return normalized;
}

export async function uploadToDatabase(punches: ParsedPunch[]): Promise<UploadResult> {
  const db = getDb();

  const uniqueEmployees = new Map<string, string>();
  for (const p of punches) uniqueEmployees.set(p.employee_id, p.name);

  for (const [id, name] of uniqueEmployees) {
    await db.run(
      `INSERT INTO employees (id, name)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
      [id, name],
    );
  }

  let inserted = 0;
  let skipped  = 0;
  const lastPunch = new Map<string, string>();

  for (const p of punches) {
    const last = lastPunch.get(p.employee_id);
    if (last && diffMinutes(last, p.punched_at) < DEDUP_WINDOW_MINUTES) {
      skipped++;
      continue;
    }
    await db.run(
      `INSERT INTO punch_logs (employee_id, punched_at, used, filtered) VALUES (?, ?, 0, 0)`,
      [p.employee_id, p.punched_at],
    );
    lastPunch.set(p.employee_id, p.punched_at);
    inserted++;
  }

  return { inserted, skipped, employees: uniqueEmployees.size };
}
