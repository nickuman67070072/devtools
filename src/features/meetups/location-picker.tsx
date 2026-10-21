'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n';

export type SearchPoint = { latitude: number; longitude: number };

export function MeetupLocationPicker({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: SearchPoint | null;
  onChange: (point: SearchPoint | null) => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [manualFallback, setManualFallback] = useState(false);
  const pointRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const isThai = locale === 'th';

  useEffect(() => {
    pointRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  useEffect(() => {
    if (!open || !mapElement.current) return;
    let disposed = false;
    let map: import('maplibre-gl').Map | undefined;
    let marker: import('maplibre-gl').Marker | undefined;
    void import('maplibre-gl')
      .then((maplibre) => {
        if (disposed || !mapElement.current) return;
        map = new maplibre.Map({
          container: mapElement.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          },
          center: pointRef.current
            ? [pointRef.current.longitude, pointRef.current.latitude]
            : [100.5, 13.75],
          zoom: pointRef.current ? 12 : 5,
          attributionControl: { compact: true },
        });
        if (pointRef.current)
          marker = new maplibre.Marker({ color: '#2d5a43' })
            .setLngLat([pointRef.current.longitude, pointRef.current.latitude])
            .addTo(map);
        map.on('click', (event) => {
          const point = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
          marker?.remove();
          marker = new maplibre.Marker({ color: '#2d5a43' }).setLngLat(event.lngLat).addTo(map!);
          onChangeRef.current(point);
          setError('');
        });
        map.on('error', () => setManualFallback(true));
      })
      .catch(() => setManualFallback(true));
    return () => {
      disposed = true;
      marker?.remove();
      map?.remove();
    };
  }, [open]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(
        isThai
          ? 'เบราว์เซอร์นี้ไม่รองรับตำแหน่ง กรุณาปักจุดเอง'
          : 'Location is unavailable. Pick a point manually.',
      );
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
        setOpen(false);
      },
      () => {
        setLocating(false);
        setError(
          isThai
            ? 'ไม่ได้รับตำแหน่ง กรุณาเลือกจุดบนแผนที่แทน'
            : 'Could not get your location. Pick a point on the map instead.',
        );
        setOpen(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4">
      <p className="text-sm font-semibold">{isThai ? 'จุดเริ่มค้นหา' : 'Search from'}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={useCurrentLocation} disabled={locating}>
          {locating
            ? isThai
              ? 'กำลังหาตำแหน่ง…'
              : 'Locating…'
            : isThai
              ? 'ใช้ตำแหน่งปัจจุบัน'
              : 'Use current location'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen((current) => !current)}>
          {isThai ? 'เลือกจุดบนแผนที่' : 'Pick on map'}
        </Button>
        {value && (
          <Button variant="ghost" onClick={() => onChange(null)}>
            {isThai ? 'ล้างจุด' : 'Clear point'}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--terracotta)]">
          {error}
        </p>
      )}
      {value && (
        <p className="text-xs text-[var(--text-muted)]">
          {isThai ? 'จุดที่เลือก' : 'Selected point'}: {value.latitude.toFixed(4)},{' '}
          {value.longitude.toFixed(4)} · {isThai ? 'ไม่บันทึกพิกัดนี้' : 'This point is not saved'}
        </p>
      )}
      {open && (
        <div>
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            {isThai
              ? 'แตะบนแผนที่เพื่อปักจุด คุณสามารถเลื่อนและซูมก่อนเลือก'
              : 'Pan and zoom, then tap the map to choose a point.'}
          </p>
          <div
            ref={mapElement}
            className="h-80 w-full overflow-hidden rounded-xl border border-[var(--border)]"
            role="application"
            aria-label={isThai ? 'แผนที่เลือกจุดค้นหา' : 'Search point map'}
          />
          {manualFallback && (
            <p role="alert" className="mt-2 text-sm">
              {isThai
                ? 'แผนที่โหลดไม่ได้ กรุณาใช้ GPS หรือค้นหาตามจังหวัด'
                : 'The map could not load. Use GPS or search by province.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
