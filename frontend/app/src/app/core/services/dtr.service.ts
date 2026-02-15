import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DtrRecord {
  id:          number;
  employee_id: string;
  name:        string;
  date:        string;
  time_in:     string | null;
  time_out:    string | null;
  total_hours: number | null;
}

export interface ComputeResult {
  status:  string;
  message: string;
  records: number;
}

@Injectable({ providedIn: 'root' })
export class DtrService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getAll(): Observable<DtrRecord[]> {
    return this.http.get<DtrRecord[]>(`${this.base}/dtr`).pipe(
      catchError(() => of([]))
    );
  }

  compute(): Observable<ComputeResult> {
    return this.http.post<ComputeResult>(`${this.base}/dtr/compute`, {}).pipe(
      catchError(() => of({ status: 'error', message: 'Compute failed', records: 0 }))
    );
  }
}