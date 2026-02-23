import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Types ────────────────────────────────────────────────────

// Matches the actual backend response shape
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

export interface PunchLog {
  id:          number;
  employee_id: string;
  name:        string;
  department:  string | null;
  punched_at:  string;
  used:        number;
  filtered:    number;
}

export interface PaginatedResponse<T> {
  status:     string;
  data:       T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface ComputeResult {
  status:  string;
  message: string;
  records: number;
}

export type FilterMode = 'all' | 'pending' | 'processed' | 'filtered';

// ─── Service ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DtrService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getAll(page = 1, limit = 50): Observable<PaginatedResponse<DtrRecord>> {
    return this.http.get<PaginatedResponse<DtrRecord>>(
      `${this.base}/dtr?page=${page}&limit=${limit}`
    );
  }

  getByEmployee(employeeId: string): Observable<{ status: string; data: DtrRecord[] }> {
    return this.http.get<{ status: string; data: DtrRecord[] }>(
      `${this.base}/dtr/${employeeId}`
    );
  }

  getLogs(filter: FilterMode, page = 1, limit = 50): Observable<PaginatedResponse<PunchLog>> {
    return this.http.get<PaginatedResponse<PunchLog>>(
      `${this.base}/dtr/logs?filter=${filter}&page=${page}&limit=${limit}`
    );
  }

  compute(): Observable<ComputeResult> {
    return this.http.post<ComputeResult>(`${this.base}/dtr/compute`, {});
  }

  export(params: {
    from:           string;
    to:             string;
    department_id?: number;
    employee_type?: string;
  }): Observable<unknown> {
    const query = new URLSearchParams({ from: params.from, to: params.to });
    if (params.department_id) query.set('department_id', String(params.department_id));
    if (params.employee_type) query.set('employee_type', params.employee_type);
    return this.http.get(`${this.base}/dtr/export?${query}`);
  }

  print(payload: {
    employee_ids:  string[];
    employee_type: string;
    from:          string;
    to:            string;
  }): Observable<Blob> {
    return this.http.post(`${this.base}/dtr/print`, payload, { responseType: 'blob' });
  }
}