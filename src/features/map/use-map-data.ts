'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapFilters, MapPoint, PlaceSummary, ProvinceSummary } from '@/lib/domain';
import type { ExploreMapView } from '@/lib/explore-url';
import type { ConstructionHouse } from './map-types';
import { loadMapGeography } from './map-geography';

type Bounds = [number, number, number, number];
type Snapshot = {
  points: (MapPoint | PlaceSummary)[];
  construction: ConstructionHouse[];
  key: string;
  signature: string;
};
const empty = (): Snapshot => ({ points: [], construction: [], key: '', signature: '' });
export function useMapData(
  view: ExploreMapView,
  filters: MapFilters,
  bounds: Bounds,
  retry: number,
) {
  const [visible, setVisible] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [snapshots, setSnapshots] = useState({ '3d': empty(), osm: empty() });
  const cache = useRef(snapshots);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    provinces: {} as Record<string, number>,
    facets: {} as Record<string, number>,
  });
  const paramsKey = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && key !== 'bbox')
        params.set(
          key === 'query' ? 'q' : key,
          Array.isArray(value) ? value.join(',') : String(value),
        );
    }
    return params.toString();
  }, [filters]);
  const boundsKey = bounds.join(',');
  useEffect(() => {
    const visibility = () => setVisible(!document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => {
      if (!document.hidden) setEpoch((value) => value + 1);
    }, 30000);
    const focus = () => {
      if (!document.hidden) setEpoch((value) => value + 1);
    };
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focus);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void loadMapGeography()
      .then((data) => {
        if (!cancelled) setProvinces(data.provinces);
      })
      .catch(() => {
        if (!cancelled) setError('โหลดจังหวัดไม่สำเร็จ / Unable to load provinces');
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void fetch(`/api/places/province-stats?${paramsKey}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('stats');
        const next = (await response.json()) as typeof stats;
        if (!controller.signal.aborted) {
          setStats((previous) =>
            JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
          );
          setStatsError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatsError('โหลดยอดรวมไม่สำเร็จ / Unable to refresh totals');
      });
    return () => controller.abort();
  }, [paramsKey, epoch, retry, visible]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const params = new URLSearchParams(paramsKey);
    params.set('bbox', boundsKey);
    const key = params.toString();
    const progressive = cache.current[view].key !== key;
    function publish(points: (MapPoint | PlaceSummary)[], construction: ConstructionHouse[]) {
      if (controller.signal.aborted) return;
      const signature = JSON.stringify([points, construction]);
      const old = cache.current[view];
      if (old.signature === signature && old.key === key) return;
      const next = { points, construction, key, signature };
      cache.current = { ...cache.current, [view]: next };
      setSnapshots(cache.current);
    }
    async function load() {
      try {
        const privatePromise = fetch(`/api/submissions/map?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        }).then(async (response) => {
          if (response.status === 401 || response.status === 403) return [] as ConstructionHouse[];
          if (!response.ok) throw new Error('private');
          return ((await response.json()) as { houses: ConstructionHouse[] }).houses;
        });
        // Attach a rejection handler immediately while public requests are in flight.
        const privateResult = privatePromise.then(
          (houses) => ({ houses, error: false }),
          () => ({ houses: [] as ConstructionHouse[], error: true }),
        );
        let latestPrivate: ConstructionHouse[] = [];
        void privateResult.then((result) => {
          latestPrivate = result.houses;
        });
        const points = new Map<string, MapPoint | PlaceSummary>();
        let cursor: number | null = 0;
        if (view === 'osm') params.set('detail', 'compact');
        do {
          params.set('cursor', String(cursor));
          const response = await fetch(`/api/places/map?${params}`, {
            signal: controller.signal,
            cache: 'no-store',
          });
          if (!response.ok) throw new Error('places');
          const data = (await response.json()) as {
            features: { properties: MapPoint | PlaceSummary }[];
            nextCursor?: number | null;
          };
          if (controller.signal.aborted) return;
          for (const feature of data.features)
            points.set(feature.properties.id, feature.properties);
          const following: number | null = data.nextCursor ?? null;
          if (following !== null && following <= cursor) throw new Error('Invalid cursor');
          cursor = following;
          if (progressive) publish([...points.values()], latestPrivate);
        } while (cursor !== null && !controller.signal.aborted);
        const privateData = await privateResult;
        if (!controller.signal.aborted) {
          publish([...points.values()], privateData.houses);
          setError(
            privateData.error ? 'โหลดรายการส่วนตัวไม่สำเร็จ / Cannot refresh private places' : '',
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          // Public data may stay visible during an outage; private data must not linger.
          const previous = cache.current[view];
          publish(previous.points, []);
          setError(
            'รีเฟรชไม่สำเร็จ กำลังแสดงข้อมูลล่าสุดที่โหลดได้ / Refresh failed; showing last available data',
          );
        }
      }
    }
    // The first view does not wait for a gesture debounce; subsequent bbox changes do.
    const timer = setTimeout(() => void load(), cache.current[view].key ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [view, paramsKey, boundsKey, epoch, retry, visible]);
  return { ...snapshots[view], stats, provinces, error: error || statsError, visible };
}
