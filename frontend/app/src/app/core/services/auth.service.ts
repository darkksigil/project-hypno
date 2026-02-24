import { Injectable, inject, signal } from '@angular/core';
import { HttpClient }                  from '@angular/common/http';
import { Observable, of }              from 'rxjs';
import { catchError, tap }             from 'rxjs/operators';
import { environment }                 from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base  = environment.apiUrl;

  isAuthenticated = signal(false);

  // withCredentials is handled globally by credentialsInterceptor in main.ts
  // No need to pass it manually on each call

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/auth/login`, { username, password }).pipe(
      tap(() => this.isAuthenticated.set(true)),
      catchError((err) => {
        this.isAuthenticated.set(false);
        throw err;
      }),
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.base}/auth/logout`, {}).pipe(
      tap(() => this.isAuthenticated.set(false)),
      catchError(() => of(null)),
    );
  }

  checkSession(): Observable<any> {
    return this.http.get(`${this.base}/auth/me`).pipe(
      tap(() => this.isAuthenticated.set(true)),
      catchError(() => {
        this.isAuthenticated.set(false);
        return of(null);
      }),
    );
  }
}