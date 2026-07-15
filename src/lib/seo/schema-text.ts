/** Word-boundary cap for JSON-LD string fields — Google Merchant Center limits
 *  (name ≤150, description ≤5000 chars) are mirrored by the Rich Results /
 *  Search Console validators; exceeding them draws "Invalid string length"
 *  warnings (audit/2026-07-15_jsonld-schema). Only the machine-readable copy
 *  is capped; visible h1/title/description keep the full text. */

/** JSON-LD Product.name limit (Merchant Center title spec: 1–150). */
export const SCHEMA_NAME_MAX = 150;
/** JSON-LD Product.description limit (Merchant Center description spec: 1–5,000). */
export const SCHEMA_DESCRIPTION_MAX = 5000;

/**
 * Cap `s` at `max` chars INCLUDING the appended ellipsis, cutting at a
 * whitespace boundary — never mid-word, never inside a surrogate pair.
 * Falls back to a hard cut when the trailing word alone would eat more than
 * 40% of the budget (same semantics as the ingest's feedDescription cap).
 * Returns the input unchanged when it already fits.
 */
/**
 * Conservative trailing-model-code extraction for feeds that embed the model
 * in the product name (e.g. BlazeVideo: "… Wasserdicht IP66 | A323"). Used as
 * the JSON-LD `model` property ONLY when the feed ships no mpn/model_number.
 * Strict by design — a `| CODE` suffix where CODE is a single uppercase
 * alphanumeric token (with hyphens) containing at least one letter; anything
 * else (sentences, lowercase, plain numbers) returns null. Never emitted as
 * gtin/mpn: a heuristic must not masquerade as a manufacturer identifier.
 */
export function extractTrailingModelCode(name: string): string | null {
  const m = name.match(/\|\s*(?=[A-Z0-9-]*[A-Z])([A-Z0-9][A-Z0-9-]{1,14})\s*$/);
  return m ? m[1] : null;
}

export function clampSchemaText(s: string, max: number): string {
  if (s.length <= max) return s;
  let head = s.slice(0, max - 1);
  // Don't split an astral code point: drop a dangling high surrogate at the cut.
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  const cut = head.replace(/\s+\S*$/, '');
  return (cut.length >= (max - 1) * 0.6 ? cut : head).trimEnd() + '…';
}
