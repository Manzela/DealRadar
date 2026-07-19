// Merchant-PAGE content extractor [FR-1.4/Q-3, docs/specs/pdp-full-content] —
// for merchants whose Shopify product JSON carries NO description (the
// "Renogy class": content lives in page sections/metafields). Called by the
// verifier ONLY when the product-JSON description is empty, so it adds at most
// one extra page fetch per such row per sweep, under the same per-host pacing.
//
// Extraction chain (first non-empty wins):
//   1. JSON-LD Product/ProductGroup `description`
//   2. Shopify metafield rich-text sections (`metafield-rich_text_field` divs —
//      a stock Shopify pattern, not merchant-specific; largest block wins)
//   3. og:description meta (short, last resort)
// aggregateRating rides the same parse when a JSON-LD block carries it (Q-5
// provenance = 'merchant-jsonld').
//
// Dependency-free; pure functions over an HTML string (fixture-tested).
'use strict';

/** All parsed JSON-LD objects in the page (malformed blocks skipped). */
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch { /* malformed block — skip */ }
  }
  return out;
}

/** Inner HTML of every `metafield-rich_text_field` div, via balanced-div scan. */
function metafieldRichTextBlocks(html) {
  const blocks = [];
  const re = /<div[^>]*class="[^"]*metafield-rich_text_field[^"]*"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    let depth = 1;
    let i = re.lastIndex;
    const tag = /<\/?div\b[^>]*>/g;
    tag.lastIndex = i;
    let t;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) { blocks.push(html.slice(i, t.index)); break; }
    }
  }
  return blocks;
}

function ogDescription(html) {
  const m = html.match(/<meta property="og:description" content="([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * → { descriptionHtml, descriptionSource, rating: {value, count}|null }.
 * descriptionHtml is RAW page HTML — the caller MUST pass it through
 * reduceMerchantHtml (same sanitation contract as product-JSON captures).
 */
function extractPageContent(html) {
  let rating = null;
  let ldDescription = null;
  for (const b of jsonLdBlocks(html)) {
    const nodes = Array.isArray(b) ? b : [b];
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue;
      if ((n['@type'] === 'Product' || n['@type'] === 'ProductGroup')) {
        if (!ldDescription && typeof n.description === 'string' && n.description.trim()) ldDescription = n.description;
        const ar = n.aggregateRating;
        if (ar && ar.ratingValue != null) {
          const value = Number(ar.ratingValue);
          const count = ar.ratingCount != null ? Number(ar.ratingCount) : (ar.reviewCount != null ? Number(ar.reviewCount) : null);
          if (Number.isFinite(value)) rating = { value, count: Number.isFinite(count) ? count : null };
        }
      }
    }
  }
  if (ldDescription) return { descriptionHtml: ldDescription, descriptionSource: 'page-jsonld', rating };
  // Anchor on the PRODUCT-description section: pages carry metafield rich-text
  // in unrelated sections too (returns policy, loyalty banners) and "largest
  // wins" picks boilerplate — verified on de.renogy.com. Only when no product
  // section exists do we fall back to page-wide blocks.
  const secStart = html.search(/class="[^"]*section-product-description/);
  const scope = secStart >= 0
    ? html.slice(secStart, html.indexOf('</section>', secStart) + 10 || undefined)
    : html;
  let blocks = metafieldRichTextBlocks(scope);
  if (!blocks.length && secStart >= 0) blocks = metafieldRichTextBlocks(html);
  if (blocks.length) {
    // Within the product section every block is product content (description,
    // notes, package contents) — keep them all, in page order.
    const joined = blocks.map((b) => b.trim()).filter(Boolean).join('\n');
    if (joined) return { descriptionHtml: joined, descriptionSource: 'page-metafield', rating };
  }
  const og = ogDescription(html);
  if (og) return { descriptionHtml: `<p>${og}</p>`, descriptionSource: 'page-og', rating };
  return { descriptionHtml: null, descriptionSource: null, rating };
}

module.exports = { extractPageContent, jsonLdBlocks, metafieldRichTextBlocks, ogDescription };
