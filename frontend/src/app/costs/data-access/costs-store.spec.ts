import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Run } from '../../shared/domain/run';
import { CostsStore } from './costs-store';

const RUN: Run = {
  id: 1,
  ranAt: '2026-07-22T10:00:00Z',
  newOffers: 1,
  totalSeen: 1,
  analyzedOffers: 1,
  detailsFetched: 0,
  detailsFailed: 0,
  inputTokens: 12000,
  outputTokens: 800,
  note: 'since=2026-07-22',
};

describe('CostsStore', () => {
  let store: CostsStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(CostsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('exposes the runs loaded from the API', async () => {
    TestBed.tick();
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/runs').flush([RUN]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.runs()).toEqual([RUN]);
    expect(store.isLoading()).toBe(false);
  });

  it('reloads the runs on demand — a run can be triggered from outside this page', async () => {
    TestBed.tick();
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/runs').flush([]);
    await TestBed.inject(ApplicationRef).whenStable();

    store.reload();
    TestBed.tick();

    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/runs').flush([RUN]);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.runs()).toEqual([RUN]);
  });
});
