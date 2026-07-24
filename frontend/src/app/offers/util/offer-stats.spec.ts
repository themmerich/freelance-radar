import { countBySource, kpis, offersPerDay, scoreHistogram, topSkills, triggersPerAgent } from './offer-stats';

type StatsOffer = Parameters<typeof countBySource>[0][number];

const TODAY = new Date('2026-07-23T12:00:00');

function offer(overrides: Partial<StatsOffer>): StatsOffer {
  return {
    receivedAt: '2026-07-23T09:00:00Z',
    sourceType: 'AGENT',
    agentName: 'Angular',
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

  it('counts sources in the fixed order agent, private, newsletter, other', () => {
    const result = countBySource([
      offer({}),
      offer({ sourceType: 'PRIVATE' }),
      offer({ sourceType: 'OTHER' }),
      offer({ sourceType: 'AGENT' }),
    ]);

    expect(result).toEqual([2, 1, 0, 1]);
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
    expect(result.averageScore).toBe(60);
    expect(result.greenShare).toBe(33);
  });

  it('reports null score kpis while nothing is analyzed', () => {
    const result = kpis([offer({})], 70, TODAY);

    expect(result.averageScore).toBeNull();
    expect(result.greenShare).toBeNull();
  });
});
