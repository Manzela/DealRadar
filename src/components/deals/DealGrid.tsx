import { DealCard } from './DealCard';
import type { NormalizedDeal } from '@/lib/providers/types';

/** Responsive grid per spec: 1 col mobile, 2 tablet, 3–4 desktop. */
export function DealGrid({ deals }: { deals: NormalizedDeal[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {deals.map((deal, i) => (
        // Mark the first row (up to 4 cols on xl) as priority for LCP.
        <DealCard key={deal.productId} deal={deal} priority={i < 4} />
      ))}
    </div>
  );
}
