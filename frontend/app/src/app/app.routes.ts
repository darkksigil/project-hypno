import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth.guard';

export const routes: Routes = [
  // Public route
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },

  // Redirect root to employees (guard will intercept if not authenticated)
  {
    path: '',
    redirectTo: 'employees',
    pathMatch: 'full',
  },

  // Protected routes
  {
    path: 'employees',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/employees/employees.component').then((m) => m.EmployeesComponent),
  },
  {
    path: 'dtr',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dtr/dtr.component').then((m) => m.DtrComponent),
  },
  {
    path: 'logs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/logs/logs.component').then((m) => m.LogsComponent),
  },
  {
    path: 'upload',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/upload/upload.component').then((m) => m.UploadComponent),
  },

  // Catch-all
  {
    path: '**',
    redirectTo: 'login',
  },
];