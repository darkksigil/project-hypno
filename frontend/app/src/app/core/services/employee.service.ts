// src/app/core/services/employee.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Employee {
  id:   string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.base}/employees`).pipe(
      catchError(() => of([]))
    );
  }
}