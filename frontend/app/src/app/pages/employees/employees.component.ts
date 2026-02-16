import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Employee {
  id:            string;
  name:          string;
  employee_type: string;
  department_id: number | null;
  department:    string | null;
  // local edit state
  editing?:      boolean;
  editType?:     string;
  editDeptId?:   number | null;
  saving?:       boolean;
}

interface Department {
  id:   number;
  name: string;
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.css'
})
export class EmployeesComponent implements OnInit {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  employees    = signal<Employee[]>([]);
  departments  = signal<Department[]>([]);
  loading      = signal(true);

  // Department management
  newDeptName  = signal('');
  deptSaving   = signal(false);
  deptMsg      = signal('');
  deptError    = signal(false);

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.http.get<Employee[]>(`${this.base}/employees`).subscribe((data: Employee[]) => {
      this.employees.set(data.map(e => ({ ...e, editing: false })));
      this.loading.set(false);
    });
    this.http.get<Department[]>(`${this.base}/departments`).subscribe((data: Department[]) => {
      this.departments.set(data);
    });
  }

  // ─── Department management ────────────────────────────────

  addDepartment(): void {
    const name = this.newDeptName().trim();
    if (!name) return;
    this.deptSaving.set(true);
    this.deptMsg.set('');
    this.http.post<{ status: string; id: number; name: string }>(`${this.base}/departments`, { name }).subscribe({
      next: (result) => {
        this.departments.update(deps => [...deps, { id: result.id, name: result.name }]);
        this.newDeptName.set('');
        this.deptSaving.set(false);
        this.deptMsg.set(`"${result.name}" added.`);
        this.deptError.set(false);
      },
      error: (err) => {
        this.deptMsg.set(err.error?.message ?? 'Failed to add department.');
        this.deptError.set(true);
        this.deptSaving.set(false);
      }
    });
  }

  deleteDepartment(id: number, name: string): void {
    if (!confirm(`Delete department "${name}"? Employees in this department will be unassigned.`)) return;
    this.http.delete(`${this.base}/departments/${id}`).subscribe({
      next: () => {
        this.departments.update(deps => deps.filter(d => d.id !== id));
        this.employees.update(emps => emps.map(e =>
          e.department_id === id ? { ...e, department_id: null, department: null } : e
        ));
      }
    });
  }

  // ─── Employee editing ─────────────────────────────────────

  startEdit(emp: Employee): void {
    this.employees.update(emps => emps.map(e =>
      e.id === emp.id
        ? { ...e, editing: true, editType: e.employee_type, editDeptId: e.department_id }
        : e
    ));
  }

  cancelEdit(emp: Employee): void {
    this.employees.update(emps => emps.map(e =>
      e.id === emp.id ? { ...e, editing: false } : e
    ));
  }

  saveEdit(emp: Employee): void {
    this.employees.update(emps => emps.map(e =>
      e.id === emp.id ? { ...e, saving: true } : e
    ));

    this.http.put(`${this.base}/employees/${emp.id}`, {
      employee_type: emp.editType,
      department_id: emp.editDeptId ?? null
    }).subscribe({
      next: () => {
        const dept = this.departments().find(d => d.id === emp.editDeptId) ?? null;
        this.employees.update(emps => emps.map(e =>
          e.id === emp.id ? {
            ...e,
            employee_type: emp.editType!,
            department_id: emp.editDeptId ?? null,
            department:    dept?.name ?? null,
            editing:       false,
            saving:        false,
          } : e
        ));
      },
      error: () => {
        this.employees.update(emps => emps.map(e =>
          e.id === emp.id ? { ...e, saving: false } : e
        ));
      }
    });
  }

  onTypeChange(emp: Employee, e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    this.employees.update(emps => emps.map(em =>
      em.id === emp.id ? { ...em, editType: val } : em
    ));
  }

  onDeptChange(emp: Employee, e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    this.employees.update(emps => emps.map(em =>
      em.id === emp.id ? { ...em, editDeptId: val ? Number(val) : null } : em
    ));
  }

  onNewDeptChange(e: Event): void {
    this.newDeptName.set((e.target as HTMLInputElement).value);
  }

  onDeptKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.addDepartment();
  }
}