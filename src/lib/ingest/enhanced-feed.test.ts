import { describe, it, expect } from 'vitest';
// The normalizer is a dependency-free CJS script-lib (runs on bare CI runners);
// tests live in src/ because vitest's include is src/**.
import { parseEnhancedPrice, mapGoogleCategory, cleanGtin, parseAdditionalImages, normalizeEnhancedRow } from '../../../scripts/lib/enhanced-feed.cjs';

const CTX = {
  country: 'DE',
  allowedCurrencies: new Set(['EUR']),
  feedDescription: (s: string) => s || null,
  fallbackCategory: () => 'electronics',
};

// Column-name → value stub matching the empirical 62-col schema.
function row(over: Record<string, string> = {}) {
  const base: Record<string, string> = {
    advertiser_id: '122456', advertiser_name: 'ROCKBROS', id: '49536796033369',
    title: 'ROCKBROS Fahrradbrille photochromisch', description: 'Beschreibung.',
    link: 'https://rockbros.de/products/brille', image_link: 'https://cdn.shopify.com/x.jpg',
    additional_image_link: '', aw_deep_link: 'https://www.awin1.com/cread.php?awinmid=122456&awinaffid=2951525&ued=x',
    google_product_category: 'Sporting Goods > Outdoor Recreation > Cycling', product_type: '',
    gtin: '733561604423', mpn: 'RB-100', brand: 'ROCKBROS', availability: 'in_stock',
    price: '26.99 EUR', sale_price: '', condition: 'new',
  };
  return (k: string) => (over[k] ?? base[k] ?? '');
}

describe('parseEnhancedPrice', () => {
  it('parses "26.99 EUR"', () => expect(parseEnhancedPrice('26.99 EUR')).toEqual({ value: 26.99, currency: 'EUR' }));
  it('parses comma decimals', () => expect(parseEnhancedPrice('26,99 EUR')).toEqual({ value: 26.99, currency: 'EUR' }));
  it('rejects garbage and zero', () => {
    expect(parseEnhancedPrice('EUR 26.99')).toBeNull();
    expect(parseEnhancedPrice('0.00 EUR')).toBeNull();
    expect(parseEnhancedPrice('')).toBeNull();
  });
});

describe('mapGoogleCategory', () => {
  it('maps top-level taxonomy segments', () => {
    expect(mapGoogleCategory('Sporting Goods > Outdoor Recreation > Cycling')).toBe('sports');
    expect(mapGoogleCategory('Electronics')).toBe('electronics');
    expect(mapGoogleCategory('Apparel & Accessories > Clothing')).toBe('fashion');
  });
  it('returns null for unmapped/empty paths (caller falls back + logs)', () => {
    expect(mapGoogleCategory('Religious & Ceremonial > X')).toBeNull();
    expect(mapGoogleCategory('')).toBeNull();
  });
});

describe('cleanGtin / parseAdditionalImages', () => {
  it('keeps 8-14 digit gtins, numeric form only', () => {
    expect(cleanGtin('733561604423')).toBe('733561604423');
    expect(cleanGtin('gtin:733561604423')).toBe('733561604423');
    expect(cleanGtin('123')).toBeNull();
  });
  it('accepts JSON arrays and comma lists of urls', () => {
    expect(parseAdditionalImages('["https://a/1.jpg","https://a/2.jpg"]')).toHaveLength(2);
    expect(parseAdditionalImages('https://a/1.jpg, https://a/2.jpg')).toHaveLength(2);
    expect(parseAdditionalImages('')).toHaveLength(0);
    expect(parseAdditionalImages('not-json[')).toHaveLength(0);
  });
});

describe('normalizeEnhancedRow', () => {
  it('normalizes a valid in-stock row: countried id, discount 0, verifier-ready merchant_url', () => {
    const d = normalizeEnhancedRow(row(), CTX)!;
    expect(d.product_id).toBe('awin:DE:adv122456:49536796033369');
    expect(d.sale_price).toBe(26.99);
    expect(d.original_price).toBe(26.99);
    expect(d.discount_percent).toBe(0);
    expect(d.category).toBe('sports');
    expect(d.merchant_sku).toBe('49536796033369');
    expect(d.ean_code).toBe('733561604423');
    expect(d.merchant_url).toBe('https://rockbros.de/products/brille');
    expect(d.shop_url).toContain('awin1.com');
  });

  it('computes a genuine discount when sale_price < price (inverted enhanced semantics)', () => {
    const d = normalizeEnhancedRow(row({ price: '100.00 EUR', sale_price: '75.00 EUR' }), CTX)!;
    expect(d.sale_price).toBe(75);
    expect(d.original_price).toBe(100);
    expect(d.discount_percent).toBe(25);
  });

  it('ignores a bogus sale_price >= price', () => {
    const d = normalizeEnhancedRow(row({ price: '50.00 EUR', sale_price: '60.00 EUR' }), CTX)!;
    expect(d.discount_percent).toBe(0);
    expect(d.original_price).toBe(50);
  });

  it('drops out-of-stock, missing deep link, wrong currency, non-new condition', () => {
    expect(normalizeEnhancedRow(row({ availability: 'out_of_stock' }), CTX)).toBeNull();
    expect(normalizeEnhancedRow(row({ aw_deep_link: '' }), CTX)).toBeNull();
    expect(normalizeEnhancedRow(row({ price: '19.99 GBP' }), CTX)).toBeNull();
    expect(normalizeEnhancedRow(row({ condition: 'used' }), CTX)).toBeNull();
  });

  it('reports unmapped Google categories and uses the fallback', () => {
    const seen: string[] = [];
    const d = normalizeEnhancedRow(row({ google_product_category: 'Gift Cards' }), {
      ...CTX, onUnmappedCategory: (p: string) => seen.push(p),
    })!;
    expect(d.category).toBe('electronics');
    expect(seen).toEqual(['Gift Cards']);
  });
});
