import { formatPrice } from '@/lib/utils/format';
import type { PriceWindow } from '@/lib/utils/price-history';

/**
 * Price heat bar: a green→red gradient spanning the deal's 3-month price range
 * (green = cheapest, red = dearest) with a marker at today's price. Rendered as
 * a frosted-glass chip with a glossy bar. Pure presentational server component —
 * no client JS, keeps the grid cheap.
 */
export function PriceHeatBar({
  window,
  currency,
  locale,
  captionLabel,
  todayLabel,
}: {
  window: PriceWindow;
  currency: string;
  locale: string;
  captionLabel: string;
  todayLabel: string;
}) {
  const pct = Math.round(window.position * 100);
  const low = formatPrice(window.low, currency, locale);
  const high = formatPrice(window.high, currency, locale);
  const today = formatPrice(window.current, currency, locale);

  return (
    <div
      className="mt-1 rounded-xl border border-zinc-200/70 bg-gradient-to-b from-white/80 to-zinc-50/50 p-2 shadow-sm ring-1 ring-zinc-900/5"
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {captionLabel}
      </p>
      <div
        className="relative h-2.5 rounded-full ring-1 ring-inset ring-white/50"
        style={{
          // Tinted translucent gradient + inner highlight and drop shadow = glass.
          background:
            'linear-gradient(to right, rgba(22,163,74,0.85), rgba(234,179,8,0.85) 50%, rgba(220,38,38,0.85))',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.18)',
        }}
        role="img"
        aria-label={`${captionLabel}: ${low} – ${high}. ${todayLabel}: ${today}.`}
      >
        {/* Glossy top sheen. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-full"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.65), rgba(255,255,255,0))' }}
        />
        {/* Today marker — a frosted glass knob. */}
        <span
          className="absolute top-1/2 h-4 w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-zinc-900/30"
          style={{ left: `${pct}%` }}
          title={`${todayLabel}: ${today}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums">
        <span className="font-medium text-green-600">{low}</span>
        <span className="font-medium text-red-600">{high}</span>
      </div>
    </div>
  );
}
