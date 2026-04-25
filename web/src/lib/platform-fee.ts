/**
 * Marketplaces take a cut. One Lightning checkout to MDK: we model fee as
 * metadata (settlement to sellers is a future payout flow).
 * Min 5 sats, or 5% of listing price, whichever is higher.
 */
export function platformFeeSats(listingPriceSats: number): number {
  return Math.max(5, Math.ceil(listingPriceSats * 0.05));
}

export function totalCheckoutSats(listingPriceSats: number): number {
  return listingPriceSats + platformFeeSats(listingPriceSats);
}
