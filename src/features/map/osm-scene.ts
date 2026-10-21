import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl';
import type { ProvinceSummary } from '@/lib/domain';
import type { MapHouse } from './map-types';
import { buildOsmData } from './osm-data';

const THAILAND_BOUNDS: [[number, number], [number, number]] = [
  [97, 5],
  [106, 21],
];
const fallbackStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f5f2e9' } }],
};
const osmStreetStyle: StyleSpecification = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-raster', type: 'raster', source: 'osm-raster' }],
};
const pointLayers = ['pawmap-points'];

export async function createOsmScene(
  container: HTMLElement,
  callbacks: {
    province: (code: string) => void;
    houses: (houses: MapHouse[]) => void;
    bounds: (bounds: [number, number, number, number]) => void;
    fallback: () => void;
    error: () => void;
  },
) {
  // Next's bundle URL is not the package's dist directory. Keep the module worker
  // and its relative shared module together on our own origin.
  setWorkerUrl('/api/map-assets/maplibre-gl-worker.mjs');
  let provider: 'osm' | 'local' = 'osm',
    tileErrors = 0,
    destroyed = false,
    revision = 0;
  let signature = '',
    pointCount = 0;
  let current = buildOsmData([]);
  let active = true;
  const map = new MapLibreMap({
    container,
    style: osmStreetStyle,
    center: [100.8, 13.2],
    zoom: 4.8,
    minZoom: 4,
    maxZoom: 18,
    fadeDuration: 0,
    attributionControl: { compact: true },
  });
  container.dataset.osmProvider = provider;
  function hydrateMarkerImages() {
    // A tiny local sprite per category, not per place. One WebGL symbol pass
    // replaces three overlapping circle passes without clustering or DOM pins.
    for (const feature of current.data.features) {
      const properties = feature.properties!;
      const id = String(properties.icon);
      if (map.hasImage(id)) continue;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.scale(2, 2);
      context.shadowColor = 'rgba(24,28,26,0.23)';
      context.shadowBlur = 6;
      context.shadowOffsetY = 3;
      context.beginPath();
      context.arc(16, 15, 12, 0, Math.PI * 2);
      context.fillStyle = String(properties.color);
      context.fill();
      context.shadowColor = 'transparent';
      context.lineWidth = properties.construction ? 3 : 2;
      context.strokeStyle = properties.construction ? '#885714' : '#ffffff';
      context.stroke();
      context.beginPath();
      context.arc(16, 15, 2, 0, Math.PI * 2);
      context.fillStyle = '#ffffff';
      context.fill();
      map.addImage(id, context.getImageData(0, 0, 64, 64), { pixelRatio: 2 });
    }
  }
  function reportBounds() {
    if (!active || destroyed) return;
    container.dataset.osmZoom = String(map.getZoom());
    const bounds = map.getBounds();
    callbacks.bounds([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
  }
  function hydrateStyle() {
    if (destroyed || map.getSource('pawmap-points')) return;
    map.addSource('pawmap-provinces', {
      type: 'geojson',
      data: '/data/boundaries/provinces.geojson',
      attribution: 'Department of Disaster Prevention and Mitigation, Thailand',
    });
    map.addLayer({
      id: 'pawmap-province-fill',
      type: 'fill',
      source: 'pawmap-provinces',
      paint: { 'fill-color': '#2a9d80', 'fill-opacity': 0.06 },
    });
    map.addLayer({
      id: 'pawmap-province-outline',
      type: 'line',
      source: 'pawmap-provinces',
      paint: { 'line-color': '#147d69', 'line-opacity': 0.65, 'line-width': 1 },
    });
    hydrateMarkerImages();
    map.addSource('pawmap-points', {
      type: 'geojson',
      data: current.data,
      cluster: false,
    });
    map.addLayer({
      id: 'pawmap-points',
      type: 'symbol',
      source: 'pawmap-points',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-padding': 0,
      },
    });
    reportBounds();
  }
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  map.on('style.load', () => {
    hydrateStyle();
    resolveReady();
  });
  map.on('render', () => {
    if (map.getSource('pawmap-points') && map.isSourceLoaded('pawmap-points'))
      container.dataset.osmRenderedPoints = String(pointCount);
  });
  map.on('sourcedata', (event) => {
    if (
      event.sourceId === 'osm-raster' &&
      map.getSource('osm-raster') &&
      map.isSourceLoaded('osm-raster')
    )
      tileErrors = 0;
  });
  map.on('error', (event) => {
    if (destroyed) return;
    container.dataset.osmLastError = String(event.error?.message ?? 'Map error');
    if (!('sourceId' in event) || event.sourceId !== 'osm-raster') return;
    if (provider === 'osm' && ++tileErrors >= 3) {
      provider = 'local';
      container.dataset.osmProvider = provider;
      callbacks.fallback();
      map.setStyle(fallbackStyle);
    }
  });
  map.on('webglcontextlost', () => callbacks.error());
  map.on('moveend', reportBounds);
  map.on('click', (event) => {
    if (!active || destroyed) return;
    const layers = pointLayers.filter((id) => map.getLayer(id));
    const hits = layers.length ? map.queryRenderedFeatures(event.point, { layers }) : [];
    if (hits.length) {
      // World/tile copies can repeat a feature. Keep every distinct place at the
      // clicked pixels without moving its coordinates or aggregating its marker.
      const ids = [...new Set(hits.map((hit) => String(hit.properties.groupId)))];
      callbacks.houses(ids.flatMap((id) => current.groups.get(id) ?? []));
      return;
    }
    const province = map.getLayer('pawmap-province-fill')
      ? map.queryRenderedFeatures(event.point, { layers: ['pawmap-province-fill'] })[0]
      : undefined;
    const code = province?.properties?.code ?? province?.properties?.provinceCode;
    if (code) callbacks.province(String(code));
  });
  map.on('mousemove', (event) => {
    if (!active || destroyed || map.isMoving()) return;
    const layers = pointLayers.filter((id) => map.getLayer(id));
    map.getCanvas().style.cursor =
      layers.length && map.queryRenderedFeatures(event.point, { layers }).length ? 'pointer' : '';
  });
  return {
    ready,
    update(houses: MapHouse[]) {
      const nextSignature = JSON.stringify(houses);
      if (signature === nextSignature || destroyed) return;
      signature = nextSignature;
      revision++;
      pointCount = houses.length;
      current = buildOsmData(houses);
      const source = map.getSource('pawmap-points') as GeoJSONSource | undefined;
      if (source) {
        hydrateMarkerImages();
        source.setData(current.data);
      }
      container.dataset.osmSourceUpdates = String(revision);
    },
    setActive(value: boolean) {
      active = value;
      if (!active) map.stop();
    },
    reset() {
      map.fitBounds(THAILAND_BOUNDS, { padding: 36, duration: 500 });
    },
    zoom(factor: number) {
      map.easeTo({ zoom: map.getZoom() + Math.log2(factor), duration: 250 });
    },
    select(province: ProvinceSummary) {
      map.easeTo({
        center: [province.centroidLng, province.centroidLat],
        zoom: Math.max(map.getZoom(), 7),
      });
    },
    resize() {
      map.resize();
      reportBounds();
    },
    destroy() {
      destroyed = true;
      resolveReady();
      map.remove();
    },
  };
}
export type OsmScene = Awaited<ReturnType<typeof createOsmScene>>;
