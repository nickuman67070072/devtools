'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrandLoading } from '@/components/brand-loading';
import type { MapFilters, MapPoint, PlaceSummary, ProvinceSummary } from '@/lib/domain';
import type { Locale } from '@/lib/i18n';
import type { ExploreMapView } from '@/lib/explore-url';
import type { createThailandScene } from './thailand-scene';
import type { OsmScene } from './osm-scene';
import type { MapHouse, ConstructionHouse } from './map-types';
import { useMapData } from './use-map-data';

function PageControls({
  page,
  count,
  setPage,
  th,
  label,
}: {
  page: number;
  count: number;
  setPage: (page: number) => void;
  th: boolean;
  label: string;
}) {
  if (count <= 50) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2 py-2">
      <button
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
        className="min-h-10 disabled:opacity-40"
      >
        {th ? 'ก่อนหน้า' : 'Previous'}
      </button>
      <span>
        {page + 1}/{Math.ceil(count / 50)}
      </span>
      <button
        disabled={(page + 1) * 50 >= count}
        onClick={() => setPage(page + 1)}
        className="min-h-10 disabled:opacity-40"
      >
        {th ? 'ถัดไป' : 'Next'}
      </button>
    </nav>
  );
}

export function MapCanvas(props: {
  locale: Locale;
  filters: MapFilters;
  onPlaceSelect: (place: PlaceSummary | null) => void;
  onProvinceSelect: (province: ProvinceSummary) => void;
  onResults: (total: number, facets: Record<string, number>) => void;
  selectedPlaceSlug?: string;
  view: ExploreMapView;
  osmActivated: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    osmContainer = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createThailandScene> | null>(null);
  const osmScene = useRef<OsmScene | null>(null);
  const latest = useRef(props);
  const provinces = useRef<ProvinceSummary[]>([]);
  const [activated3d, setActivated3d] = useState(props.view === '3d');
  const [ready, setReady] = useState(false),
    [osmReady, setOsmReady] = useState(false);
  const [osmFallback, setOsmFallback] = useState(false),
    [osmError, setOsmError] = useState('');
  const [osmRetry, setOsmRetry] = useState(0),
    [modelError, setModelError] = useState('');
  const [retry, setRetry] = useState(0),
    [dataRetry, setDataRetry] = useState(0);
  const [clusterSelection, setCluster] = useState<MapHouse[]>([]);
  const [listPage, setListPage] = useState(0),
    [privatePage, setPrivatePage] = useState(0),
    [clusterPage, setClusterPage] = useState(0);
  const [bbox3d, setBbox3d] = useState<[number, number, number, number]>([97, 5, 106, 21]);
  const [bboxOsm, setBboxOsm] = useState<[number, number, number, number]>([97, 5, 106, 21]);
  const selectedProvince3d = useRef<string | undefined>(undefined),
    selectedProvinceOsm = useRef<string | undefined>(undefined);
  const data = useMapData(
    props.view,
    props.filters,
    props.view === 'osm' ? bboxOsm : bbox3d,
    dataRetry,
  );
  const { points: places, construction, error, visible } = data;
  const total = data.stats.total;
  const th = props.locale === 'th';
  const detailController = useRef<AbortController | null>(null);
  const [detail, setDetail] = useState({ id: '', loading: false, error: '' });
  const constructionHref = (house: ConstructionHouse) =>
    `${!th && !house.href.startsWith('/admin/') ? '/en' : ''}${house.href}`;
  useEffect(() => {
    latest.current = props;
    provinces.current = data.provinces;
  }, [props, data.provinces]);
  const selectPoint = useCallback(
    async (point: MapPoint | PlaceSummary | string, fromUrl = false) => {
      detailController.current?.abort();
      const controller = new AbortController();
      detailController.current = controller;
      const id = typeof point === 'string' ? point : point.id;
      if (typeof point !== 'string' && 'descriptionTh' in point) {
        setDetail({ id: '', loading: false, error: '' });
        latest.current.onPlaceSelect(point);
        return;
      }
      setDetail({ id, loading: true, error: '' });
      if (!fromUrl) latest.current.onPlaceSelect(null);
      try {
        const response = await fetch('/api/places/' + encodeURIComponent(id), {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'ไม่พบสถานที่หรือไม่เปิดเผยแล้ว / Place no longer available'
              : 'โหลดรายละเอียดไม่สำเร็จ / Cannot load details',
          );
        const place = (await response.json()) as PlaceSummary;
        if (!controller.signal.aborted) {
          latest.current.onPlaceSelect(place);
          setDetail({ id: '', loading: false, error: '' });
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setDetail({
            id,
            loading: false,
            error: failure instanceof Error ? failure.message : 'Unable to load details',
          });
      }
    },
    [],
  );
  useEffect(() => () => detailController.current?.abort(), []);
  useEffect(() => {
    if (!props.selectedPlaceSlug) return;
    const id = props.selectedPlaceSlug;
    let controller: AbortController | null = null;
    const timer = setTimeout(() => {
      void selectPoint(id, true);
      controller = detailController.current;
    }, 0);
    return () => {
      clearTimeout(timer);
      if (controller && controller === detailController.current) {
        controller.abort();
        setDetail({ id: '', loading: false, error: '' });
      }
    };
  }, [props.selectedPlaceSlug, selectPoint]);
  const onHouses = useCallback(
    (houses: MapHouse[]) => {
      setCluster(houses);
      setClusterPage(0);
      if (houses.length === 1 && (houses[0]?.place || houses[0]?.point))
        void selectPoint((houses[0].place ?? houses[0].point)!);
    },
    [selectPoint],
  );
  if (props.view === '3d' && !activated3d) setActivated3d(true);
  useEffect(() => {
    if (!activated3d) return;
    let cancelled = false;
    let api: ReturnType<typeof createThailandScene> | undefined;
    void (async () => {
      try {
        const module = await import('./thailand-scene');
        if (cancelled || !container.current) return;
        api = module.createThailandScene(container.current, {
          province(code) {
            const province = provinces.current.find((item) => item.code === code);
            if (province) latest.current.onProvinceSelect(province);
          },
          houses: onHouses,
          bounds(bounds) {
            if (latest.current.view === '3d')
              setBbox3d((current) =>
                current.every((value, index) => Math.abs(value - bounds[index]!) < 0.001)
                  ? current
                  : bounds,
              );
          },
          error() {
            setModelError('WebGL หยุดทำงาน / WebGL context lost');
          },
        });
        scene.current = api;
        api.setActive(latest.current.view === '3d' && !document.hidden);
        await api.ready;
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setModelError('ไม่สามารถเปิดโมเดล 3D / Cannot load 3D model');
      }
    })();
    return () => {
      cancelled = true;
      api?.destroy();
      scene.current = null;
    };
  }, [activated3d, retry, onHouses]);
  useEffect(() => {
    if (!props.osmActivated) return;
    let cancelled = false;
    let api: OsmScene | undefined;
    void (async () => {
      try {
        const module = await import('./osm-scene');
        if (cancelled || !osmContainer.current) return;
        api = await module.createOsmScene(osmContainer.current, {
          province(code) {
            const province = provinces.current.find((item) => item.code === code);
            if (province) latest.current.onProvinceSelect(province);
          },
          houses: onHouses,
          bounds(bounds) {
            if (latest.current.view === 'osm')
              setBboxOsm((current) =>
                current.every((value, index) => Math.abs(value - bounds[index]!) < 0.001)
                  ? current
                  : bounds,
              );
          },
          fallback() {
            setOsmFallback(true);
          },
          error() {
            setOsmError('แผนที่ถนนหยุดทำงาน / Street map stopped working');
          },
        });
        if (cancelled) {
          api.destroy();
          return;
        }
        osmScene.current = api;
        api.setActive(latest.current.view === 'osm' && !document.hidden);
        await api.ready;
        if (!cancelled) setOsmReady(true);
      } catch {
        if (!cancelled) setOsmError('ไม่สามารถเปิดแผนที่ถนน / Cannot load street map');
      }
    })();
    return () => {
      cancelled = true;
      api?.destroy();
      osmScene.current = null;
    };
  }, [props.osmActivated, osmRetry, onHouses]);
  useEffect(() => {
    scene.current?.setActive(props.view === '3d' && visible);
    osmScene.current?.setActive(props.view === 'osm' && visible);
    if (props.view === 'osm' && visible) osmScene.current?.resize();
  }, [props.view, visible, ready, osmReady]);
  const houses = useMemo(
    () =>
      [
        ...places.map((place) => ({
          ...place,
          color: place.categoryColor,
          ...('descriptionTh' in place ? { place } : { point: place }),
        })),
        ...construction.map((house) => ({ ...house, color: '#e8a32a', construction: house })),
      ] as MapHouse[],
    [places, construction],
  );
  const last3dSignature = useRef('');
  const cluster = useMemo(() => {
    const ids = new Set(clusterSelection.map((house) => house.id));
    // An open list must not retain private markers after access is revoked.
    return houses.filter((house) => ids.has(house.id));
  }, [houses, clusterSelection]);
  useEffect(() => {
    if (!visible) return;
    if (props.view === 'osm' && osmReady) osmScene.current?.update(houses);
    else if (props.view === '3d' && ready) {
      const signature = JSON.stringify([houses, data.stats.provinces, retry]);
      if (signature !== last3dSignature.current) {
        scene.current?.update(houses, data.stats.provinces);
        last3dSignature.current = signature;
      }
    }
  }, [houses, data.stats.provinces, visible, props.view, ready, osmReady, retry]);
  useEffect(() => {
    if (!visible) return;
    const province = data.provinces.find(
      (item) => item.code === props.filters.province || item.slug === props.filters.province,
    );
    if (props.view === '3d' && ready && selectedProvince3d.current !== props.filters.province) {
      if (province) scene.current?.select(province.code);
      else scene.current?.reset();
      selectedProvince3d.current = props.filters.province;
    }
    if (
      props.view === 'osm' &&
      osmReady &&
      selectedProvinceOsm.current !== props.filters.province
    ) {
      if (province) osmScene.current?.select(province);
      else osmScene.current?.reset();
      selectedProvinceOsm.current = props.filters.province;
    }
  }, [props.view, props.filters.province, data.provinces, ready, osmReady, visible]);
  useEffect(() => {
    latest.current.onResults(data.stats.total, data.stats.facets);
  }, [data.stats]);
  const listKey = JSON.stringify([props.view, props.filters]);
  const [previousListKey, setPreviousListKey] = useState(listKey);
  if (previousListKey !== listKey) {
    setPreviousListKey(listKey);
    setListPage(0);
    setPrivatePage(0);
    setCluster([]);
    setClusterPage(0);
  }
  if (listPage > 0 && listPage * 50 >= places.length)
    setListPage(Math.max(0, Math.ceil(places.length / 50) - 1));
  if (privatePage > 0 && privatePage * 50 >= construction.length)
    setPrivatePage(Math.max(0, Math.ceil(construction.length / 50) - 1));
  if (clusterPage > 0 && clusterPage * 50 >= cluster.length)
    setClusterPage(Math.max(0, Math.ceil(cluster.length / 50) - 1));
  const button =
    'min-h-10 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-semibold';
  return (
    <div className="relative h-full min-h-[560px] overflow-hidden bg-[#f4f3ee]">
      <div
        ref={container}
        className={props.view === '3d' ? 'h-full min-h-[560px] w-full' : 'hidden'}
        role="region"
        aria-label={th ? 'แผนที่ประเทศไทยแบบโต้ตอบ' : 'Interactive map of Thailand'}
        data-model-ready={ready}
      />
      <div
        ref={osmContainer}
        className={props.view === 'osm' ? 'h-full min-h-[560px] w-full' : 'hidden'}
        role="region"
        aria-label={th ? 'แผนที่ถนนประเทศไทย' : 'Street map of Thailand'}
        data-osm-ready={osmReady}
        data-osm-fallback={osmFallback}
      />
      {!(props.view === '3d' ? ready : osmReady) &&
        !(props.view === '3d' ? modelError : osmError) && (
          <BrandLoading
            locale={props.locale}
            label={
              th
                ? props.view === '3d'
                  ? 'กำลังสร้างแผนที่ประเทศไทย 3D…'
                  : 'กำลังเตรียมแผนที่ถนน…'
                : props.view === '3d'
                  ? 'Building the Thailand 3D map…'
                  : 'Preparing the street map…'
            }
          />
        )}
      <div className="absolute left-4 top-28 z-10 flex flex-wrap gap-2 lg:top-4">
        <button
          className={button}
          aria-label={th ? 'กลับไปมุมมองประเทศไทย' : 'Reset Thailand view'}
          onClick={() => (props.view === '3d' ? scene.current?.reset() : osmScene.current?.reset())}
        >
          {th ? 'มุมมองประเทศ' : 'Reset'}
        </button>
        <button
          className={button}
          aria-label={th ? 'ซูมเข้า' : 'Zoom in'}
          onClick={() =>
            props.view === '3d' ? scene.current?.zoom(1.4) : osmScene.current?.zoom(1.4)
          }
        >
          +
        </button>
        <button
          className={button}
          aria-label={th ? 'ซูมออก' : 'Zoom out'}
          onClick={() =>
            props.view === '3d' ? scene.current?.zoom(1 / 1.4) : osmScene.current?.zoom(1 / 1.4)
          }
        >
          −
        </button>
      </div>
      <div
        className="absolute bottom-16 left-4 right-4 rounded-md border border-[var(--border)] bg-white/95 p-3 text-xs lg:bottom-10 lg:right-auto lg:max-w-sm"
        role="status"
      >
        {(props.view === '3d' ? modelError : osmError) ||
          error ||
          (!(props.view === '3d' ? ready : osmReady)
            ? th
              ? props.view === '3d'
                ? 'กำลังโหลดประเทศไทย 3D…'
                : 'กำลังโหลดแผนที่ถนน…'
              : props.view === '3d'
                ? 'Loading Thailand 3D…'
                : 'Loading street map…'
            : th
              ? props.view === '3d'
                ? `${places.length} บ้านในมุมมอง / ${total} สถานที่ตามตัวกรอง · ความสูงตามยอดรวมจังหวัด`
                : `${places.length} หมุดในมุมมอง / ${total} สถานที่ตามตัวกรอง${osmFallback ? ' · ใช้ขอบเขตจังหวัดในเครื่อง' : ''}`
              : props.view === '3d'
                ? `${places.length} visible houses / ${total} matching places · Height follows province totals`
                : `${places.length} visible markers / ${total} matching places${osmFallback ? ' · Local province fallback' : ''}`)}
        {(props.view === '3d' ? ready : osmReady) && !error && (
          <p className="mt-1">
            {props.view === '3d'
              ? th
                ? 'ลากเพื่อหมุน · คลิกขวาลากเพื่อเลื่อน · คลิกบ้านดูข้อมูล · อัปเดตทุก 30 วินาที'
                : 'Drag to rotate · Right-drag to pan · Select a house · Refreshes every 30 seconds'
              : th
                ? 'ลากเพื่อเลื่อน · คลิกหมุดดูข้อมูล · อัปเดตทุก 30 วินาที'
                : 'Drag to pan · Select a marker · Refreshes every 30 seconds'}
          </p>
        )}
        {(error || (props.view === '3d' ? modelError : osmError)) && (
          <button
            className={button}
            onClick={() => {
              setDataRetry((value) => value + 1);
              if (props.view === '3d' && modelError) {
                setModelError('');
                setReady(false);
                selectedProvince3d.current = undefined;
                setRetry((value) => value + 1);
              } else if (props.view === 'osm' && osmError) {
                setOsmError('');
                setOsmFallback(false);
                setOsmReady(false);
                selectedProvinceOsm.current = undefined;
                setOsmRetry((value) => value + 1);
              }
            }}
          >
            {th ? 'ลองใหม่' : 'Retry'}
          </button>
        )}
        {(props.view === '3d' ? ready : osmReady) && places.length === 0 && !error && (
          <p>
            {th
              ? 'ไม่พบสถานที่ตามตัวกรอง ลองล้างตัวกรองหรือตรวจสถานะการอนุมัติ'
              : 'No matching places. Clear filters or check approval status.'}
          </p>
        )}
      </div>
      <details className="absolute top-44 right-4 z-10 max-h-60 w-56 overflow-auto rounded-xl bg-white/95 p-3 text-xs shadow lg:top-16">
        <summary className="cursor-pointer font-bold">
          {th ? 'เลือกสถานที่' : 'Select a place'} ({places.length})
        </summary>
        {places.slice(listPage * 50, listPage * 50 + 50).map((place) => (
          <button
            key={place.id}
            className="block min-h-10 w-full border-b p-2 text-left"
            onClick={() => void selectPoint(place)}
          >
            {th ? place.nameTh : place.nameEn}
          </button>
        ))}
        {construction.slice(privatePage * 50, privatePage * 50 + 50).map((house) => (
          <a
            key={house.id}
            className="block min-h-10 border-b p-2 text-[#76510a]"
            href={constructionHref(house)}
          >
            {th ? house.nameTh : house.nameEn} ·{' '}
            {th ? 'กำลังก่อสร้าง (ส่วนตัว)' : 'Under construction (private)'} · {house.status}
          </a>
        ))}
        <PageControls
          page={listPage}
          count={places.length}
          setPage={setListPage}
          th={th}
          label={th ? 'สถานที่' : 'Places'}
        />
        <PageControls
          page={privatePage}
          count={construction.length}
          setPage={setPrivatePage}
          th={th}
          label={th ? 'รายการส่วนตัว' : 'Private places'}
        />
      </details>
      {cluster.length > 1 && (
        <section
          aria-label={th ? 'สถานที่พิกัดเดียวกัน' : 'Places at this location'}
          className="absolute right-4 top-56 z-20 max-h-72 w-60 overflow-auto rounded-xl bg-white p-4 shadow-xl lg:top-44"
        >
          <button className={button} onClick={() => setCluster([])}>
            {th ? 'ปิด' : 'Close'}
          </button>
          <p>
            {cluster.length} {th ? 'สถานที่ตรงจุดนี้' : 'places here'}
          </p>
          {cluster.slice(clusterPage * 50, clusterPage * 50 + 50).map((house) =>
            house.place || house.point ? (
              <button
                key={house.id}
                className="block min-h-10 w-full text-left"
                onClick={() => {
                  void selectPoint((house.place ?? house.point)!);
                  setCluster([]);
                }}
              >
                {th ? (house.place ?? house.point)!.nameTh : (house.place ?? house.point)!.nameEn}
              </button>
            ) : (
              <a
                key={house.id}
                className="block min-h-10"
                href={house.construction ? constructionHref(house.construction) : undefined}
              >
                {house.construction?.nameTh} · {th ? 'กำลังก่อสร้าง' : 'Under construction'}
              </a>
            ),
          )}
          <PageControls
            page={clusterPage}
            count={cluster.length}
            setPage={setClusterPage}
            th={th}
            label={th ? 'กลุ่มสถานที่' : 'Group'}
          />
        </section>
      )}
      {detail.id && (detail.loading || detail.error) && (
        <div
          role="status"
          className="absolute right-4 top-60 z-30 max-w-xs rounded-xl border bg-white p-4 text-sm"
        >
          {detail.loading ? (th ? 'กำลังโหลดรายละเอียด…' : 'Loading place details…') : detail.error}
          {detail.error && (
            <button className={button} onClick={() => void selectPoint(detail.id)}>
              {th ? 'ลองใหม่' : 'Retry'}
            </button>
          )}
          <button
            className={button}
            onClick={() => {
              detailController.current?.abort();
              setDetail({ id: '', loading: false, error: '' });
            }}
          >
            {th ? 'ปิด' : 'Close'}
          </button>
        </div>
      )}
      {cluster.length === 1 && cluster[0]?.construction && (
        <a
          className="absolute right-4 top-56 z-20 rounded-xl bg-white p-4 shadow lg:top-44"
          href={constructionHref(cluster[0].construction)}
        >
          {cluster[0].construction.nameTh} · {th ? 'เปิดฉบับร่าง' : 'Open submission'}
        </a>
      )}
      {props.view === '3d' && (
        <p className="absolute bottom-1 right-2 text-[10px] text-[#40554c]">
          © OpenStreetMap contributors · geoBoundaries · ODbL ·{' '}
          <a href="/models/ATTRIBUTION.txt" className="underline">
            Model attribution
          </a>
        </p>
      )}
    </div>
  );
}
