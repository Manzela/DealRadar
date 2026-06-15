/** Currency / number formatting scoped to the active locale. */
export function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDiscount(percent: number): string {
  return `-${Math.round(percent)}%`;
}
