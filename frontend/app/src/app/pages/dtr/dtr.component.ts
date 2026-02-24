import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DtrService, DtrRecord } from '../../core/services/dtr.service';
import { EmployeeService, Employee } from '../../core/services/employee.service';

@Component({
  selector: 'app-dtr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dtr.component.html',
  styleUrl: './dtr.component.css'
})
export class DtrComponent implements OnInit {
  private dtrService     = inject(DtrService);
  private employeeService = inject(EmployeeService);

  records      = signal<DtrRecord[]>([]);
  employees    = signal<Employee[]>([]);
  loading      = signal(true);
  error        = signal('');
  computing    = signal(false);
  computeMsg   = signal('');
  computeError = signal(false);

  // Pagination
  currentPage = signal(1);
  totalPages  = signal(1);
  total       = signal(0);
  readonly pageSize = 50;

  // Filters
  selectedEmployee = signal('');
  fromDate         = signal('');
  toDate           = signal('');
  sortAsc          = signal(false);

  // When an employee is selected, filter client-side across ALL their records.
  // When no employee is selected, show the paginated server response.
  filtered = computed(() => {
    let data = this.records();
    if (this.fromDate()) data = data.filter(r => r.date >= this.fromDate());
    if (this.toDate())   data = data.filter(r => r.date <= this.toDate());
    return data;
  });

  sorted = computed(() =>
    [...this.filtered()].sort((a, b) => {
      const dc = this.sortAsc() ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      return dc !== 0 ? dc : a.name.localeCompare(b.name);
    })
  );

  ngOnInit(): void {
    this.loadEmployees();
    this.loadData();
  }

  // Load full employee list once for the filter dropdown — independent of pagination
  loadEmployees(): void {
    this.employeeService.getAll().subscribe({
      next:  (res) => this.employees.set(
        [...res.data].sort((a, b) => a.name.localeCompare(b.name))
      ),
      error: () => {}
    });
  }

  // When no employee selected: paginated full list from server.
  // When employee selected: fetch ALL their records from server, then
  // date filters are applied client-side via filtered() computed.
  loadData(page = 1): void {
    this.loading.set(true);
    this.error.set('');

    const empId = this.selectedEmployee();

    if (empId) {
      // Server already returns all records for this employee — no pagination needed
      this.dtrService.getByEmployee(empId).subscribe({
        next: (res) => {
          this.records.set(res.data);
          this.currentPage.set(1);
          this.totalPages.set(1);
          this.total.set(res.data.length);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load records for this employee.');
          this.loading.set(false);
        }
      });
    } else {
      this.dtrService.getAll(page, this.pageSize).subscribe({
        next: (res) => {
          this.records.set(res.data);
          this.currentPage.set(res.page);
          this.totalPages.set(res.totalPages);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load DTR records. Please try again.');
          this.loading.set(false);
        }
      });
    }
  }

  clearFilters(): void {
    this.selectedEmployee.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.loadData(1);
  }

  // ─── Pagination ───────────────────────────────────────────

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadData(page);
  }

  // ─── Compute DTR ──────────────────────────────────────────

  computeDtr(): void {
    this.computing.set(true);
    this.computeMsg.set('');
    this.computeError.set(false);

    this.dtrService.compute().subscribe({
      next: (result) => {
        this.computeMsg.set(result.message);
        this.computeError.set(result.status !== 'ok');
        this.computing.set(false);
        if (result.records > 0) this.loadData(1);
      },
      error: () => {
        this.computeMsg.set('Compute failed. Check backend.');
        this.computeError.set(true);
        this.computing.set(false);
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  toggleSort(): void { this.sortAsc.set(!this.sortAsc()); }

  formatTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  isIncomplete(r: DtrRecord): boolean { return !r.am_in && !r.pm_in; }

  onEmployeeChange(e: Event): void {
    this.selectedEmployee.set((e.target as HTMLSelectElement).value);
    this.loadData(1); // re-fetch from server with new employee context
  }
  onFromDateChange(e: Event): void { this.fromDate.set((e.target as HTMLInputElement).value); }
  onToDateChange(e: Event):   void { this.toDate.set((e.target as HTMLInputElement).value); }
}