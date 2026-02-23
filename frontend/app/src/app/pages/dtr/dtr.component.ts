import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DtrService, DtrRecord } from '../../core/services/dtr.service';

interface Employee {
  id:   string;
  name: string;
}

@Component({
  selector: 'app-dtr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dtr.component.html',
  styleUrl: './dtr.component.css'
})
export class DtrComponent implements OnInit {
  private dtrService = inject(DtrService);

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

  // Filters — applied server-side via loadData()
  selectedEmployee = signal('');
  fromDate         = signal('');
  toDate           = signal('');
  sortAsc          = signal(false);

  // Client-side sort only (data is already filtered server-side)
  sorted = computed(() =>
    [...this.records()].sort((a, b) => {
      const dc = this.sortAsc() ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      return dc !== 0 ? dc : a.name.localeCompare(b.name);
    })
  );

  ngOnInit(): void { this.loadData(); }

  loadData(page = 1): void {
    this.loading.set(true);
    this.error.set('');

    this.dtrService.getAll(page, this.pageSize).subscribe({
      next: (res) => {
        this.records.set(res.data);
        this.currentPage.set(res.page);
        this.totalPages.set(res.totalPages);
        this.total.set(res.total);
        this.loading.set(false);

        // Build unique employee list from loaded records for the filter dropdown
        const empMap = new Map<string, string>();
        res.data.forEach(r => empMap.set(r.employee_id, r.name));
        this.employees.set(Array.from(empMap.entries()).map(([id, name]) => ({ id, name })));
      },
      error: () => {
        this.error.set('Failed to load DTR records. Please try again.');
        this.loading.set(false);
      }
    });
  }

  // ─── Filtering ────────────────────────────────────────────
  // Filters are applied client-side on the current page only.
  // For full cross-page filtering, use the Export page instead.

  filtered = computed(() => {
    let data = this.records();
    if (this.selectedEmployee()) data = data.filter(r => r.employee_id === this.selectedEmployee());
    if (this.fromDate())         data = data.filter(r => r.date >= this.fromDate());
    if (this.toDate())           data = data.filter(r => r.date <= this.toDate());
    return data;
  });

  clearFilters(): void {
    this.selectedEmployee.set('');
    this.fromDate.set('');
    this.toDate.set('');
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

  onEmployeeChange(e: Event): void { this.selectedEmployee.set((e.target as HTMLSelectElement).value); }
  onFromDateChange(e: Event): void { this.fromDate.set((e.target as HTMLInputElement).value); }
  onToDateChange(e: Event):   void { this.toDate.set((e.target as HTMLInputElement).value); }
}