import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dtr',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dtr/dtr.component').then(m => m.DtrComponent)
  },
  {
    path: 'employees',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/employees/employees.component').then(m => m.EmployeesComponent)
  },
  {
    path: 'upload',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent)
  },
  {
    path: 'logs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/logs/logs.component').then(m => m.LogsComponent)
  },
  { path: '**', redirectTo: 'dtr' }
];