import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.apiUrl;

  isAuthenticated = signal(false);

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/auth/login`, { username, password }, { withCredentials: true }).pipe(
      tap(() => this.isAuthenticated.set(true)),
      catchError(err => {
        this.isAuthenticated.set(false);
        throw err;
      })
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.base}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.isAuthenticated.set(false)),
      catchError(() => of(null))
    );
  }

  checkSession(): Observable<any> {
    return this.http.get(`${this.base}/auth/me`, { withCredentials: true }).pipe(
      tap(() => this.isAuthenticated.set(true)),
      catchError(() => {
        this.isAuthenticated.set(false);
        return of(null);
      })
    );
  }
}