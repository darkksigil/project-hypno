import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Employee {
  id:            string;
  name:          string;
  department:    string | null;
  employee_type: string;
}

interface Department {
  id:   number;
  name: string;
}

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export.component.html',
  styleUrl: './export.component.css'
})
export class ExportComponent implements OnInit {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  employees      = signal<Employee[]>([]);
  departments    = signal<Department[]>([]);
  loading        = signal(true);
  printing       = signal(false);

  // Filters
  employeeType        = signal<'permanent' | 'cos'>('permanent');
  filterByDepartment  = signal(false);
  selectedDepartment  = signal<number | null>(null);

  // Selection
  selectedEmployees = signal<Set<string>>(new Set());
  focusedEmployee   = signal<string | null>(null);
  focusTimer:       any = null;

  // Date range
  fromDate = signal('');
  toDate   = signal('');

  // Computed filtered employees
  filtered = computed(() => {
    let data = this.employees().filter(e => e.employee_type === this.employeeType());
    
    if (this.filterByDepartment() && this.selectedDepartment()) {
      const deptName = this.departments().find(d => d.id === this.selectedDepartment())?.name;
      data = data.filter(e => e.department === deptName);
    }

    // Sort by department, then name
    return data.sort((a, b) => {
      const deptA = a.department || 'Unassigned';
      const deptB = b.department || 'Unassigned';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  });

  // Group by department for display
  grouped = computed(() => {
    const map = new Map<string, Employee[]>();
    for (const emp of this.filtered()) {
      const dept = emp.department || 'Unassigned';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(emp);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    Promise.all([
      this.http.get<Employee[]>(`${this.base}/employees`).toPromise(),
      this.http.get<Department[]>(`${this.base}/departments`).toPromise()
    ]).then(([emps, depts]) => {
      this.employees.set(emps || []);
      this.departments.set(depts || []);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  toggleEmployeeType(): void {
    this.employeeType.set(this.employeeType() === 'permanent' ? 'cos' : 'permanent');
    this.clearSelection();
  }

  toggleDepartmentFilter(): void {
    this.filterByDepartment.set(!this.filterByDepartment());
    if (!this.filterByDepartment()) {
      this.selectedDepartment.set(null);
    }
    this.clearSelection();
  }

  onDepartmentChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    this.selectedDepartment.set(value ? Number(value) : null);
    this.clearSelection();
  }

  // Focus-based selection (2-second hold)
  onEmployeeFocus(empId: string): void {
    this.focusedEmployee.set(empId);
    
    // Clear existing timer
    if (this.focusTimer) clearTimeout(this.focusTimer);
    
    // Start 2-second timer
    this.focusTimer = setTimeout(() => {
      this.toggleEmployee(empId);
      this.focusedEmployee.set(null);
    }, 2000);
  }

  onEmployeeBlur(): void {
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.focusedEmployee.set(null);
  }

  // Manual toggle (click)
  toggleEmployee(empId: string): void {
    const selected = new Set(this.selectedEmployees());
    if (selected.has(empId)) {
      selected.delete(empId);
    } else {
      selected.add(empId);
    }
    this.selectedEmployees.set(selected);
  }

  isSelected(empId: string): boolean {
    return this.selectedEmployees().has(empId);
  }

  clearSelection(): void {
    this.selectedEmployees.set(new Set());
  }

  selectAll(): void {
    const ids = new Set(this.filtered().map(e => e.id));
    this.selectedEmployees.set(ids);
  }

  print(): void {
    if (!this.fromDate() || !this.toDate()) {
      alert('Please select date range');
      return;
    }

    if (this.selectedEmployees().size === 0) {
      alert('Please select at least one employee');
      return;
    }

    this.printing.set(true);

    const payload = {
      employee_ids:  Array.from(this.selectedEmployees()),
      employee_type: this.employeeType(),
      from:          this.fromDate(),
      to:            this.toDate()
    };

    this.http.post(`${this.base}/dtr/print`, payload, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        // Download PDF
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `DTR_${this.fromDate()}_to_${this.toDate()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.printing.set(false);
      },
      error: () => {
        alert('Failed to generate PDF');
        this.printing.set(false);
      }
    });
  }

  onFromDateChange(e: Event): void { this.fromDate.set((e.target as HTMLInputElement).value); }
  onToDateChange(e: Event):   void { this.toDate.set((e.target as HTMLInputElement).value); }
}