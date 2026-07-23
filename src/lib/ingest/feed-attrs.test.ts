// FR-2.1/EC-5 — generic feed-attrs collection + fill-rate accounting.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { makeAttrCollector, FillRates, MAX_VALUE_LEN } = require('../../../scripts/lib/feed-attrs.cjs');

const gOf = (rec: Record<string, string>) => (k: string) => rec[k] ?? '';

describe('makeAttrCollector', () => {
  const headers = ['title', 'brand', 'product_type', 'item_group_id', 'colour', 'mobile_link', 'delivery_time'];

  it('collects only non-empty, non-mapped, non-noise columns', () => {
    const collect = makeAttrCollector(headers, 'google', null);
    const attrs = collect(gOf({ title: 'X', brand: 'B', product_type: 'Bikes > Parts', item_group_id: '', mobile_link: 'https://m', delivery_time: '3-5 Tage' }));
    expect(attrs).toEqual({ product_type: 'Bikes > Parts', delivery_time: '3-5 Tage' });
  });

  it('returns null when nothing unmapped is populated', () => {
    const collect = makeAttrCollector(headers, 'google', null);
    expect(collect(gOf({ title: 'X', brand: 'B' }))).toBeNull();
  });

  it('clamps long values', () => {
    const collect = makeAttrCollector(['spec'], 'legacy', null);
    const attrs = collect(gOf({ spec: 'x'.repeat(MAX_VALUE_LEN + 50) }));
    expect(attrs!.spec.length).toBe(MAX_VALUE_LEN + 1); // clamp + ellipsis
  });

  it('legacy mapping excludes normalizeRow-owned columns', () => {
    const collect = makeAttrCollector(['search_price', 'condition', 'delivery_cost'], 'legacy', null);
    expect(collect(gOf({ search_price: '9.99', condition: 'new', delivery_cost: '4.95' })))
      .toEqual({ condition: 'new', delivery_cost: '4.95' });
  });
});

describe('FillRates', () => {
  it('computes per-advertiser percentages and pinned log grammar', () => {
    const fr = new FillRates();
    fr.row('adv1'); fr.bump('adv1', 'colour');
    fr.row('adv1');
    const sum = fr.summary();
    expect(sum.adv1.rows).toBe(2);
    expect(sum.adv1.cols.colour).toBe(50);
    expect(fr.logLines()).toEqual(['[ingest] fill-rate adv=adv1 col=colour pct=50']);
  });
});

describe('coverage completeness guarantee (64-vs-16 audit)', () => {
  const { buildCoverageReport } = require('../../../scripts/lib/coverage.cjs');
  it('a joined programme with feed rows that fits no bucket becomes an explicit red, never silence', () => {
    const report = buildCoverageReport({
      // Feed row exists but with an unknown membership state → not active,
      // not absent → previously fell through every classification path.
      feedRows: [{ 'Advertiser ID': '114656', 'Advertiser Name': 'BrightCHAMPS UK', 'Membership Status': 'invited', 'Datafeed Format': 'Awin', 'Language': 'English', 'Feed ID': 'F1', 'Last Imported': '2026-07-20 00:00:00', URL: '' }],
      dealRows: [],
      joinedProgrammes: [{ programme_id: 114656, name: 'BrightCHAMPS UK' }],
      ingestSummary: null,
      now: new Date('2026-07-23T00:00:00Z'),
    });
    const bc = report.advertisers.find((a: { id: string }) => a.id === '114656');
    expect(bc).toBeTruthy();
    expect(bc.status).toBe('red'); // divergence red OR the UNCLASSIFIED sweep — never silence
  });

  it('classification is TOTAL: every joined programme lands in a bucket or joinedNoFeed', () => {
    const joined = [
      { programme_id: 1, name: 'ActiveGerman' },
      { programme_id: 2, name: 'NonActiveState' },
      { programme_id: 3, name: 'NoFeedAtAll' },
    ];
    const report = buildCoverageReport({
      feedRows: [
        { 'Advertiser ID': '1', 'Advertiser Name': 'ActiveGerman', 'Membership Status': 'active', 'Datafeed Format': 'Awin', 'Language': 'German', 'Feed ID': 'F1', 'Last Imported': '2026-07-22 00:00:00', URL: '' },
        { 'Advertiser ID': '2', 'Advertiser Name': 'NonActiveState', 'Membership Status': 'invited', 'Datafeed Format': 'Awin', 'Language': 'German', 'Feed ID': 'F2', 'Last Imported': '2026-07-22 00:00:00', URL: '' },
      ],
      dealRows: [],
      joinedProgrammes: joined,
      ingestSummary: null,
      now: new Date('2026-07-23T00:00:00Z'),
    });
    const classified = new Set(report.advertisers.map((a: { id: string }) => a.id));
    const noFeed = new Set(report.joinedNoFeed.map((p: { programme_id: number }) => String(p.programme_id)));
    for (const p of joined) {
      expect(classified.has(String(p.programme_id)) || noFeed.has(String(p.programme_id))).toBe(true);
    }
  });
});
