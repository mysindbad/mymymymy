// A small map next to a place record, because "is this pin in the right town?" cannot be
// answered from a coordinate pair. It is deliberately read-only: nothing here moves a pin.
// The map itself stays geographically left-to-right even when the console is in Arabic.
import { useEffect, useRef, useState } from 'react';
import { useAdminLocale } from './locale-context';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

type PreviewState = 'loading' | 'ready' | 'no-tiles' | 'disabled';

export function MapPreview({ latitude, longitude, title }: { latitude: number; longitude: number; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PreviewState>('loading');
  const { t } = useAdminLocale();

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    let cancelled = false;
    let map: { remove: () => void } | null = null;
    setState('loading');

    void import('leaflet')
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        const instance = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
          dragging: true,
          attributionControl: true,
        }).setView([latitude, longitude], 13);
        L.tileLayer(OSM_TILES, {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        })
          .on('tileload', () => setState('ready'))
          .on('tileerror', () => setState((current) => (current === 'ready' ? current : 'no-tiles')))
          .addTo(instance);
        L.circleMarker([latitude, longitude], {
          radius: 7,
          color: '#1d47cf',
          weight: 2,
          fillColor: '#1d47cf',
          fillOpacity: 0.35,
        }).addTo(instance).bindTooltip(title, { direction: 'top' });
        map = instance;
        window.setTimeout(() => instance.invalidateSize(), 60);
      })
      .catch(() => setState('no-tiles'));

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [latitude, longitude, title]);

  return (
    <div dir="ltr" className="adm-map-shell">
      <div ref={containerRef} style={{ blockSize: '11rem' }} role="img" aria-label={t(`Map preview of ${title}`, `معاينة خريطة لـ${title}`, `Aperçu cartographique de ${title}`)} />
      {state === 'loading' ? (
        <span className="adm-note" style={{ position: 'absolute', insetBlockStart: '0.375rem', insetInlineStart: '0.5rem', background: 'var(--adm-surface)', padding: '0.0625rem 0.375rem', borderRadius: '4px' }}>
          {t('Loading tiles…', 'جارٍ تحميل الخريطة…', 'Chargement des tuiles…')}
        </span>
      ) : null}
      {state === 'no-tiles' ? (
        <span role="status" style={{ position: 'absolute', inset: 'auto 0.375rem 0.375rem 0.375rem', background: 'var(--adm-warn-soft)', color: 'var(--adm-warn)', padding: '0.25rem 0.375rem', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 700 }}>
          {t('Tile service unreachable — the pin is drawn from the stored coordinates only.', 'تعذّر الوصول إلى خدمة البلاطات — الدبوس مرسوم من الإحداثيات المخزّنة فقط.', 'Service de tuiles injoignable — le repère vient des coordonnées enregistrées.')}
        </span>
      ) : null}
    </div>
  );
}
