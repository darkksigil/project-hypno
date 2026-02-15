import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dtr', pathMatch: 'full' },
  {
    path: 'dtr',
    loadComponent: () => import('./pages/dtr/dtr.component').then(m => m.DtrComponent)
  },
  {
    path: 'employees',
    loadComponent: () => import('./pages/employees/employees.component').then(m => m.EmployeesComponent)
  },
  {
    path: 'upload',
    loadComponent: () => import('./pages/upload/upload.component').then(m => m.UploadComponent)
  },
  { path: '**', redirectTo: 'dtr' }
];