import {
  averageScorePerAgent,
  averageScorePerBucket,
  averageScorePerDay,
  bucketFor,
  countByRemote,
  countByRoleCategory,
  roleCategory,
  kpis,
  offersPerBucket,
  offersPerDay,
  offersPerMonth,
  scoreHistogram,
  topSkills,
  triggersPerAgent,
  withinRange,
} from './offer-stats';

type StatsOffer = Parameters<typeof countByRemote>[0][number];

const TODAY = new Date('2026-07-23T12:00:00');

function offer(overrides: Partial<StatsOffer>): StatsOffer {
  return {
    receivedAt: '2026-07-23T09:00:00Z',
    sourceType: 'AGENT',
    agentName: 'Angular',
    remote: null,
    role: null,
    matchScore: null,
    skills: [],
    ...overrides,
  };
}

describe('offer-stats', () => {
  it('counts offers per day over the window and fills gaps with zero', () => {
    const result = offersPerDay(
      [offer({}), offer({}), offer({ receivedAt: '2026-07-21T23:59:00' }), offer({ receivedAt: '2026-06-01T00:00:00' })],
      3,
      TODAY,
    );

    expect(result.labels).toEqual(['21.07.', '22.07.', '23.07.']);
    expect(result.counts).toEqual([1, 0, 2]);
  });

  it('counts offers per month and averages them over the whole window', () => {
    const result = offersPerMonth(
      [
        offer({}),
        offer({}),
        offer({ receivedAt: '2026-05-14T10:00:00' }),
        // Genau am Fensterrand (12 Monate zurück) — zählt noch mit.
        offer({ receivedAt: '2025-08-31T23:00:00' }),
        // Einen Monat zu alt — fällt heraus.
        offer({ receivedAt: '2025-07-31T23:00:00' }),
      ],
      12,
      TODAY,
    );

    expect(result.labels).toEqual([
      '08.25',
      '09.25',
      '10.25',
      '11.25',
      '12.25',
      '01.26',
      '02.26',
      '03.26',
      '04.26',
      '05.26',
      '06.26',
      '07.26',
    ]);
    expect(result.counts).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2]);
    // 4 Anfragen im Fenster, geteilt durch alle 12 Monate — leere Monate zählen mit.
    expect(result.average).toBe(0.3);
  });

  // TODAY ist ein Donnerstag; die laufende Woche beginnt am Montag, dem 20.07.2026.
  describe('time ranges', () => {
    it('maps every range to its resolution', () => {
      expect([bucketFor('30d'), bucketFor('90d'), bucketFor('12m'), bucketFor('all')]).toEqual(['day', 'week', 'month', 'month']);
    });

    it('buckets 30d by day from today back 29 days', () => {
      const result = offersPerBucket(
        [offer({}), offer({ receivedAt: '2026-06-24T00:00:00' }), offer({ receivedAt: '2026-06-23T23:59:00' })],
        '30d',
        TODAY,
      );

      expect(result.counts).toHaveLength(30);
      expect(result.labels[0]).toBe('24.06.');
      expect(result.labels[29]).toBe('23.07.');
      // Der 24.06. ist der älteste Tag im Fenster, der 23.06. fällt heraus.
      expect(result.counts[0]).toBe(1);
      expect(result.counts[29]).toBe(1);
      expect(result.counts.reduce((sum, count) => sum + count, 0)).toBe(2);
    });

    it('buckets 90d by week starting monday', () => {
      const result = offersPerBucket(
        [
          offer({ receivedAt: '2026-04-27T08:00:00' }),
          // Sonntag — gehört noch in dieselbe Woche wie der Montag davor.
          offer({ receivedAt: '2026-05-03T23:00:00' }),
          offer({ receivedAt: '2026-05-04T08:00:00' }),
          // Eine Woche vor dem Fenster.
          offer({ receivedAt: '2026-04-26T23:00:00' }),
        ],
        '90d',
        TODAY,
      );

      expect(result.counts).toHaveLength(13);
      expect(result.labels[0]).toBe('27.04.');
      expect(result.labels[12]).toBe('20.07.');
      expect(result.counts[0]).toBe(2);
      expect(result.counts[1]).toBe(1);
      expect(result.counts.reduce((sum, count) => sum + count, 0)).toBe(3);
    });

    it('buckets 12m by month and averages over the whole window', () => {
      const result = offersPerBucket(
        [offer({}), offer({}), offer({ receivedAt: '2025-08-31T23:00:00' }), offer({ receivedAt: '2025-07-31T23:00:00' })],
        '12m',
        TODAY,
      );

      expect(result.labels).toEqual([
        '08.25',
        '09.25',
        '10.25',
        '11.25',
        '12.25',
        '01.26',
        '02.26',
        '03.26',
        '04.26',
        '05.26',
        '06.26',
        '07.26',
      ]);
      expect(result.counts[0]).toBe(1);
      expect(result.counts[11]).toBe(2);
      // 3 Angebote im Fenster, geteilt durch alle 12 Monate — leere Monate zählen mit.
      expect(result.average).toBe(0.3);
    });

    it('starts the all range at the month of the oldest offer', () => {
      const result = offersPerBucket([offer({}), offer({ receivedAt: '2025-11-14T08:00:00' })], 'all', TODAY);

      expect(result.labels[0]).toBe('11.25');
      expect(result.labels.at(-1)).toBe('07.26');
      expect(result.counts).toHaveLength(9);
    });

    it('keeps a single bucket for the all range without offers', () => {
      const result = offersPerBucket([], 'all', TODAY);

      expect(result.labels).toEqual(['07.26']);
      expect(result.counts).toEqual([0]);
      expect(result.average).toBe(0);
    });

    it('averages scores per bucket and leaves buckets without analyzed offers null', () => {
      const result = averageScorePerBucket(
        [
          offer({ matchScore: 70 }),
          offer({ matchScore: 76 }),
          offer({ receivedAt: '2026-07-13T08:00:00', matchScore: 40 }),
          offer({ receivedAt: '2026-07-16T08:00:00', matchScore: null }),
        ],
        '90d',
        TODAY,
      );

      expect(result.averages).toHaveLength(13);
      // Vorwoche (13.07.) trägt die 40, die laufende Woche den Schnitt aus 70 und 76.
      expect(result.averages[11]).toBe(40);
      expect(result.averages[12]).toBe(73);
      expect(result.averages[10]).toBeNull();
    });

    it('cuts offers to the window with the same start the buckets use', () => {
      const offers = [offer({}), offer({ receivedAt: '2026-06-24T00:00:00' }), offer({ receivedAt: '2026-06-23T23:59:00' })];

      expect(withinRange(offers, '30d', TODAY)).toHaveLength(2);
      // „Alles" reicht die Liste unverändert durch.
      expect(withinRange(offers, 'all', TODAY)).toBe(offers);
    });
  });

  it('counts remote levels in the fixed order remote, hybrid, onsite plus unknown', () => {
    const result = countByRemote([
      offer({ remote: 'REMOTE' }),
      offer({ remote: 'ONSITE' }),
      offer({ remote: 'REMOTE' }),
      offer({ remote: null }),
    ]);

    expect(result).toEqual([2, 0, 1, 1]);
  });

  it('averages scores per day and leaves days without analyzed offers null', () => {
    const result = averageScorePerDay(
      [
        offer({ matchScore: 70 }),
        offer({ matchScore: 75 }),
        offer({ matchScore: null }),
        offer({ receivedAt: '2026-07-21T08:00:00', matchScore: 40 }),
        offer({ receivedAt: '2026-06-01T00:00:00', matchScore: 100 }),
      ],
      3,
      TODAY,
    );

    expect(result.labels).toEqual(['21.07.', '22.07.', '23.07.']);
    expect(result.averages).toEqual([40, null, 73]);
  });

  it('averages scores per agent descending and skips unanalyzed or non-agent offers', () => {
    const result = averageScorePerAgent([
      offer({ agentName: 'AI', matchScore: 30 }),
      offer({ agentName: 'AI', matchScore: 41 }),
      offer({ agentName: 'Angular', matchScore: 80 }),
      offer({ agentName: 'Angular', matchScore: null }),
      offer({ sourceType: 'PRIVATE', agentName: 'Java', matchScore: 90 }),
    ]);

    expect(result).toEqual([
      { name: 'Angular', averageScore: 80 },
      { name: 'AI', averageScore: 36 },
    ]);
  });

  describe('roleCategory', () => {
    // Echte Schreibweisen aus den Angebotsdaten — alle vier meinen dieselbe Rolle.
    it.each(['Fullstack Developer', 'Full Stack Developer', 'Full-Stack Software Engineer (React/Java)', 'Java-Fullstack-Entwickler'])(
      'clusters "%s" as fullstack',
      (role) => {
        expect(roleCategory(role)).toBe('FULLSTACK');
      },
    );

    it('lets the first matching rule win', () => {
      // Architekt schlägt Fullstack, KI schlägt den Stack — sonst zählte dieselbe Rolle doppelt.
      expect(roleCategory('Fullstack Software-Architekt')).toBe('ARCHITECT');
      expect(roleCategory('Senior AI Software Engineer — Full-Stack')).toBe('AI_DATA');
    });

    it('matches short abbreviations only as whole words', () => {
      // „ai" steckt in „Trainer", „ki" in „Skills" — als Teilstring wäre beides ein Fehltreffer.
      expect(roleCategory('KI Berater')).toBe('AI_DATA');
      expect(roleCategory('Trainer Telesales Outbound')).toBe('MANAGEMENT');
    });

    it('falls back to OTHER for roles no rule covers', () => {
      expect(roleCategory('Payload CMS Experten')).toBe('CONSULTANT');
      expect(roleCategory('Digital Marketing Allrounder')).toBe('OTHER');
    });
  });

  it('ranks role categories descending and skips offers without a role', () => {
    const result = countByRoleCategory([
      offer({ role: 'Fullstack Developer' }),
      offer({ role: 'Full Stack Developer' }),
      offer({ role: 'Senior Fullstack Entwickler' }),
      offer({ role: 'Solution Architect' }),
      offer({ role: 'Frontend Entwickler' }),
      offer({ role: null }),
      offer({ role: '   ' }),
    ]);

    expect(result).toEqual([
      { category: 'FULLSTACK', count: 3 },
      { category: 'ARCHITECT', count: 1 },
      { category: 'FRONTEND', count: 1 },
    ]);
  });

  it('ranks agent triggers descending and ignores non-agent offers', () => {
    const result = triggersPerAgent([
      offer({ agentName: 'AI' }),
      offer({ agentName: 'Angular' }),
      offer({ agentName: 'AI' }),
      offer({ sourceType: 'PRIVATE', agentName: 'Angular' }),
    ]);

    expect(result).toEqual([
      { name: 'AI', count: 2 },
      { name: 'Angular', count: 1 },
    ]);
  });

  it('merges skills case-insensitively and can restrict to gaps', () => {
    const offers = [
      offer({
        skills: [
          { name: 'Angular', gap: false },
          { name: 'Kotlin', gap: true },
        ],
      }),
      offer({
        skills: [
          { name: 'angular', gap: false },
          { name: 'Kotlin', gap: true },
        ],
      }),
    ];

    expect(topSkills(offers, 10, false)).toEqual([
      { name: 'Angular', count: 2 },
      { name: 'Kotlin', count: 2 },
    ]);
    expect(topSkills(offers, 10, true)).toEqual([{ name: 'Kotlin', count: 2 }]);
    expect(topSkills(offers, 1, false)).toHaveLength(1);
  });

  it('buckets scores into tens with 100 in the last bucket', () => {
    const result = scoreHistogram([
      offer({ matchScore: 0 }),
      offer({ matchScore: 39 }),
      offer({ matchScore: 95 }),
      offer({ matchScore: 100 }),
      offer({ matchScore: null }),
    ]);

    expect(result[0]).toBe(1);
    expect(result[3]).toBe(1);
    expect(result[9]).toBe(2);
    expect(result.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it('computes the kpi windows, average score, and green share', () => {
    const result = kpis(
      [
        offer({ matchScore: 80 }),
        offer({ receivedAt: '2026-07-18T09:00:00', matchScore: 40 }),
        offer({ receivedAt: '2026-07-01T09:00:00', matchScore: 60 }),
        offer({ receivedAt: '2026-01-01T09:00:00' }),
      ],
      70,
      TODAY,
    );

    expect(result.today).toBe(1);
    expect(result.last7Days).toBe(2);
    expect(result.last30Days).toBe(3);
    // Ohne Zeitfenster, aber nur analysiert — das Angebot vom Januar ist es nicht.
    expect(result.total).toBe(3);
    expect(result.averageScore).toBe(60);
    expect(result.greenShare).toBe(33);
  });

  it('reports null score kpis while nothing is analyzed', () => {
    const result = kpis([offer({})], 70, TODAY);

    expect(result.total).toBe(0);
    expect(result.averageScore).toBeNull();
    expect(result.greenShare).toBeNull();
  });
});
