import { Routes } from '@angular/router';

export const routes: Routes = [
  // Dashboard: offers fetched from the Spring Boot `/api` (dev-server proxy in
  // proxy.conf.json). Sheriff scope `offers` with domain / data-access / ui /
  // feature / shell (see sheriff.config.ts).
  {
    path: '',
    loadChildren: () => import('./offers/shell/offers-routes').then((m) => m.offersRoutes),
  },
  // Profil-Verwaltung: Profile anlegen/bearbeiten/aktivieren und den Bestand
  // gegen ein Profil neu bewerten. Sheriff scope `profiles`.
  {
    path: 'profil',
    loadChildren: () => import('./profiles/shell/profiles-routes').then((m) => m.profilesRoutes),
  },
];
