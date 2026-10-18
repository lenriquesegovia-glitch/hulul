import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GUAYAQUIL, searchPlaces, type LatLng, type PlaceSuggestion } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Body, PrimaryButton } from '@/components/ui';
import { c, font, radius } from '@/theme';

const region = (p: LatLng, zoomed: boolean): Region => ({
  latitude: p.lat, longitude: p.lng,
  latitudeDelta: zoomed ? 0.004 : 0.08, longitudeDelta: zoomed ? 0.004 : 0.08,
});

/**
 * Mapa a pantalla completa con el pin fijo en el centro: se mueve el mapa,
 * se busca el sector o se usa la ubicación actual, y se confirma.
 */
export function MapPicker({ visible, initial, onClose, onConfirm }: {
  visible: boolean;
  initial: LatLng | null;
  onClose: () => void;
  onConfirm: (p: LatLng) => void;
}) {
  const map = useRef<MapView>(null);
  const center = useRef<LatLng>(initial ?? GUAYAQUIL);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);

  const goTo = (p: LatLng) => { center.current = p; map.current?.animateToRegion(region(p, true), 500); };

  const locate = async () => {
    setGeoMsg('');
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGeoMsg('No diste permiso de ubicación. Mueve el mapa hasta tu casa o busca tu sector.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      goTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setGeoMsg('No pudimos obtener tu ubicación. Mueve el mapa o busca tu sector.');
    } finally {
      setLocating(false);
    }
  };

  // Al abrir sin ubicación previa, intenta la actual.
  useEffect(() => { if (visible && !initial) locate(); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) { setResults([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => searchPlaces(t, ctrl.signal).then(setResults).catch(() => {}), 350);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flex: 1 }}>
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            initialRegion={region(initial ?? GUAYAQUIL, !!initial)}
            onRegionChangeComplete={(r) => { center.current = { lat: r.latitude, lng: r.longitude }; }}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
          />
          {/* Pin fijo: su punta queda en el centro exacto del mapa. */}
          <View pointerEvents="none" style={s.pinWrap}>
            <Icon name="pin" size={44} color={c.primary} strokeWidth={2.6} />
          </View>
          <SafeAreaView edges={['top']} style={s.top} pointerEvents="box-none">
            <View style={s.topRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={s.round}>
                <Icon name="chevronLeft" size={22} />
              </Pressable>
              <View style={s.search}>
                <Icon name="search" size={18} color={c.textMuted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Busca tu urbanización o sector" placeholderTextColor={c.textMuted} style={s.searchInput} returnKeyType="search" />
              </View>
            </View>
            {results.length > 0 && (
              <View style={s.results}>
                {results.map((r) => (
                  <Pressable key={r.label + r.detail} accessibilityRole="button" onPress={() => { goTo(r.p); setResults([]); setQ(r.label); }} style={s.result}>
                    <Text style={s.resultTitle}>{r.label}</Text>
                    {r.detail ? <Body muted style={{ fontSize: 12.5 }}>{r.detail}</Body> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </SafeAreaView>
        </View>
        <SafeAreaView edges={['bottom']} style={s.bottom}>
          <Pressable accessibilityRole="button" onPress={locate} style={s.locBtn} disabled={locating}>
            {locating ? <ActivityIndicator color={c.primary} /> : <Icon name="pin" size={18} color={c.primary} strokeWidth={2.2} />}
            <Text style={s.locText}>{locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}</Text>
          </Pressable>
          <Body muted style={{ textAlign: 'center', fontSize: 13 }}>{geoMsg || 'Mueve el mapa hasta que el pin quede sobre tu casa.'}</Body>
          <PrimaryButton label="Confirmar ubicación" onPress={() => onConfirm({ lat: Number(center.current.lat.toFixed(6)), lng: Number(center.current.lng.toFixed(6)) })} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  pinWrap: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -39 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  topRow: { flexDirection: 'row', gap: 8 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 16, color: c.text },
  results: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: 4 },
  result: { padding: 12, borderRadius: 10 },
  resultTitle: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  bottom: { paddingHorizontal: 16, paddingTop: 14, gap: 10, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
  locText: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
});
