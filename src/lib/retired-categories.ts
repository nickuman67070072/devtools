// Tombstones prevent the original import files from resurrecting retired data.
export const retiredCategoryCodes = [
  'EMERGENCY',
  'GLAMPING',
  'PET_REHABILITATION',
  'PET_PHOTOGRAPHY_STUDIO',
  'PET_SPA',
  'COWORKING',
  'RIVER_LAKE_RECREATION',
  'SCENIC_VIEWPOINT',
  'FLOWER_GARDEN',
  'TOURIST_ATTRACTION',
  'FARM_OUTDOOR',
  'MARKET_WALKING_STREET',
  'ART_CREATIVE_SPACE',
] as const;
const retired = new Set<string>(retiredCategoryCodes);
export function retiredCategoriesIn(codes: readonly string[]): string[] {
  return [...new Set(codes.map((code) => (code === 'EMERGENCY_24H' ? 'EMERGENCY' : code)))].filter(
    (code) => retired.has(code),
  );
}
