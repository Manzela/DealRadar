/**
 * Shop name for display: drops storefront suffixes like "Online" /
 * "Onlineshop" so only the brand remains (e.g. "Lidl Online" -> "Lidl").
 */
export function displayShopName(name: string): string {
  return name.replace(/\s+online(\s?shop)?$/i, '').trim();
}
