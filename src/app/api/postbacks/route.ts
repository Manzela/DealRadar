import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseConfigured } from '@/lib/db/supabase';
import { timingSafeEqualStr, verifyPostbackSignature } from '@/lib/utils/crypto';
import { decodeSubId } from '@/lib/utils/affiliate';
import { rateLimitPostbacks, claimPostbackSignature } from '@/lib/cache/redis';
import { clientIp } from '@/lib/utils/request-ip';

export const runtime = 'nodejs';

// Reject a signed postback whose X-Timestamp is further than this from "now"
// (either direction — covers both a stale replay and clock-skew nonsense).
// Also doubles as the TTL for the signature-replay claim below, so a given
// signature can only ever be accepted once across its entire valid lifetime.
const POSTBACK_REPLAY_WINDOW_SECONDS = 5 * 60;

/** Network status vocabularies → the DB enum (pending|approved|declined|paid). */
const STATUS_MAP: Record<string, 'pending' | 'approved' | 'declined' | 'paid'> = {
  pending: 'pending', new: 'pending', open: 'pending',
  approved: 'approved', confirmed: 'approved', validated: 'approved', accepted: 'approved',
  declined: 'declined', rejected: 'declined', cancelled: 'declined', canceled: 'declined', void: 'declined',
  paid: 'paid', cleared: 'paid',
};

/** Per-network body field that carries our outbound sub-id (and its tertiary). */
const PRIMARY_SUBID_FIELD: Record<string, string> = {
  awin: 'clickref', kelkoo: 'custom1', tradedoubler: 'epi', strackr: 'subid',
};
const TERTIARY_SUBID_FIELD: Record<string, string> = {
  awin: 'clickref3', kelkoo: 'custom3', tradedoubler: 'epi3',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Auth for a postback request. Two layers, in priority order:
 *
 * 1. PRIMARY (opt-in per integration): HMAC signature. If the request carries
 *    an `X-Signature` header AND a raw body was provided (POST only — a GET
 *    pixel has no body to sign), verify `X-Signature` against
 *    HMAC-SHA256(WEBHOOK_SECRET, `${X-Timestamp}.${rawBody}`) and enforce a
 *    ±5-minute replay window on `X-Timestamp`, plus a one-time-use claim on
 *    the signature itself (src/lib/cache/redis.ts#claimPostbackSignature) so
 *    a captured VALID signed request cannot be replayed even within its
 *    validity window. This is the scheme a network capable of sending custom
 *    headers should use; it is NOT required — see fallback below.
 *
 * 2. FALLBACK (unchanged from before HMAC support existed): a shared secret
 *    in the query string, compared timing-safe. Some real affiliate networks
 *    (Strackr-style GET pixels in particular) only support query-param auth,
 *    not custom headers, so this stays as a first-class path rather than
 *    being removed. Note this means a leaked query-string secret alone still
 *    authenticates via this path for any integration that hasn't opted into
 *    signing — the HMAC layer only hardens integrations that send it.
 *
 * The secret always travels in the query string (never the body), so it
 * never lands in `raw_payload`. Returns an error response, or null when
 * authorized.
 */
async function checkAuth(req: NextRequest, rawBody: string | null = null): Promise<NextResponse | null> {
  // Dedicated webhook secret — no CRON_SECRET fallback (postbacks ≠ cron auth).
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) {
    console.error('[postback] WEBHOOK_SECRET not configured — rejecting');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-signature');
  if (rawBody !== null && signature) {
    const timestampHeader = req.headers.get('x-timestamp');
    const timestamp = timestampHeader ? Number(timestampHeader) : NaN;
    if (!timestampHeader || !Number.isFinite(timestamp)) {
      return NextResponse.json({ error: 'missing_timestamp' }, { status: 401 });
    }
    const ageSeconds = Math.abs(Date.now() / 1000 - timestamp);
    if (ageSeconds > POSTBACK_REPLAY_WINDOW_SECONDS) {
      return NextResponse.json({ error: 'stale_timestamp' }, { status: 401 });
    }
    if (!verifyPostbackSignature(expected, timestamp, rawBody, signature)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
    }
    // Signature is cryptographically valid and fresh — now make sure it
    // hasn't been used before (replay of a captured-but-still-valid request).
    const claimed = await claimPostbackSignature(signature, POSTBACK_REPLAY_WINDOW_SECONDS);
    if (!claimed) {
      return NextResponse.json({ error: 'replayed_signature' }, { status: 401 });
    }
    return null; // authorized via HMAC signature
  }

  const provided = req.nextUrl.searchParams.get('secret') || '';
  if (!timingSafeEqualStr(provided, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * GET /api/postbacks?secret=…&transaction_id=…&… — query-string postbacks.
 * Some networks (Strackr) default to GET pixels rather than POST/JSON. Fields
 * arrive as query params; `secret` is stripped so it never enters raw_payload.
 * GET has no body, so only the query-string-secret auth path applies here —
 * HMAC signing is POST-only (see checkAuth).
 */
export async function GET(req: NextRequest) {
  const { success } = await rateLimitPostbacks(clientIp(req));
  if (!success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const unauthorized = await checkAuth(req);
  if (unauthorized) return unauthorized;
  const body: Record<string, unknown> = {};
  for (const [k, v] of req.nextUrl.searchParams) {
    if (k !== 'secret') body[k] = v;
  }
  return processPostback(body);
}

export async function POST(req: NextRequest) {
  const { success } = await rateLimitPostbacks(clientIp(req));
  if (!success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Read the RAW body text (not req.json()) so a signature can be verified
  // against the exact bytes the sender signed — re-serializing via
  // JSON.stringify could reorder keys / change whitespace and break a
  // legitimate signature.
  const rawBody = await req.text();

  const unauthorized = await checkAuth(req, rawBody);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  return processPostback(body);
}

async function processPostback(body: Record<string, unknown>): Promise<NextResponse> {
  const transactionId = str(body.transaction_id) || str(body.id);
  if (!transactionId) {
    return NextResponse.json({ error: 'missing_transaction_id' }, { status: 400 });
  }

  const network = (str(body.network) || 'unknown').toLowerCase();

  // Commission: finite, non-negative (mirrors transactions_commission_chk).
  const commission = Number(body.commission_earned ?? body.commission ?? 0);
  if (!Number.isFinite(commission) || commission < 0) {
    return NextResponse.json({ error: 'invalid_commission' }, { status: 400 });
  }

  // Status: normalize network vocab to the enum; unknown → pending (+ warn).
  const rawStatus = str(body.status).toLowerCase().trim();
  const status = STATUS_MAP[rawStatus] ?? 'pending';
  if (rawStatus && !STATUS_MAP[rawStatus]) {
    console.warn(`[postback] unknown status "${rawStatus}" from ${network} — defaulting to pending`);
  }

  // Network-aware sub-id extraction, with generic fallbacks.
  const primaryField = PRIMARY_SUBID_FIELD[network];
  const subid =
    (primaryField ? str(body[primaryField]) : '') ||
    str(body.subid) || str(body.clickref) || str(body.custom1) || str(body.epi);
  const tertiaryField = TERTIARY_SUBID_FIELD[network];
  const subid3 =
    ((tertiaryField ? str(body[tertiaryField]) : '') || str(body.subid3) || str(body.clickref3)) || null;

  // Recover the exact productId we encoded into the sub-id (lossless round-trip).
  const productId = decodeSubId(subid)?.productId ?? null;

  if (!supabaseConfigured()) {
    console.warn('[postback] Supabase unconfigured — logging transaction:', {
      transactionId, network, commission, status,
    });
    return NextResponse.json({ ok: true, persisted: false });
  }

  const row = {
    transaction_id: transactionId,
    product_id: productId,
    network,
    commission_earned: commission,
    status,
    subid3,
    raw_payload: body,
    received_at: new Date().toISOString(),
  };

  let { error } = await supabase().from('transactions').upsert(row, { onConflict: 'transaction_id' });
  // FK guard: a postback can reference a product no longer in `deals`. Persist
  // the commission record with a null product_id rather than dropping it.
  if (error?.code === '23503' && productId) {
    console.warn(`[postback] product_id ${productId} absent from deals — persisting with null FK`);
    ({ error } = await supabase()
      .from('transactions')
      .upsert({ ...row, product_id: null }, { onConflict: 'transaction_id' }));
  }
  if (error) {
    console.error('[postback] DB write failed:', error.message);
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
