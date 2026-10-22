'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { travelEstimate, type LatLng } from '@hulul/shared';
import type { LivePosition } from '@hulul/shared/firebase';

/** "hace 12 s", "hace 3 min". */
function ago(d?: Date): string {
  if (!d) return '';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
}

/**
 * Mapa en vivo del profesional en camino (OpenStreetMap). Se actualiza solo
 * cada vez que el profesional comparte su posición.
 */
export function LiveMap({ bookingId, destination, name }: { bookingId: string; destination?: LatLng; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const proMarker = useRef<import('leaflet').Marker | null>(null);
  const fitted = useRef(false);
  const [pos, setPos] = useState<LivePosition | null | undefined>(undefined);
  const [, tick] = useState(0);

  // Escucha la posición en vivo.
  useEffect(() => {
    let unsub = () => {};
    let off = false;
    import('@hulul/shared/firebase').then(({ watchLivePosition }) => {
      if (!off) unsub = watchLivePosition(bookingId, setPos);
    });
    const t = setInterval(() => tick((n) => n + 1), 10_000);
    return () => { off = true; unsub(); clearInterval(t); };
  }, [bookingId]);

  // Dibuja o mueve los marcadores.
  useEffect(() => {
    let off = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (off || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { attributionControl: true, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
        if (destination) {
          L.marker([destination.lat, destination.lng], {
            icon: L.divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 28],
              html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#182D2E;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>' }),
          }).bindPopup('Tu dirección').addTo(map.current);
          map.current.setView([destination.lat, destination.lng], 14);
        } else {
          map.current.setView([-2.17, -79.92], 12);
        }
      }
      if (pos) {
        const ll: [number, number] = [pos.lat, pos.lng];
        if (!proMarker.current) {
          proMarker.current = L.marker(ll, {
            icon: L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18],
              html: '<div style="width:36px;height:36px;border-radius:50%;background:#123F43;color:#fff;font:700 15px/36px system-ui;text-align:center;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">🚗</div>' }),
            zIndexOffset: 1000,
          }).bindPopup(name).addTo(map.current);
        } else {
          proMarker.current.setLatLng(ll);
        }
        if (!fitted.current) {
          fitted.current = true;
          if (destination) map.current.fitBounds([ll, [destination.lat, destination.lng]], { padding: [40, 40], maxZoom: 16 });
          else map.current.setView(ll, 15);
        }
      }
    })();
    return () => { off = true; };
  }, [pos, destination, name]);

  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);

  const eta = pos && destination ? travelEstimate(pos, destination) : null;
  const stale = pos?.at && Date.now() - pos.at.getTime() > 3 * 60_000;

  return (
    <div className="stack gap-8">
      <div ref={box} style={{ height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }} aria-label={`Ubicación en vivo de ${name}`} />
      <span className="muted" style={{ fontSize: 14 }}>
        {pos === undefined && 'Buscando la ubicación…'}
        {pos === null && `${name} aún no comparte su ubicación. Aparecerá aquí apenas salga con su agenda abierta.`}
        {pos && <>
          {eta ? <>A unos <strong>{eta.km} km</strong>, llega en aprox. <strong>{eta.minutes} min</strong>. </> : null}
          Actualizado {ago(pos.at)}.{stale ? ' La señal se detuvo; puede que haya cerrado la agenda o no tenga datos.' : ''}
        </>}
      </span>
    </div>
  );
}
