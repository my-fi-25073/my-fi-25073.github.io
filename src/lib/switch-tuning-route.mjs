/**
 * Build the published route from the tuning's image-owner digest or its one-based position.
 * @param {string} productSlug
 * @param {number} position
 * @param {string | null} ownerDigest
 */
export function publicSwitchTuningRoute(productSlug, position, ownerDigest = null) {
  if (!Number.isInteger(position) || position < 1
    || (ownerDigest !== null && !/^[a-f0-9]{12}$/u.test(ownerDigest))) {
    throw new Error(`Invalid public Switch tuning route: ${productSlug}, entry ${position}`);
  }
  const key = ownerDigest ?? String(position);
  return { key, href: `/switches/${productSlug}/tunings/${key}/` };
}
