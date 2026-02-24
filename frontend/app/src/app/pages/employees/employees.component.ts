import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { EmployeeService, Employee, Department } from '../../core/services/employee.service';

// ─── Toast form state ─────────────────────────────────────────
interface EditForm {
  empId:        string;
  surname:      string;
  first_name:   string;
  middle_name:  string;
  birthday:     string;
  department_id: number | null;
  employee_type: string;
  saving:       boolean;
}

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

  // Department management
  newDeptName = signal('');
  deptSaving  = signal(false);
  deptMsg     = signal('');
  deptError   = signal(false);

  // Toast/drawer edit form — null means closed
  editForm = signal<EditForm | null>(null);

  // Search / filter
  search = signal('');

  filteredEmployees = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.employees();
    return this.employees().filter(e =>
      e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    this.employeeService.getAll().subscribe({
      next:  (res) => { this.employees.set(res.data); this.loading.set(false); },
      error: ()    => { this.error.set('Failed to load employees.'); this.loading.set(false); }
    });

    this.employeeService.getAllDepartments().subscribe({
      next:  (res) => this.departments.set(res.data),
      error: ()    => {}
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
    if (!confirm(`Delete "${name}"? Employees will be unassigned.`)) return;

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

  // ─── Toast form ───────────────────────────────────────────

  openEdit(emp: Employee): void {
    this.editForm.set({
      empId:         emp.id,
      surname:       emp.surname    ?? '',
      first_name:    emp.first_name ?? '',
      middle_name:   emp.middle_name ?? '',
      birthday:      emp.birthday   ?? '',
      department_id: emp.department_id,
      employee_type: emp.employee_type,
      saving:        false,
    });
  }

  closeEdit(): void { this.editForm.set(null); }

  saveEdit(): void {
    const form = this.editForm();
    if (!form || form.saving) return;

    if (!form.surname.trim() || !form.first_name.trim()) {
      return; // buttons disabled, but guard anyway
    }

    this.editForm.update(f => f ? { ...f, saving: true } : null);

    this.employeeService.update(form.empId, {
      surname:       form.surname.trim(),
      first_name:    form.first_name.trim(),
      middle_name:   form.middle_name.trim() || undefined,
      birthday:      form.birthday || undefined,
      department_id: form.department_id,
      employee_type: form.employee_type,
    }).subscribe({
      next: () => {
        // Derive display name locally to match backend logic
        const last  = form.surname.trim().toUpperCase();
        const first = form.first_name.trim();
        const mi    = form.middle_name.trim();
        const middle = mi ? ` ${mi.charAt(0).toUpperCase()}.` : '';
        const displayName = `${last}, ${first}${middle}`;

        const dept = this.departments().find(d => d.id === form.department_id) ?? null;

        this.employees.update(emps => emps.map(e =>
          e.id === form.empId ? {
            ...e,
            name:          displayName,
            surname:       form.surname.trim(),
            first_name:    form.first_name.trim(),
            middle_name:   form.middle_name.trim() || null,
            birthday:      form.birthday || null,
            employee_type: form.employee_type,
            department_id: form.department_id,
            department:    dept?.name ?? null,
          } : e
        ));

        this.closeEdit();
      },
      error: (err) => {
        this.editForm.update(f => f ? { ...f, saving: false } : null);
        this.error.set(err.error?.message ?? 'Failed to save changes.');
      }
    });
  }

  // ─── Form field helpers ───────────────────────────────────

  setField(field: keyof EditForm, value: string | number | null): void {
    this.editForm.update(f => f ? { ...f, [field]: value } : null);
  }

  isFormValid(): boolean {
    const f = this.editForm();
    return !!f && f.surname.trim().length > 0 && f.first_name.trim().length > 0;
  }

  onSearchChange(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }

  onDeptKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.addDepartment();
  }
}