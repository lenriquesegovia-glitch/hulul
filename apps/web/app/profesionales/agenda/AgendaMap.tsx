'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export interface AgendaPoint { id: string; lat: number; lng: number; label: string; pending: boolean }

/** Mapa con todos los clientes de la agenda (OpenStreetMap, sin clave). */
export function AgendaMap({ points }: { points: AgendaPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const layer = useRef<import('leaflet').LayerGroup | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (off || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { attributionControl: true, scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      layer.current!.clearLayers();
      const bounds: [number, number][] = [];
      points.forEach((p, i) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;border-radius:50%;background:${p.pending ? '#9A5B34' : '#7A1E2C'};color:#fff;font:700 13px/30px system-ui;text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i + 1}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        });
        L.marker([p.lat, p.lng], { icon }).bindPopup(p.label).addTo(layer.current!);
        bounds.push([p.lat, p.lng]);
      });
      if (bounds.length === 1) map.current.setView(bounds[0], 15);
      else if (bounds.length) map.current.fitBounds(bounds, { padding: [30, 30] });
    })();
    return () => { off = true; };
  }, [points]);

  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);

  return (
    <div className="stack gap-4">
      <div ref={box} style={{ height: 300, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }} />
      <span className="muted" style={{ fontSize: 12.5 }}>Café: por aceptar · Vino: aceptadas</span>
    </div>
  );
}
