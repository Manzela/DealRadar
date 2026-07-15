import crypto from 'node:crypto';

/**
 * Resolve the HMAC / cron signing secret at CALL time (never at module load) so
 * an empty-`.env` `next build` (NODE_ENV=production) does not throw on import.
 * In production a missing secret fails the request rather than silently using a
 * known default (audit T2.2-default-secret / R-SEC-1). Dev/test get a clearly
 * non-production fallback so the local flow works without keys.
 */
function signingSecret(): string {
  const s = process.env.CRON_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRON_SECRET is required in production for token signing');
  }
  return 'dealradar-dev-only-secret';
}

/**
 * Generates an HMAC SHA-256 token for email unsubscribe requests.
 */
export function generateUnsubscribeToken(email: string, productId: string): string {
  const data = `${email.toLowerCase().trim()}:${productId}`;
  return crypto.createHmac('sha256', signingSecret()).update(data).digest('hex');
}

/**
 * Timing-safe verification of email unsubscribe tokens. Fails closed if the
 * secret is unavailable (production-missing) or the token is malformed.
 */
export function verifyUnsubscribeToken(email: string, productId: string, token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  let expected: string;
  try {
    expected = generateUnsubscribeToken(email, productId);
  } catch {
    return false;
  }
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison of two arbitrary UTF-8 strings (length-guarded).
 * Used for shared-secret checks on cron/webhook endpoints (R-SEC-5).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * HMAC-SHA256 signature scheme for the postback webhook
 * (src/app/api/postbacks/route.ts — NFR-SEC-4/6, T-INF-7).
 *
 * Signs `${timestampSeconds}.${rawBody}` (rawBody = the exact request bytes,
 * NOT a re-serialized JSON.stringify — key order / whitespace must round-trip
 * byte-for-byte or a legitimate signature won't verify) with WEBHOOK_SECRET.
 * Binding the timestamp INTO the signature means a captured signature cannot
 * be replayed against a different timestamp — see verifyPostbackSignature and
 * the route's replay-window check for the rest of the defense.
 *
 * This is an OPT-IN scheme: it authenticates via a custom `X-Signature` +
 * `X-Timestamp` header pair, which not every affiliate network can send (some
 * only support query-string postbacks). The route keeps the legacy
 * query-string `secret` check as a fallback for those networks — this
 * function only covers the header-capable path.
 */
export function signPostbackBody(secret: string, timestampSeconds: number, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestampSeconds}.${rawBody}`).digest('hex');
}

/**
 * Timing-safe verification of a postback signature. Fails closed on any
 * malformed input (mirrors verifyUnsubscribeToken's shape).
 */
export function verifyPostbackSignature(
  secret: string,
  timestampSeconds: number,
  rawBody: string,
  signatureHex: string,
): boolean {
  if (!signatureHex || typeof signatureHex !== 'string') return false;
  let expected: string;
  try {
    expected = signPostbackBody(secret, timestampSeconds, rawBody);
  } catch {
    return false;
  }
  if (expected.length !== signatureHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}
