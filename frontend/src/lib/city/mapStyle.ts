const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/**
 * Basemap style URL for the city console — a clean, pale "positron"-style basemap
 * so data overlays and routes read clearly on the light UI.
 */
export function cityMapStyle(): string {
  return MAPTILER_KEY
    ? `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`
    : "https://tiles.openfreemap.org/styles/positron";
}
