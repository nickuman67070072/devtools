import type { ProvinceSummary, DistrictSummary } from '@/lib/domain';

let pending: Promise<{ provinces: ProvinceSummary[]; districts: DistrictSummary[] }> | undefined;
export function loadMapGeography() {
  pending ??= fetch('/api/geography')
    .then(async (response) => {
      if (!response.ok) throw new Error('geography');
      return response.json() as Promise<{
        provinces: ProvinceSummary[];
        districts: DistrictSummary[];
      }>;
    })
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
