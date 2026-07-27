import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MessageService, ToastMessageOptions } from 'primeng/api';

import { Profile } from '../domain/profile';
import { ProfilesStore } from './profiles-store';

const en = {
  profiles: {
    reanalysis: {
      error: 'The re-analysis failed.',
      toast: {
        successSummary: 'Re-analysis completed',
        successDetail: '{{analyzed}} offers re-scored',
        errorSummary: 'Re-analysis failed',
      },
    },
  },
};

const STANDARD: Profile = {
  id: 1,
  name: 'Standard',
  role: 'Frontend Architect',
  focus: null,
  industries: null,
  region: 'DACH, remote',
  languages: null,
  skills: { frontend: ['Angular'] },
  strongSignals: ['Angular'],
  weakSignals: ['React'],
  active: true,
};

describe('ProfilesStore', () => {
  let store: ProfilesStore;
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
    store = TestBed.inject(ProfilesStore);
    httpMock = TestBed.inject(HttpTestingController);
    toasts = [];
    TestBed.inject(MessageService).messageObserver.subscribe((message) => toasts.push(message as ToastMessageOptions));
  });

  afterEach(() => httpMock.verify());

  async function respondToListReload(profiles: Profile[]): Promise<void> {
    TestBed.tick();
    httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/profiles').flush(profiles);
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('exposes the profiles loaded from the API', async () => {
    await respondToListReload([STANDARD]);

    expect(store.profiles()).toEqual([STANDARD]);
  });

  it('deletes a profile and reloads the list', async () => {
    await respondToListReload([STANDARD, { ...STANDARD, id: 2, name: 'Fullstack', active: false }]);

    store.remove(2);

    httpMock.expectOne((req) => req.method === 'DELETE' && req.url === '/api/profiles/2').flush(null);
    await respondToListReload([STANDARD]);

    expect(store.profiles()).toEqual([STANDARD]);
  });

  it('hands the created profile to the callback so the editor can switch to it', async () => {
    await respondToListReload([STANDARD]);

    let created: Profile | null = null;
    store.create({ ...STANDARD, name: 'Standard (Kopie)' }, (profile) => (created = profile));

    httpMock
      .expectOne((req) => req.method === 'POST' && req.url === '/api/profiles')
      .flush({ ...STANDARD, id: 2, name: 'Standard (Kopie)', active: false });
    await respondToListReload([STANDARD, { ...STANDARD, id: 2, name: 'Standard (Kopie)', active: false }]);

    expect(created).toMatchObject({ id: 2, name: 'Standard (Kopie)' });
  });

  it('starts a reanalysis run and toasts its result', async () => {
    await respondToListReload([STANDARD]);

    store.reanalyze(1, 30);

    const post = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/analyses');
    expect(post.request.body).toEqual({ profileId: 1, days: 30, force: false });
    post.flush({
      id: 9,
      ranAt: '2026-07-24T10:00:00Z',
      newOffers: 0,
      totalSeen: 0,
      analyzedOffers: 12,
      inputTokens: 9000,
      outputTokens: 1800,
      note: 'reanalyse profil=Standard, tage=30',
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0].severity).toBe('success');
    expect(toasts[0].detail).toBe('12 offers re-scored');
  });

  it('toasts the server problem detail when a reanalysis fails', async () => {
    await respondToListReload([STANDARD]);

    store.reanalyze(1, null);

    httpMock
      .expectOne((req) => req.method === 'POST' && req.url === '/api/analyses')
      .flush({ detail: 'Profil nicht gefunden' }, { status: 404, statusText: 'Not Found' });

    expect(store.hasSaveError()).toBe(true);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].severity).toBe('error');
    expect(toasts[0].detail).toBe('Profil nicht gefunden');
  });

  it('requests a cost preview with the chosen window', async () => {
    await respondToListReload([STANDARD]);

    let preview: unknown;
    store.preview(1, 7).subscribe((value) => (preview = value));

    const request = httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/analyses/preview');
    expect(request.request.params.get('profileId')).toBe('1');
    expect(request.request.params.get('days')).toBe('7');
    request.flush({ candidates: 3, estimatedInputTokens: 2400, estimatedOutputTokens: 510 });

    expect(preview).toEqual({ candidates: 3, estimatedInputTokens: 2400, estimatedOutputTokens: 510 });
  });

  it('forces a reanalysis of already-scored offers after a profile change', async () => {
    await respondToListReload([STANDARD]);

    store.reanalyze(1, null, true);

    const post = httpMock.expectOne((req) => req.method === 'POST' && req.url === '/api/analyses');
    expect(post.request.body).toEqual({ profileId: 1, days: null, force: true });
    post.flush({
      id: 10,
      ranAt: '2026-07-24T10:00:00Z',
      newOffers: 0,
      totalSeen: 0,
      analyzedOffers: 5,
      inputTokens: 4000,
      outputTokens: 800,
      note: 'reanalyse (erzwungen) profil=Standard',
    });

    expect(toasts[0].detail).toBe('5 offers re-scored');
  });

  it('includes force in the preview request only when set', async () => {
    await respondToListReload([STANDARD]);

    store.preview(1, null, true).subscribe();

    const request = httpMock.expectOne((req) => req.method === 'GET' && req.url === '/api/analyses/preview');
    expect(request.request.params.get('force')).toBe('true');
    request.flush({ candidates: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 });
  });

  it('hands the updated profile to the callback so the reanalysis dialog can open', async () => {
    await respondToListReload([STANDARD]);

    let updated: Profile | null = null;
    store.update(1, { ...STANDARD, focus: 'Angular' }, (profile) => (updated = profile));

    httpMock.expectOne((req) => req.method === 'PUT' && req.url === '/api/profiles/1').flush({ ...STANDARD, focus: 'Angular' });
    await respondToListReload([{ ...STANDARD, focus: 'Angular' }]);

    expect(updated).toMatchObject({ id: 1, focus: 'Angular' });
  });
});
