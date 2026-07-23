import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Offer, Run } from '../domain/offer';
import { OffersStore } from './offers-store';

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(OffersStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // httpResource issues its GETs from an effect: tick() runs it, then we answer
  // and await stability so the resource values propagate to the signals.
  async function respondToReloads(offers: Offer[], run: Run | null): Promise<void> {
    TestBed.tick();
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

  it('triggers a run and reloads offers and latest run', async () => {
    await respondToReloads([], null);

    store.collect();
    expect(store.isCollecting()).toBe(true);

    const post = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/runs');
    post.flush(RUN);

    await respondToReloads([OFFER], RUN);
    expect(store.isCollecting()).toBe(false);
    expect(store.hasCollectError()).toBe(false);
    expect(store.offers()).toEqual([OFFER]);
  });

  it('flags a failed collect without reloading', async () => {
    await respondToReloads([], null);

    store.collect();

    httpMock
      .expectOne((req) => req.method === 'POST' && req.url === '/api/runs')
      .flush({ detail: 'IMAP down' }, { status: 502, statusText: 'Bad Gateway' });

    expect(store.isCollecting()).toBe(false);
    expect(store.hasCollectError()).toBe(true);
  });
});
