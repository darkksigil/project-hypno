import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DtrService, DtrRecord } from '../../core/services/dtr.service';
import { EmployeeService, Employee } from '../../core/services/employee.service';

@Component({
  selector: 'app-dtr',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './dtr.component.html',
  styleUrl: './dtr.component.css'
})
export class DtrComponent implements OnInit {
  private dtrService      = inject(DtrService);
  private employeeService = inject(EmployeeService);

  records    = signal<DtrRecord[]>([]);
  employees  = signal<Employee[]>([]);
  loading    = signal(true);
  computing  = signal(false);
  computeMsg = signal('');

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

  totalHours = computed(() =>
    this.filtered().reduce((sum: number, r: DtrRecord) => sum + (r.total_hours ?? 0), 0)
  );

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading.set(true);
    this.dtrService.getAll().subscribe((records: DtrRecord[]) => {
      this.records.set(records);
      this.loading.set(false);
    });
    this.employeeService.getAll().subscribe((employees: Employee[]) => {
      this.employees.set(employees);
    });
  }

  computeDtr(): void {
    this.computing.set(true);
    this.computeMsg.set('');
    this.dtrService.compute().subscribe((result: { status: string; message: string; records: number }) => {
      this.computeMsg.set(result.message);
      this.computing.set(false);
      if (result.records > 0) this.loadData();
    });
  }

  clearFilters(): void {
    this.selectedEmployee.set('');
    this.fromDate.set('');
    this.toDate.set('');
  }

  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric', weekday: 'short'
    });
  }

  onEmployeeChange(e: Event): void { this.selectedEmployee.set((e.target as HTMLSelectElement).value); }
  onFromDateChange(e: Event): void { this.fromDate.set((e.target as HTMLInputElement).value); }
  onToDateChange(e: Event):   void { this.toDate.set((e.target as HTMLInputElement).value); }
}