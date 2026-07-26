import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MessageService, ToastMessageOptions } from 'primeng/api';

import { Run } from '../../shared/domain/run';
import { Offer } from '../domain/offer';
import { OffersStore } from './offers-store';

const en = {
  offers: {
    collectError: 'The run failed. Check the GMX credentials and connection.',
    toast: {
      successSummary: 'Run completed',
      successDetail: '{{newOffers}} new offers imported from {{totalSeen}} mails · {{analyzed}} analyzed',
      errorSummary: 'Run failed',
    },
  },
};

const OFFER: Offer = {
  id: 1,
  receivedAt: '2026-07-22T09:15:00Z',
  fromAddr: 'office@freelancermap.de',
  subject: 'Neues Projekt passend zu Ihrem Suchprofil "Angular"',
  sourceType: 'AGENT',
  agentName: 'Angular',
  projectTitle: 'Senior Angular Entwickler',
  company: 'softwareXperts GmbH',
  role: null,
  location: 'Hamburg',
  country: 'DE',
  remote: 'REMOTE',
  rate: null,
  startDate: null,
  duration: null,
  projectUrl: 'https://www.freelancermap.de/nproj/3026991.html',
  matchScore: null,
  matchReason: null,
  seniority: null,
  industry: null,
  primary: true,
  dupCount: 1,
  status: 'NEW',
  skills: [],
};

const RUN: Run = {
  id: 1,
  ranAt: '2026-07-22T10:00:00Z',
  newOffers: 1,
  totalSeen: 1,
  analyzedOffers: 0,
  inputTokens: 0,
  outputTokens: 0,
  note: 'since=2026-07-22',
};

describe('OffersStore', () => {
  let store: OffersStore;
  let httpMock: HttpTestingController;
  let toasts: ToastMessageOptions[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), MessageService],
    });
    store = TestBed.inject(OffersStore);
    httpMock = TestBed.inject(HttpTestingController);
    toasts = [];
    TestBed.inject(MessageService).messageObserver.subscribe((message) => toasts.push(message as ToastMessageOptions));
  });

  afterEach(() => httpMock.verify());

  // httpResource issues its GETs from an effect: tick() runs it, then we answer
  // and await stability so the resource values propagate to the signals.
  // Die Profil-Liste lädt nur beim ersten Tick (und nach switchProfile) — daher
  // per match() statt expectOne() beantworten.
  async function respondToReloads(offers: Offer[], run: Run | null): Promise<void> {
    TestBed.tick();
    httpMock
      .match((req) => req.method === 'GET' && req.url === '/api/profiles')
      .forEach((request) => request.flush([{ id: 1, name: 'Standard', active: true }]));
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/offers').flush(offers);
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/runs/latest').flush(run);
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('exposes offers and the latest run loaded from the API', async () => {
    await respondToReloads([OFFER], RUN);

    expect(store.offers()).toEqual([OFFER]);
    expect(store.latestRun()).toEqual(RUN);
    expect(store.isLoading()).toBe(false);
  });

  it('triggers a run, reloads, and toasts the import numbers', async () => {
    await respondToReloads([], null);

    store.collect();
    expect(store.isCollecting()).toBe(true);

    const post = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/runs');
    post.flush(RUN);

    await respondToReloads([OFFER], RUN);
    expect(store.isCollecting()).toBe(false);
    expect(store.offers()).toEqual([OFFER]);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].severity).toBe('success');
    expect(toasts[0].detail).toBe('1 new offers imported from 1 mails · 0 analyzed');
  });

  it('switches the profile and reloads offers from its perspective', async () => {
    await respondToReloads([], null);

    store.switchProfile(2);

    httpMock
      .expectOne((req) => req.method === 'POST' && req.url === '/api/profiles/2/activate')
      .flush({ id: 2, name: 'Fullstack', active: true });

    TestBed.tick();
    httpMock
      .match((req) => req.method === 'GET' && req.url === '/api/profiles')
      .forEach((request) =>
        request.flush([
          { id: 1, name: 'Standard', active: false },
          { id: 2, name: 'Fullstack', active: true },
        ]),
      );
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/offers').flush([OFFER]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.profileOptions().find((profile) => profile.active)?.name).toBe('Fullstack');
    expect(store.offers()).toEqual([OFFER]);
  });

  it('toasts the server problem detail when the run fails', async () => {
    await respondToReloads([], null);

    store.collect();

    httpMock
      .expectOne((req) => req.method === 'POST' && req.url === '/api/runs')
      .flush({ detail: 'IMAP-Abruf von imap.gmx.net fehlgeschlagen' }, { status: 502, statusText: 'Bad Gateway' });

    expect(store.isCollecting()).toBe(false);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].severity).toBe('error');
    expect(toasts[0].detail).toBe('IMAP-Abruf von imap.gmx.net fehlgeschlagen');
  });

  it('falls back to the generic error message without a problem detail', async () => {
    await respondToReloads([], null);

    store.collect();

    httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/runs').flush(null, { status: 0, statusText: 'Network error' });

    expect(toasts[0].severity).toBe('error');
    expect(toasts[0].detail).toBe('The run failed. Check the GMX credentials and connection.');
  });
});
