// src/app/core/services/csv.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface UploadResult {
  status:    string;
  message:   string;
  inserted:  number;
  skipped:   number;
  employees: number;
}

@Injectable({ providedIn: 'root' })
export class CsvService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  upload(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<UploadResult>(`${this.base}/csv/upload`, formData).pipe(
      catchError(err => {
        console.error(err);
        return of({ status: 'error', message: String(err), inserted: 0, skipped: 0, employees: 0 });
      })
    );
  }
}