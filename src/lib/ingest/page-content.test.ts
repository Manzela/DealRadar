// FR-1.4/Q-3 — merchant-page content extraction (Renogy-class merchants),
// fixture captured from the live de.renogy.com PDP 2026-07-19.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractPageContent, metafieldRichTextBlocks } = require('../../../scripts/lib/extractors/page-content.cjs');
const fixture = readFileSync(new URL('./__fixtures__/renogy-page.html', import.meta.url), 'utf8');

describe('extractPageContent', () => {
  it('extracts the product-section metafield description, not boilerplate', () => {
    const r = extractPageContent(fixture);
    expect(r.descriptionSource).toBe('page-metafield');
    expect(r.descriptionHtml).toContain('Der MPPT-Laderegler 60A ROVER');
    // The fixture deliberately carries an out-of-section returns-policy
    // metafield block — the section anchor must exclude it.
    expect(r.descriptionHtml).not.toContain('RÜCKGABE');
  });

  it('prefers JSON-LD description when a Product block carries one', () => {
    const html = '<script type="application/ld+json">{"@type":"Product","description":"Rich LD text","aggregateRating":{"ratingValue":"4.6","ratingCount":"12"}}</script>';
    const r = extractPageContent(html);
    expect(r.descriptionSource).toBe('page-jsonld');
    expect(r.descriptionHtml).toBe('Rich LD text');
    expect(r.rating).toEqual({ value: 4.6, count: 12 });
  });

  it('falls back to og:description as a last resort', () => {
    const r = extractPageContent('<meta property="og:description" content="Short OG text">');
    expect(r.descriptionSource).toBe('page-og');
    expect(r.descriptionHtml).toBe('<p>Short OG text</p>');
  });

  it('returns nulls on a page with nothing extractable', () => {
    expect(extractPageContent('<html><body><p>nope</p></body></html>')).toEqual({ descriptionHtml: null, descriptionSource: null, rating: null });
  });

  it('balanced-div scan survives nested divs inside metafield blocks', () => {
    const html = '<div class="metafield-rich_text_field"><div><p>inner</p></div><p>tail</p></div>';
    expect(metafieldRichTextBlocks(html)).toEqual(['<div><p>inner</p></div><p>tail</p>']);
  });
});
