import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Types ────────────────────────────────────────────────────

export interface ParsedPunch {
  employee_id: string;
  name:        string;
  punched_at:  string;
}

export interface ParseResult {
  status:  string;
  count:   number;
  preview: ParsedPunch[];
  data:    ParsedPunch[];
}

export interface UploadResult {
  status:    string;
  inserted:  number;
  skipped:   number;
  employees: number;
}

// ─── Service ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CsvService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Parse CSV and return preview — no DB write */
  parse(file: File): Observable<ParseResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ParseResult>(`${this.base}/csv/parse`, formData);
  }

  /** Parse CSV and save to DB in one step */
  upload(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResult>(`${this.base}/csv/upload`, formData);
  }
}