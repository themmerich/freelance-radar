import {
  AVERAGE_SCORE,
  OFFER_COUNT,
  averagePerBucket,
  averageScorePerAgent,
  averageWithCount,
  bucketFor,
  countByCountryGroup,
  countBySeniority,
  durationBuckets,
  greenShareMetric,
  hourlyRates,
  rateBuckets,
  remotePercentBuckets,
  countByRoleCategory,
  roleCategory,
  kpis,
  offersPerBucket,
  scoreHistogram,
  topSkills,
  trend,
  triggersPerAgent,
  withinRange,
} from './offer-stats';

type StatsOffer = Parameters<typeof withinRange>[0][number];

const TODAY = new Date('2026-07-23T12:00:00');

function offer(overrides: Partial<StatsOffer>): StatsOffer {
  return {
    receivedAt: '2026-07-23T09:00:00Z',
    sourceType: 'AGENT',
    agentName: 'Angular',
    remote: null,
    role: null,
    seniority: null,
    country: null,
    matchScore: null,
    skills: [],
    budgetEur: null,
    budgetKind: null,
    durationMonths: null,
    remotePercent: null,
    ...overrides,
  };
}

describe('offer-stats', () => {
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

    it('averages the selected value per bucket and leaves buckets without values null', () => {
      const result = averagePerBucket(
        [
          offer({ matchScore: 70 }),
          offer({ matchScore: 76 }),
          offer({ receivedAt: '2026-07-13T08:00:00', matchScore: 40 }),
          offer({ receivedAt: '2026-07-16T08:00:00', matchScore: null }),
        ],
        (entry) => entry.matchScore,
        '90d',
        TODAY,
      );

      expect(result.averages).toHaveLength(13);
      // Vorwoche (13.07.) trägt die 40, die laufende Woche den Schnitt aus 70 und 76.
      expect(result.averages[11]).toBe(40);
      expect(result.averages[12]).toBe(73);
      expect(result.averages[10]).toBeNull();
    });

    it('averages whatever field the selector picks', () => {
      const result = averagePerBucket(
        [offer({ remotePercent: 100 }), offer({ remotePercent: 50 }), offer({ remotePercent: null })],
        (entry) => entry.remotePercent,
        '30d',
        TODAY,
      );

      // Nur die beiden Angebote mit Remote-Angabe zählen — das dritte drückt den Schnitt nicht.
      expect(result.averages[29]).toBe(75);
    });

    it('cuts offers to the window with the same start the buckets use', () => {
      const offers = [offer({}), offer({ receivedAt: '2026-06-24T00:00:00' }), offer({ receivedAt: '2026-06-23T23:59:00' })];

      expect(withinRange(offers, '30d', TODAY)).toHaveLength(2);
      // „Alles" reicht die Liste unverändert durch.
      expect(withinRange(offers, 'all', TODAY)).toBe(offers);
    });
  });

  describe('rates, durations and remote share', () => {
    it('counts only hourly budgets as rates', () => {
      const result = hourlyRates([
        offer({ budgetEur: 85, budgetKind: 'HOURLY' }),
        // Ein Tagessatz und ein Gesamtbudget dürfen den Stundensatz-Schnitt nicht verfälschen.
        offer({ budgetEur: 649, budgetKind: 'DAILY' }),
        offer({ budgetEur: 750000, budgetKind: 'TOTAL' }),
        offer({ budgetEur: null, budgetKind: null }),
      ]);

      expect(result).toEqual([85]);
    });

    it('reports the count alongside the average', () => {
      expect(averageWithCount([80, 90])).toEqual({ average: 85, count: 2 });
    });

    it('reports null rather than zero when nothing is known', () => {
      // Eine 0 wäre eine Aussage, die niemand getroffen hat.
      expect(averageWithCount([])).toEqual({ average: null, count: 0 });
    });

    it('puts a value that sits exactly on a class edge into the lower class', () => {
      const result = durationBuckets([
        offer({ durationMonths: 3 }),
        offer({ durationMonths: 4 }),
        offer({ durationMonths: 6 }),
        offer({ durationMonths: 12 }),
        offer({ durationMonths: 13 }),
      ]);

      expect(result).toEqual([
        { name: '≤ 3', count: 1 },
        { name: '4–6', count: 2 },
        { name: '7–12', count: 1 },
        { name: '> 12', count: 1 },
      ]);
    });

    it('keeps the outer rate classes open so no value slips through', () => {
      const result = rateBuckets([
        offer({ budgetEur: 40, budgetKind: 'HOURLY' }),
        offer({ budgetEur: 60, budgetKind: 'HOURLY' }),
        offer({ budgetEur: 200, budgetKind: 'HOURLY' }),
      ]);

      expect(result.map((entry) => entry.count)).toEqual([1, 1, 0, 0, 1]);
    });

    it('separates fully remote from the rest', () => {
      const result = remotePercentBuckets([
        offer({ remotePercent: 0 }),
        offer({ remotePercent: 20 }),
        offer({ remotePercent: 99 }),
        offer({ remotePercent: 100 }),
        offer({ remotePercent: null }),
      ]);

      expect(result).toEqual([
        { name: '0 %', count: 1 },
        { name: '1–49 %', count: 1 },
        { name: '50–99 %', count: 1 },
        { name: '100 %', count: 1 },
      ]);
    });
  });

  it('counts seniority levels in the fixed order junior to architect plus unknown', () => {
    const result = countBySeniority([
      offer({ seniority: 'senior' }),
      offer({ seniority: 'junior' }),
      offer({ seniority: 'senior' }),
      offer({ seniority: null }),
    ]);

    expect(result).toEqual([1, 0, 2, 0, 0, 1]);
  });

  it('counts a seniority outside the prompt list as unknown instead of dropping it', () => {
    // Sollte der Analyse-Prompt je abweichen, wird das im Chart sichtbar statt still verschluckt.
    const result = countBySeniority([offer({ seniority: 'principal' })]);

    expect(result).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('groups countries into DE, AT, CH, other and unknown', () => {
    const result = countByCountryGroup([
      offer({ country: 'DE' }),
      offer({ country: 'DE' }),
      offer({ country: 'CH' }),
      offer({ country: 'US' }),
      offer({ country: null }),
    ]);

    expect(result).toEqual([2, 0, 1, 1, 1]);
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
    expect(result.last7Days.value).toBe(2);
    expect(result.last30Days.value).toBe(3);
    // Ohne Zeitfenster, aber nur analysiert — das Angebot vom Januar ist es nicht.
    expect(result.total).toBe(3);
    // Beide Qualitätskacheln rechnen über 30 Tage; das Angebot vom Januar fällt heraus.
    expect(result.averageScore.value).toBe(60);
    expect(result.greenShare.value).toBe(33);
  });

  it('reports null score kpis while nothing is analyzed', () => {
    const result = kpis([offer({})], 70, TODAY);

    expect(result.total).toBe(0);
    expect(result.averageScore.value).toBeNull();
    expect(result.greenShare.value).toBeNull();
  });

  it('leaves today and total without a delta', () => {
    const result = kpis([offer({ matchScore: 80 })], 70, TODAY);

    expect(result.today).toBe(1);
    expect(result.total).toBe(1);
  });

  // TODAY ist der 23.07. — das 7-Tage-Fenster reicht bis zum 17.07., dessen Vorperiode
  // vom 10. bis zum 16.07. Die Trend-Fälle unten benennen ihre Angebote nur über den Tag.
  function july(day: number, matchScore: number | null = null): StatsOffer {
    return offer({ receivedAt: `2026-07-${day}T09:00:00`, matchScore });
  }

  const LONG_BEFORE = offer({ receivedAt: '2026-01-01T09:00:00' });

  it('measures the previous period on the shifted window', () => {
    const result = trend([july(23), july(22), july(18), july(12), july(10)], 7, OFFER_COUNT, TODAY);

    expect(result.value).toBe(3);
    expect(result.delta).toBe(50);
  });

  it('keeps the delta when the oldest offer starts exactly at the previous period', () => {
    const result = trend([july(23), july(12), july(10)], 7, OFFER_COUNT, TODAY);

    expect(result.delta).toBe(-50);
  });

  it('drops the delta when the oldest offer starts inside the previous period', () => {
    const result = trend([july(23), july(12), july(11)], 7, OFFER_COUNT, TODAY);

    expect(result.value).toBe(1);
    expect(result.delta).toBeNull();
  });

  it('drops the relative delta when the previous period is empty', () => {
    const result = trend([july(23), LONG_BEFORE], 7, OFFER_COUNT, TODAY);

    expect(result.value).toBe(1);
    expect(result.delta).toBeNull();
  });

  it('reports the score delta in points', () => {
    const result = trend([july(23, 80), july(22, 60), july(12, 50), july(11, 60), july(10, 55)], 7, AVERAGE_SCORE, TODAY);

    expect(result.value).toBe(70);
    expect(result.delta).toBe(15);
  });

  it('reports the green share delta in percentage points', () => {
    const result = trend([july(23, 80), july(22, 60), july(12, 90), july(11, 40), july(10, 30)], 7, greenShareMetric(70), TODAY);

    expect(result.value).toBe(50);
    expect(result.delta).toBe(17);
  });

  it('reports no score while nothing in the window is analyzed', () => {
    const result = trend([july(23), LONG_BEFORE], 7, AVERAGE_SCORE, TODAY);

    expect(result.value).toBeNull();
    expect(result.delta).toBeNull();
  });
});
