# Close-out — JSON-LD schema remediation (2026-07-15)

All three checkpoints deployed and live-verified same-day (final state: `20c3d32`, verify-deploy **fully green**, 53 assertions).

## GSC flags → outcomes

| Flag | Outcome |
|---|---|
| Invalid string length `name` (157) | **Fixed** — clamped ≤150 (live: 146/148 on sampled PDPs) |
| Invalid string length `description` (5,572) | **Fixed** — clamped ≤5,000 (live: 4,998) |
| Missing `shippingDetails` | **Documented N/A** — merchant-listing-only; affiliate pages ineligible (findings.md §Pass 2) |
| Missing `hasMerchantReturnPolicy` | **Documented N/A** — same, plus no honest data source |

## Beyond the flags (same workstream)

- Identifiers now live: `sku` (819/819), `mpn` (819/819), `gtin` (567/819) after AWIN Create-a-Feed regeneration (~70 generic columns, `language/de` + full `cid` scope) → new secret → dry-run → real ingest. Two new revenue-bearing merchants entered the catalog (Kuishi 547, Sunshare DE 243).
- `model` heuristic for pipe-suffix names (`| A323`) when feed identifiers absent.
- LocationPicker accessible name (a11y + agentic-browsing failures cleared); 4 contrast pairs → AA.
- BreadcrumbList stops at 2 crumbs (3rd pointed at noindexed /search); `priceSpecification` dropped (doc-orphaned).
- verify-deploy grew 48 → 53 assertions (name/desc caps, button name, breadcrumb, pre-consent guard did its job — see incident).

## Incident (same day): pre-consent gtag regression + hotfix

A `git add -A -- src` sweep committed a concurrent session's uncommitted draft (static gtag.js in `layout.tsx`) into the CP3 deploy → gtag loaded pre-consent in prod. Caught by verify-deploy's `no analytics tag pre-consent` assertion minutes after deploy; hotfixed by restoring consent-gated loading (`20c3d32`). Draft preserved: git history (`6f61f29`) + 3 named stashes for the owning lane. Binding lessons recorded in memory (explicit staging only; named stashes around merges; rerun flaky gates standalone).

## Follow-ups (not in this workstream)

1. **Ingest-v2 for AWIN Google-format feeds** — category feeds structurally exclude them (`hasEnhancedFeeds/0`); 4 joined advertisers (Renogy DE 724 products, ANTHBOT DE 165, Welax DE 165, Omidi DE 64) contribute zero today; 310/917 network feeds already migrated. Column mapping table in the docs brief (workflow output).
2. **Netlify usage guardrail** — `usage_exceeded` outage today; decide on ISR (`revalidate`) vs per-request rendering for PDP/listing pages.
3. **GA4 Measurement-Protocol forwarding** — active parallel-lane feature; must re-apply its Analytics/layout changes with consent gating intact (drafts in stashes).
4. USER: re-run GSC URL inspection + Rich Results Test + Lighthouse on the audit URL; earlier pending GA4/Clarity admin settings.
5. AWIN Toolbox reviewed: Transaction Notifications (done), Create-a-Feed (done), Feed List endpoint (used for format audit — candidate for programmes-sync format flags); My Offers/voucher ingestion and Opportunity Marketplace = future revenue surfaces; Publisher MasterTag skipped (third-party JS, consent burden, no need — links already decorated).
