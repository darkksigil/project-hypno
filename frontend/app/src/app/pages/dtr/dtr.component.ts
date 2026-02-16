import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DtrRecord {
  id:            number;
  employee_id:   string;
  name:          string;
  employee_type: string;
  department:    string | null;
  date:          string;
  am_in:         string | null;
  am_out:        string | null;
  pm_in:         string | null;
  pm_out:        string | null;
}

export interface Employee {
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
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  records   = signal<DtrRecord[]>([]);
  employees = signal<Employee[]>([]);
  loading   = signal(true);
  computing = signal(false);
  computeMsg = signal('');
  computeError = signal(false);

  selectedEmployee = signal('');
  fromDate         = signal('');
  toDate           = signal('');

  filtered = computed(() => {
    let data = this.records();
    if (this.selectedEmployee()) data = data.filter((r: DtrRecord) => r.employee_id === this.selectedEmployee());
    if (this.fromDate()) data = data.filter((r: DtrRecord) => r.date >= this.fromDate());
    if (this.toDate())   data = data.filter((r: DtrRecord) => r.date <= this.toDate());
    return data;
  });

  sortAsc = signal(false);

  sorted = computed(() => {
    const data = [...this.filtered()];
    return data.sort((a, b) => {
      const dateCompare = this.sortAsc()
        ? a.date.localeCompare(b.date)
         : b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.name.localeCompare(b.name); // same date → sort by name
    });
  });

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.http.get<DtrRecord[]>(`${this.base}/dtr`).subscribe({
      next: (records: DtrRecord[]) => {
        this.records.set(records);
        this.loading.set(false);
        // Build unique employee list from records
        const empMap = new Map<string, string>();
        records.forEach(r => empMap.set(r.employee_id, r.name));
        this.employees.set(Array.from(empMap.entries()).map(([id, name]) => ({ id, name })));
      },
      error: () => this.loading.set(false)
    });
  }

  computeDtr(): void {
    this.computing.set(true);
    this.computeMsg.set('');
    this.computeError.set(false);
    this.http.post<{ status: string; message: string; records: number }>(`${this.base}/dtr/compute`, {}).subscribe({
      next: (result) => {
        this.computeMsg.set(result.message);
        this.computeError.set(result.status !== 'ok');
        this.computing.set(false);
        if (result.records > 0) this.loadData();
      },
      error: () => {
        this.computeMsg.set('Compute failed. Check backend.');
        this.computeError.set(true);
        this.computing.set(false);
      }
    });
  }

  clearFilters(): void {
    this.selectedEmployee.set('');
    this.fromDate.set('');
    this.toDate.set('');
  }

  toggleSort(): void {
  this.sortAsc.set(!this.sortAsc());
  }

  formatTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  isIncomplete(r: DtrRecord): boolean {
    return !r.am_in && !r.pm_in;
  }

  onEmployeeChange(e: Event): void { this.selectedEmployee.set((e.target as HTMLSelectElement).value); }
  onFromDateChange(e: Event): void { this.fromDate.set((e.target as HTMLInputElement).value); }
  onToDateChange(e: Event):   void { this.toDate.set((e.target as HTMLInputElement).value); }
}