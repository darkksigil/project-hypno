import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeService, Employee } from '../../core/services/employee.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employees.component.html',
  styleUrl: './employees.component.css'
})
export class EmployeesComponent implements OnInit {
  private employeeService = inject(EmployeeService);

  employees = signal<Employee[]>([]);
  loading   = signal(true);

  ngOnInit(): void {
    this.employeeService.getAll().subscribe((data: Employee[]) => {
      this.employees.set(data);
      this.loading.set(false);
    });
  }
}