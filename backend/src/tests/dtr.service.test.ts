import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Database } from 'sqlite';
import { createTestDb, seedEmployee } from './helpers/db.helper';

// ─── Mock getDb so services use our in-memory DB ──────────────
//
// Every service imports getDb() from database/db.  We intercept
// that import and return our test DB instance instead.
// This way the real sqlite file is never touched during tests.

let testDb: Database;

vi.mock('../../database/db', () => ({
  getDb: () => testDb,
}));

// Import AFTER the mock is set up
import {
  computeDtr,
  getPunchLogs,
  getDtrRecords,
  getDtrByEmployee,
} from '../services/dtr.service';

// ─── Setup ────────────────────────────────────────────────────

beforeEach(async () => {
  testDb = await createTestDb();
  await seedEmployee(testDb, { id: 'E001', name: 'Juan dela Cruz', department: 'Engineering' });
  await seedEmployee(testDb, { id: 'E002', name: 'Maria Santos',   employee_type: 'casual' });
});

// ─── computeDtr ───────────────────────────────────────────────

describe('computeDtr', () => {
  it('returns early with no punches', async () => {
    const result = await computeDtr();
    expect(result.records).toBe(0);
    expect(result.message).toMatch(/no new punches/i);
  });

  it('inserts DTR records and marks punches as used', async () => {
    await testDb.run(
      `INSERT INTO punch_logs (employee_id, punched_at) VALUES (?, ?), (?, ?)`,
      ['E001', '2026-01-02T08:00:00', 'E001', '2026-01-02T17:00:00'],
    );

    const result = await computeDtr();
    expect(result.records).toBe(1);

    const dtr = await testDb.get(`SELECT * FROM dtr_records WHERE employee_id = 'E001'`);
    expect(dtr.date).toBe('2026-01-02');
    expect(dtr.am_in).toBe('2026-01-02T08:00:00');
    expect(dtr.pm_out).toBe('2026-01-02T17:00:00');

    const punch = await testDb.get(`SELECT used FROM punch_logs WHERE id = 1`);
    expect(punch.used).toBe(1);
  });

  it('filters duplicate punches within 5 minutes and marks them filtered', async () => {
    await testDb.run(
      `INSERT INTO punch_logs (employee_id, punched_at) VALUES (?, ?), (?, ?), (?, ?)`,
      [
        'E001', '2026-01-02T08:00:00',
        'E001', '2026-01-02T08:03:00', // within 5 min → filtered
        'E001', '2026-01-02T17:00:00',
      ],
    );

    await computeDtr();

    const filtered = await testDb.get(`SELECT * FROM punch_logs WHERE filtered = 1`);
    expect(filtered.punched_at).toBe('2026-01-02T08:03:00');
  });

  it('does not reprocess already-used punches', async () => {
    await testDb.run(
      `INSERT INTO punch_logs (employee_id, punched_at, used) VALUES (?, ?, 1)`,
      ['E001', '2026-01-02T08:00:00'],
    );

    const result = await computeDtr();
    expect(result.records).toBe(0);
  });
});

// ─── getPunchLogs ─────────────────────────────────────────────

describe('getPunchLogs', () => {
  beforeEach(async () => {
    await testDb.run(
      `INSERT INTO punch_logs (employee_id, punched_at, used, filtered) VALUES
        ('E001', '2026-01-02T08:00:00', 0, 0),
        ('E001', '2026-01-02T08:03:00', 0, 1),
        ('E001', '2026-01-02T17:00:00', 1, 0)`,
    );
  });

  it('returns all punches with filter=all', async () => {
    const result = await getPunchLogs('all', 1, 50);
    expect(result.total).toBe(3);
  });

  it('returns only pending with filter=pending', async () => {
    const result = await getPunchLogs('pending', 1, 50);
    expect(result.total).toBe(1);
    expect((result.data[0] as any).punched_at).toBe('2026-01-02T08:00:00');
  });

  it('returns only processed with filter=processed', async () => {
    const result = await getPunchLogs('processed', 1, 50);
    expect(result.total).toBe(1);
  });

  it('returns only filtered with filter=filtered', async () => {
    const result = await getPunchLogs('filtered', 1, 50);
    expect(result.total).toBe(1);
  });

  it('paginates correctly', async () => {
    const result = await getPunchLogs('all', 1, 2);
    expect(result.data).toHaveLength(2);
    expect(result.totalPages).toBe(2);
  });
});

// ─── getDtrRecords ────────────────────────────────────────────

describe('getDtrRecords', () => {
  it('returns empty result when no records exist', async () => {
    const result = await getDtrRecords(1, 50);
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  it('returns inserted records', async () => {
    await testDb.run(
      `INSERT INTO dtr_records (employee_id, date, am_in, pm_out) VALUES (?, ?, ?, ?)`,
      ['E001', '2026-01-02', '2026-01-02T08:00:00', '2026-01-02T17:00:00'],
    );

    const result = await getDtrRecords(1, 50);
    expect(result.total).toBe(1);
    expect((result.data[0] as any).date).toBe('2026-01-02');
  });
});

// ─── getDtrByEmployee ─────────────────────────────────────────

describe('getDtrByEmployee', () => {
  it('returns records for the correct employee only', async () => {
    await testDb.run(
      `INSERT INTO dtr_records (employee_id, date, am_in, pm_out) VALUES
        ('E001', '2026-01-02', '2026-01-02T08:00:00', '2026-01-02T17:00:00'),
        ('E002', '2026-01-02', '2026-01-02T08:00:00', '2026-01-02T17:00:00')`,
    );

    const records = await getDtrByEmployee('E001');
    expect(records).toHaveLength(1);
    expect((records[0] as any).employee_id).toBe('E001');
  });

  it('returns empty array for unknown employee', async () => {
    const records = await getDtrByEmployee('UNKNOWN');
    expect(records).toHaveLength(0);
  });
});