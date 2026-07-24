import { Routes } from '@angular/router';

export const profilesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../feature/profile-page').then((m) => m.ProfilePage),
  },
];
