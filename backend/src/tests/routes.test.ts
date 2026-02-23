import { describe, it, expect, beforeEach, vi } from 'vitest';
import request  from 'supertest';
import { Database } from 'sqlite';
import { createTestDb, seedEmployee } from './helpers/db.helper';

// ─── Mocks — must be declared before any app imports ──────────

let testDb: Database;

vi.mock('../../database/db', () => ({
  getDb:  () => testDb,
  initDb: async () => {},
}));

vi.mock('../middlewares/auth.middleware', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Import app AFTER all mocks are registered ────────────────
import app from '../app';

// ─── Setup ────────────────────────────────────────────────────

beforeEach(async () => {
  testDb = await createTestDb();
  await seedEmployee(testDb, { id: 'E001', name: 'Juan dela Cruz', department: 'Engineering' });
});

// ─── GET /api/dtr ─────────────────────────────────────────────

describe('GET /api/dtr', () => {
  it('returns 200 with empty data when no records', async () => {
    const res = await request(app).get('/api/dtr');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data).toHaveLength(0);
  });

  it('returns paginated DTR records', async () => {
    await testDb.run(
      `INSERT INTO dtr_records (employee_id, date, am_in, pm_out) VALUES (?, ?, ?, ?)`,
      ['E001', '2026-01-02', '2026-01-02T08:00:00', '2026-01-02T17:00:00'],
    );

    const res = await request(app).get('/api/dtr?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

// ─── GET /api/dtr/:employeeId ─────────────────────────────────

describe('GET /api/dtr/:employeeId', () => {
  it('returns 404 for unknown employee', async () => {
    const res = await request(app).get('/api/dtr/UNKNOWN');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns records for a known employee', async () => {
    await testDb.run(
      `INSERT INTO dtr_records (employee_id, date, am_in, pm_out) VALUES (?, ?, ?, ?)`,
      ['E001', '2026-01-02', '2026-01-02T08:00:00', '2026-01-02T17:00:00'],
    );

    const res = await request(app).get('/api/dtr/E001');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── GET /api/dtr/logs ────────────────────────────────────────

describe('GET /api/dtr/logs', () => {
  it('returns 200 with valid filter', async () => {
    const res = await request(app).get('/api/dtr/logs?filter=all&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns 400 with invalid filter value', async () => {
    const res = await request(app).get('/api/dtr/logs?filter=invalid');
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/dtr/compute ────────────────────────────────────

describe('POST /api/dtr/compute', () => {
  it('returns 200 with no punches to process', async () => {
    const res = await request(app).post('/api/dtr/compute');
    expect(res.status).toBe(200);
    expect(res.body.records).toBe(0);
  });

  it('processes punches and returns inserted count', async () => {
    await testDb.run(
      `INSERT INTO punch_logs (employee_id, punched_at) VALUES (?, ?), (?, ?)`,
      ['E001', '2026-01-02T08:00:00', 'E001', '2026-01-02T17:00:00'],
    );

    const res = await request(app).post('/api/dtr/compute');
    expect(res.status).toBe(200);
    expect(res.body.records).toBe(1);
  });
});

// ─── GET /api/employees ───────────────────────────────────────

describe('GET /api/employees', () => {
  it('returns seeded employee', async () => {
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Juan dela Cruz');
  });
});

// ─── GET /api/employees/:id ───────────────────────────────────

describe('GET /api/employees/:id', () => {
  it('returns 200 for existing employee', async () => {
    const res = await request(app).get('/api/employees/E001');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Juan dela Cruz');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/employees/GHOST');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ─── PUT /api/employees/:id ───────────────────────────────────

describe('PUT /api/employees/:id', () => {
  it('updates employee name', async () => {
    const res = await request(app)
      .put('/api/employees/E001')
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    const check = await request(app).get('/api/employees/E001');
    expect(check.body.data.name).toBe('Updated Name');
  });

  it('returns 400 for invalid employee_type', async () => {
    const res = await request(app)
      .put('/api/employees/E001')
      .send({ employee_type: 'invalid_type' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for extra unknown fields (strict schema)', async () => {
    const res = await request(app)
      .put('/api/employees/E001')
      .send({ name: 'Test', hacked: true });

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown employee id', async () => {
    const res = await request(app)
      .put('/api/employees/GHOST')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/health ──────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns ok when DB is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── 404 handler ──────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 with NOT_FOUND code', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});