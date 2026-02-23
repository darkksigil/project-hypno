import { Request, Response } from 'express';
import { asyncHandler }      from '../middlewares/error.middleware';
import { printSchema }       from '../validators/print.validator';
import * as printService     from '../services/print.service';
import logger                from '../utils/logger';

// ─── GET /dtr/test-pdf ────────────────────────────────────────

export const testPdf = asyncHandler(async (_req: Request, res: Response) => {
  logger.info('[TEST-PDF] Starting Puppeteer test...');

  const dummy: printService.EmployeeDtrData = {
    employee_id:   'TEST-001',
    name:          'Juan dela Cruz',
    employee_type: 'permanent',
    department:    'Test Department',
    records: [
      { date: '2026-01-01', am_in: null,                  am_out: null,                  pm_in: null,                  pm_out: null },
      { date: '2026-01-02', am_in: '2026-01-02T08:00:00', am_out: '2026-01-02T12:00:00', pm_in: '2026-01-02T13:00:00', pm_out: '2026-01-02T17:00:00' },
      { date: '2026-01-03', am_in: '2026-01-03T08:05:00', am_out: '2026-01-03T12:00:00', pm_in: '2026-01-03T13:00:00', pm_out: '2026-01-03T17:00:00' },
    ],
  };

  const html = printService.generateDtrHtml(dummy, '2026-01-01', '2026-01-15');
  const pdf  = await printService.generatePdf([html]);

  logger.info(`[TEST-PDF] Success — ${pdf.length} bytes`);
  sendPdf(res, pdf, 'test-dtr.pdf');
});

// ─── POST /dtr/print ─────────────────────────────────────────

export const printDtr = asyncHandler(async (req: Request, res: Response) => {
  logger.info('[PRINT] Request received:', req.body);

  const params    = printSchema.parse(req.body);
  const employees = await printService.getEmployeeDtrData(params);

  logger.info(`[PRINT] Generating PDF for ${employees.length} employees`);

  const htmlPages = employees.map((emp, idx) => {
    const html = printService.generateDtrHtml(emp, params.from, params.to);
    return idx < employees.length - 1
      ? html.replace('</body>', '<div class="page-break"></div></body>')
      : html;
  });

  const pdf = await printService.generatePdf(htmlPages);

  logger.info(`[PRINT] PDF generated — ${pdf.length} bytes`);
  sendPdf(res, pdf, 'dtr-report.pdf');
});

// ─── Shared helper ────────────────────────────────────────────

function sendPdf(res: Response, pdf: Buffer, filename: string): void {
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length':      pdf.length,
  });
  res.send(pdf);
}