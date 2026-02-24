import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EmployeeService, Employee, Department } from '../../core/services/employee.service';
import { DtrService } from '../../core/services/dtr.service';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export.component.html',
  styleUrl: './export.component.css'
})
export class ExportComponent implements OnInit, OnDestroy {
  private employeeService = inject(EmployeeService);
  private dtrService      = inject(DtrService);

  employees   = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  loading     = signal(true);
  printing    = signal(false);
  error       = signal('');

  // Filters — public so template can set directly
  employeeType       = signal<string>('permanent');
  selectedDepartment = signal<number | null>(null);

  // Selection
  selectedEmployees = signal<Set<string>>(new Set());
  focusedEmployee   = signal<string | null>(null);
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  // Date range
  fromDate = signal('');
  toDate   = signal('');

  filtered = computed(() => {
    let data = this.employees().filter(e => e.employee_type === this.employeeType());

    if (this.selectedDepartment()) {
      const deptName = this.departments().find(d => d.id === this.selectedDepartment())?.name;
      data = data.filter(e => e.department === deptName);
    }

    return data.sort((a, b) => {
      const deptA = a.department || 'Unassigned';
      const deptB = b.department || 'Unassigned';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  });

  grouped = computed(() => {
    const map = new Map<string, Employee[]>();
    for (const emp of this.filtered()) {
      const dept = emp.department || 'Unassigned';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(emp);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  });

  ngOnInit(): void { this.loadData(); }

  ngOnDestroy(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [empRes, deptRes] = await Promise.all([
        firstValueFrom(this.employeeService.getAll()),
        firstValueFrom(this.employeeService.getAllDepartments()),
      ]);
      this.employees.set(empRes.data ?? []);
      this.departments.set(deptRes.data ?? []);
    } catch {
      this.error.set('Failed to load employees. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  onDepartmentChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    this.selectedDepartment.set(value ? Number(value) : null);
    this.clearSelection();
  }

  // ─── Focus-based selection (2-second hold) ────────────────

  onEmployeeFocus(empId: string): void {
    this.focusedEmployee.set(empId);
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      this.toggleEmployee(empId);
      this.focusedEmployee.set(null);
    }, 2000);
  }

  onEmployeeBlur(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusedEmployee.set(null);
  }

  toggleEmployee(empId: string): void {
    const selected = new Set(this.selectedEmployees());
    selected.has(empId) ? selected.delete(empId) : selected.add(empId);
    this.selectedEmployees.set(selected);
  }

  isSelected(empId: string): boolean { return this.selectedEmployees().has(empId); }
  clearSelection(): void             { this.selectedEmployees.set(new Set()); }
  selectAll(): void {
    this.selectedEmployees.set(new Set(this.filtered().map(e => e.id)));
  }

  // ─── Print ────────────────────────────────────────────────

  print(): void {
    this.error.set('');

    if (!this.fromDate() || !this.toDate()) {
      this.error.set('Please select a date range.');
      return;
    }
    if (this.selectedEmployees().size === 0) {
      this.error.set('Please select at least one employee.');
      return;
    }

    this.printing.set(true);

    this.dtrService.print({
      employee_ids:  Array.from(this.selectedEmployees()),
      employee_type: this.employeeType(),
      from:          this.fromDate(),
      to:            this.toDate(),
    }).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `DTR_${this.fromDate()}_to_${this.toDate()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.printing.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to generate PDF. Please try again.');
        this.printing.set(false);
      }
    });
  }

  onFromDateChange(e: Event): void { this.fromDate.set((e.target as HTMLInputElement).value); }
  onToDateChange(e: Event):   void { this.toDate.set((e.target as HTMLInputElement).value); }
}