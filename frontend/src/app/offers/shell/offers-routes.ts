import { Routes } from '@angular/router';

export const offersRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../feature/offers-page').then((m) => m.OffersPage),
  },
  {
    path: 'angebote',
    loadComponent: () => import('../feature/offer-list-page').then((m) => m.OfferListPage),
  },
];
