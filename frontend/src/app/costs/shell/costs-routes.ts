import { Routes } from '@angular/router';

export const costsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../feature/costs-page').then((m) => m.CostsPage),
  },
];
