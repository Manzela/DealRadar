import { formatPrice } from '@/lib/utils/format';
import type { PriceWindow } from '@/lib/utils/price-history';

/**
 * Price cardiogram: the deal's 3-month price history drawn as a jagged green→red
 * line. The horizontal axis is the price range (left = cheapest, right =
 * dearest), and a "playhead" marker slides to today's price position and sits on
 * the line — so the dot moves with today's price. Pure presentational server
 * component — no client JS, keeps the grid cheap.
 */

// SVG user-space coordinate system (stretched to fit via preserveAspectRatio).
const VB_W = 100;
const VB_H = 40;
const PAD_X = 3;
const PAD_Y = 7;

export function PriceHeatBar({
  window,
  series,
  currency,
  locale,
  captionLabel,
  todayLabel,
}: {
  window: PriceWindow;
  series: number[];
  currency: string;
  locale: string;
  captionLabel: string;
  todayLabel: string;
}) {
  const low = formatPrice(window.low, currency, locale);
  const high = formatPrice(window.high, currency, locale);
  const today = formatPrice(window.current, currency, locale);

  const span = window.high - window.low || 1;
  const last = series.length - 1;
  const x = (i: number) => PAD_X + (i / last) * (VB_W - 2 * PAD_X);
  const y = (v: number) => PAD_Y + (1 - (v - window.low) / span) * (VB_H - 2 * PAD_Y);

  const points = series.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${points.join(' L')}`;
  const area = `${line} L${x(last).toFixed(2)},${VB_H} L${x(0).toFixed(2)},${VB_H} Z`;

  // Marker: x = today's position in the range; y = the line's value there
  // (interpolated), so the dot sits on the cardiogram at today's price spot.
  const pos = Math.min(1, Math.max(0, window.position));
  const f = pos * last;
  const i0 = Math.floor(f);
  const i1 = Math.min(last, i0 + 1);
  const vInterp = series[i0] + (series[i1] - series[i0]) * (f - i0);
  const markerLeft = x(f); // viewBox units 0–100 → percent
  const markerTop = (y(vInterp) / VB_H) * 100;

  return (
    <div className="mt-1 rounded-xl border border-zinc-200/70 bg-gradient-to-b from-white to-zinc-50/60 p-2 shadow-sm ring-1 ring-zinc-900/5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{captionLabel}</p>
        <p className="text-[10px] font-semibold tabular-nums text-zinc-600">
          {todayLabel} <span className="text-accent">{today}</span>
        </p>
      </div>
      <div
        className="relative h-12 w-full"
        role="img"
        aria-label={`${captionLabel}: ${low} – ${high}. ${todayLabel}: ${today}.`}
      >
        {/* Playhead — today's price position. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 top-0 w-px bg-zinc-300/70"
          style={{ left: `${markerLeft}%` }}
        />
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="phb-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#16a34a" />
              <stop offset="55%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="phb-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#phb-area)" />
          <path
            d={line}
            fill="none"
            stroke="url(#phb-stroke)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Today marker — sits on the line at today's price position. */}
        <span
          className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
          style={{ left: `${markerLeft}%`, top: `${markerTop}%` }}
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
