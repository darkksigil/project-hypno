import { Router, Request, Response } from 'express';
import puppeteer from 'puppeteer';
const { getDb } = require('../../database/db');

const router = Router();

interface PrintRequest {
  employee_ids:  string[];
  employee_type: string;
  from:          string;
  to:            string;
}

// Generate HTML for CSC Form No. 48
function generateDtrHtml(employeeData: any): string {
  const { name, employee_id, employee_type, department, records } = employeeData;
  
  // Create table rows for each date
  const rows = records.map((r: any) => `
    <tr>
      <td class="td-date">${formatDate(r.date)}</td>
      <td class="td-time">${formatTime(r.am_in)}</td>
      <td class="td-time">${formatTime(r.am_out)}</td>
      <td class="td-time">${formatTime(r.pm_in)}</td>
      <td class="td-time">${formatTime(r.pm_out)}</td>
      <td class="td-absence"></td>
      <td class="td-undertime"></td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9pt; }
    
    .header {
      text-align: center;
      margin-bottom: 8px;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
    }
    .header h1 { font-size: 12pt; margin-bottom: 2px; }
    .header h2 { font-size: 10pt; font-weight: normal; margin-bottom: 4px; }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 9pt;
    }
    .info-row span { font-weight: bold; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th, td {
      border: 1px solid #000;
      padding: 4px;
      text-align: center;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 8pt;
      text-transform: uppercase;
    }
    .th-main { font-size: 9pt; }
    .td-date { text-align: left; font-size: 8pt; }
    .td-time { font-family: 'Courier New', monospace; font-size: 8pt; }
    .td-absence, .td-undertime { width: 40px; }
    
    .footer {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .signature {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid #000;
    }
    .signature-label { font-size: 8pt; margin-top: 4px; }
    
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CIVIL SERVICE FORM NO. 48</h1>
    <h2>DAILY TIME RECORD</h2>
  </div>
  
  <div class="info-row">
    <div>Name: <span>${name}</span></div>
    <div>Employee ID: <span>${employee_id}</span></div>
  </div>
  <div class="info-row">
    <div>Department: <span>${department || 'Unassigned'}</span></div>
    <div>Type: <span>${employee_type.toUpperCase()}</span></div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th rowspan="2" class="th-main">Date</th>
        <th colspan="2" class="th-main">A.M.</th>
        <th colspan="2" class="th-main">P.M.</th>
        <th rowspan="2" class="th-main">Absence</th>
        <th rowspan="2" class="th-main">Undertime</th>
      </tr>
      <tr>
        <th>IN</th>
        <th>OUT</th>
        <th>IN</th>
        <th>OUT</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  
  <div class="footer">
    <div>
      <div class="signature">
        <div>_________________________</div>
        <div class="signature-label">Employee Signature</div>
      </div>
    </div>
    <div>
      <div class="signature">
        <div>_________________________</div>
        <div class="signature-label">Supervisor Signature</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// POST /dtr/print - Generate PDF for selected employees
router.post('/print', async (req: Request, res: Response) => {
  try {
    const { employee_ids, employee_type, from, to }: PrintRequest = req.body;

    if (!employee_ids || !from || !to) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const db = getDb();

    // Fetch DTR records for selected employees
    const placeholders = employee_ids.map(() => '?').join(',');
    const query = `
      SELECT d.employee_id, e.name, e.employee_type,
             dep.name AS department,
             d.date, d.am_in, d.am_out, d.pm_in, d.pm_out
      FROM   dtr_records  d
      JOIN   employees    e   ON e.id   = d.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      WHERE  d.employee_id IN (${placeholders})
        AND  d.date BETWEEN ? AND ?
        AND  e.employee_type = ?
      ORDER BY e.name ASC, d.date ASC
    `;

    const params = [...employee_ids, from, to, employee_type];
    const records = await db.all(query, params);

    // Group by employee
    const byEmployee = new Map<string, any>();
    for (const r of records) {
      if (!byEmployee.has(r.employee_id)) {
        byEmployee.set(r.employee_id, {
          employee_id:   r.employee_id,
          name:          r.name,
          employee_type: r.employee_type,
          department:    r.department,
          records:       [],
        });
      }
      byEmployee.get(r.employee_id).records.push(r);
    }

    // Generate HTML pages (one per employee)
    const employees = Array.from(byEmployee.values());
    const htmlPages = employees.map((emp, idx) => {
      const html = generateDtrHtml(emp);
      // Add page break except for last page
      return idx < employees.length - 1 
        ? html.replace('</body>', '<div class="page-break"></div></body>')
        : html;
    });

    const fullHtml = htmlPages.join('');

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    await browser.close();

    // Send PDF
    res.contentType('application/pdf');
    res.send(pdf);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router;