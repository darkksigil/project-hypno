import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService, Employee, Department } from '../../core/services/employee.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.css'
})
export class EmployeesComponent implements OnInit {
  private employeeService = inject(EmployeeService);

  employees   = signal<Employee[]>([]);
  departments = signal<Department[]>([]);
  loading     = signal(true);
  error       = signal('');

  newDeptName = signal('');
  deptSaving  = signal(false);
  deptMsg     = signal('');
  deptError   = signal(false);

  // Local edit state stored separately so Employee interface stays clean
  editState = signal<Record<string, { type: string; deptId: number | null; saving: boolean }>>({});

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    this.employeeService.getAll().subscribe({
      next: (res) => {
        this.employees.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load employees. Please try again.');
        this.loading.set(false);
      }
    });

    this.employeeService.getAllDepartments().subscribe({
      next: (res) => this.departments.set(res.data),
      error: () => {} // non-critical, departments list just stays empty
    });
  }

  // ─── Department management ────────────────────────────────

  addDepartment(): void {
    const name = this.newDeptName().trim();
    if (!name) return;
    this.deptSaving.set(true);
    this.deptMsg.set('');

    this.employeeService.addDepartment(name).subscribe({
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

    this.employeeService.deleteDepartment(id).subscribe({
      next: () => {
        this.departments.update(deps => deps.filter(d => d.id !== id));
        this.employees.update(emps => emps.map(e =>
          e.department_id === id ? { ...e, department_id: null, department: null } : e
        ));
      },
      error: (err) => {
        this.deptMsg.set(err.error?.message ?? 'Failed to delete department.');
        this.deptError.set(true);
      }
    });
  }

  // ─── Employee editing ─────────────────────────────────────

  isEditing(empId: string): boolean { return !!this.editState()[empId]; }
  isSaving(empId: string):  boolean { return !!this.editState()[empId]?.saving; }

  startEdit(emp: Employee): void {
    this.editState.update(s => ({
      ...s,
      [emp.id]: { type: emp.employee_type, deptId: emp.department_id, saving: false }
    }));
  }

  cancelEdit(empId: string): void {
    this.editState.update(s => {
      const next = { ...s };
      delete next[empId];
      return next;
    });
  }

  saveEdit(emp: Employee): void {
    const state = this.editState()[emp.id];
    if (!state) return;

    this.editState.update(s => ({ ...s, [emp.id]: { ...s[emp.id], saving: true } }));

    this.employeeService.update(emp.id, {
      employee_type: state.type,
      department_id: state.deptId ?? null,
    }).subscribe({
      next: () => {
        const dept = this.departments().find(d => d.id === state.deptId) ?? null;
        this.employees.update(emps => emps.map(e =>
          e.id === emp.id ? {
            ...e,
            employee_type: state.type,
            department_id: state.deptId ?? null,
            department:    dept?.name ?? null,
          } : e
        ));
        this.cancelEdit(emp.id);
      },
      error: (err) => {
        this.editState.update(s => ({ ...s, [emp.id]: { ...s[emp.id], saving: false } }));
        this.deptMsg.set(err.error?.message ?? 'Failed to save changes.');
        this.deptError.set(true);
      }
    });
  }

  getEditType(empId: string):   string       { return this.editState()[empId]?.type ?? ''; }
  getEditDeptId(empId: string): number | null { return this.editState()[empId]?.deptId ?? null; }

  onTypeChange(empId: string, e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    this.editState.update(s => ({ ...s, [empId]: { ...s[empId], type: val } }));
  }

  onDeptChange(empId: string, e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    this.editState.update(s => ({ ...s, [empId]: { ...s[empId], deptId: val ? Number(val) : null } }));
  }

  onNewDeptChange(e: Event): void {
    this.newDeptName.set((e.target as HTMLInputElement).value);
  }

  onDeptKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.addDepartment();
  }
}