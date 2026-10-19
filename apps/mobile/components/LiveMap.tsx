import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { GUAYAQUIL, travelEstimate, type LatLng } from '@hulul/shared';
import { watchLivePosition, type LivePosition } from '@hulul/shared/firebase';
import { Body } from '@/components/ui';
import { c, font, radius } from '@/theme';

const ago = (d?: Date) => {
  if (!d) return '';
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
};

/** Mapa en vivo del profesional en camino; se mueve solo cada vez que comparte su posición. */
export function LiveMap({ bookingId, destination, name }: { bookingId: string; destination?: LatLng; name: string }) {
  const map = useRef<MapView>(null);
  const fitted = useRef(false);
  const [pos, setPos] = useState<LivePosition | null | undefined>(undefined);
  const [, tick] = useState(0);

  useEffect(() => {
    const unsub = watchLivePosition(bookingId, setPos);
    const t = setInterval(() => tick((n) => n + 1), 10_000);
    return () => { unsub(); clearInterval(t); };
  }, [bookingId]);

  // La primera vez, encuadra al profesional y la dirección.
  useEffect(() => {
    if (!pos || fitted.current || !map.current) return;
    fitted.current = true;
    const pts = [{ latitude: pos.lat, longitude: pos.lng }, ...(destination ? [{ latitude: destination.lat, longitude: destination.lng }] : [])];
    map.current.fitToCoordinates(pts, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
  }, [pos, destination]);

  const center = destination ?? GUAYAQUIL;
  const eta = pos && destination ? travelEstimate(pos, destination) : null;
  const stale = pos?.at && Date.now() - pos.at.getTime() > 3 * 60_000;

  return (
    <View style={{ gap: 8 }}>
      <View style={s.box}>
        <MapView ref={map} style={{ flex: 1 }}
          initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }}>
          {destination && <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Tu dirección" pinColor={c.text} />}
          {pos && (
            <Marker coordinate={{ latitude: pos.lat, longitude: pos.lng }} title={name} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={s.pro}><Text style={{ fontSize: 16 }}>🚗</Text></View>
            </Marker>
          )}
        </MapView>
      </View>
      <Body muted style={{ fontSize: 13 }}>
        {pos === undefined && 'Buscando la ubicación…'}
        {pos === null && `${name} aún no comparte su ubicación. Aparecerá aquí apenas salga con su agenda abierta.`}
        {pos ? `${eta ? `A unos ${eta.km} km, llega en aprox. ${eta.minutes} min. ` : ''}Actualizado ${ago(pos.at)}.${stale ? ' La señal se detuvo; puede que haya cerrado la agenda o no tenga datos.' : ''}` : ''}
      </Body>
    </View>
  );
}

const s = StyleSheet.create({
  box: { height: 260, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  pro: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primary, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
});
