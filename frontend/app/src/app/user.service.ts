// src/app/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { config } from './app.config';

export interface User {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl = config.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/users`).pipe(
      catchError(err => {
        console.error('Error fetching users:', err);
        return of([]); // fallback
      })
    );
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`).pipe(
      catchError(err => {
        console.error('Error checking health:', err);
        return of({ status: 'error', db: 'failed' });
      })
    );
  }
}
