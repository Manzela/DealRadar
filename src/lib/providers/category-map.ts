/** Best-effort mapping of arbitrary external category strings → DealRadar slugs. */
import type { CategorySlug } from './types';

const RULES: [RegExp, CategorySlug][] = [
  [/electro|computer|phone|tv|audio|camera|gaming|tech/i, 'electronics'],
  [/fashion|cloth|apparel|shoe|sneaker|bag|jewel|watch(?!.*smart)/i, 'fashion'],
  [/home|garden|furnit|kitchen|diy|tool|decor/i, 'home-garden'],
  [/sport|fitness|outdoor|bike|cycl|run/i, 'sports'],
  [/beaut|cosmetic|perfume|skincare|health/i, 'beauty'],
  [/food|grocer|drink|beverage|wine|coffee/i, 'food-grocery'],
  [/toy|game(?!.*video)|lego|puzzle|kids/i, 'toys'],
  [/auto|car|tyre|tire|motor/i, 'automotive'],
  [/book|ebook|literature/i, 'books'],
  [/travel|luggage|holiday|flight|hotel/i, 'travel'],
];

export function mapExternalCategory(external: string): CategorySlug {
  for (const [re, slug] of RULES) if (re.test(external)) return slug;
  return 'electronics'; // least-bad default; refine with provider-specific maps
}
