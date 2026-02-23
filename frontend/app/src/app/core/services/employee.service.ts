import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Types ────────────────────────────────────────────────────

export interface Employee {
  id:            string;
  name:          string;
  employee_type: string;
  department_id: number | null;
  department:    string | null;
}

export interface Department {
  id:   number;
  name: string;
}

export interface WrappedList<T> {
  status: string;
  data:   T[];
}

export interface UpdateEmployeePayload {
  employee_type?: string;
  department_id?: number | null;
  name?:          string;
}

// ─── Service ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getAll(): Observable<WrappedList<Employee>> {
    return this.http.get<WrappedList<Employee>>(`${this.base}/employees`);
  }

  getById(id: string): Observable<{ status: string; data: Employee }> {
    return this.http.get<{ status: string; data: Employee }>(`${this.base}/employees/${id}`);
  }

  update(id: string, payload: UpdateEmployeePayload): Observable<{ status: string; message: string }> {
    return this.http.put<{ status: string; message: string }>(`${this.base}/employees/${id}`, payload);
  }

  getAllDepartments(): Observable<WrappedList<Department>> {
    return this.http.get<WrappedList<Department>>(`${this.base}/departments`);
  }

  addDepartment(name: string): Observable<{ status: string; id: number; name: string }> {
    return this.http.post<{ status: string; id: number; name: string }>(`${this.base}/departments`, { name });
  }

  deleteDepartment(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/departments/${id}`);
  }
}