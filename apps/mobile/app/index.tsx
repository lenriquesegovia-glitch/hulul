import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { categories } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Body, H1, H2 } from '@/components/ui';
import { c, font, radius } from '@/theme';

const popular = [
  { slug: 'climatizacion', title: 'Mantenimiento de split', sub: 'Limpieza, revisión de gas y drenaje' },
  { slug: 'limpieza', title: 'Limpieza de departamento por horas', sub: 'Con o sin productos incluidos' },
  { slug: 'plomeria', title: 'Plomería urgente', sub: 'Fugas, destapes y bombas de agua' },
];

const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Home() {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const term = normalize(q.trim());
    if (!term) return categories;
    return categories.filter((cat) => [cat.name, cat.sub, ...cat.servicios].some((t) => normalize(t).includes(term)));
  }, [q]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={s.logoRow}>
            <Icon name="logo" size={30} color={c.copper} />
            <View>
              <Text style={s.logoWord}>HULUL</Text>
              <Text style={s.logoSub}>SERVICIOS DEL HOGAR</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar ubicación" style={s.location}>
            <Icon name="pin" size={16} />
            <Text style={s.locationText}>Samborondón</Text>
          </Pressable>
        </View>

        <View style={{ gap: 6 }}>
          <Body muted>Hola</Body>
          <H1>¿Qué necesitas resolver hoy?</H1>
        </View>

        <View style={s.search}>
          <Icon name="search" size={20} color={c.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Aire acondicionado, limpieza, uñas…"
            placeholderTextColor={c.textMuted}
            style={s.searchInput}
            accessibilityLabel="Buscar servicio"
            returnKeyType="search"
          />
        </View>

        <View style={s.grid}>
          {shown.map((cat) => (
            <Pressable
              key={cat.slug}
              accessibilityRole="button"
              onPress={() => router.push(`/categoria/${cat.slug}`)}
              style={({ pressed }) => [s.tile, pressed && { borderColor: c.copper }]}
            >
              <Icon name={cat.icon} size={26} color={c.copper} />
              <Text style={s.tileText} numberOfLines={1}>{cat.name}</Text>
            </Pressable>
          ))}
          {shown.length === 0 && <Body muted>No encontramos ese servicio.</Body>}
        </View>

        <View style={s.promise}>
          <H2>Sin presupuestos. Sin esperas.</H2>
          {[
            { icon: 'shield' as const, t: 'Profesionales verificados con cédula y referencias' },
            { icon: 'card' as const, t: 'Pago protegido: se libera cuando apruebas el trabajo' },
            { icon: 'clock' as const, t: 'Precio por hora visible antes de reservar' },
          ].map((p) => (
            <View key={p.t} style={s.promiseRow}>
              <Icon name={p.icon} size={18} color={c.copper} strokeWidth={2} />
              <Body style={{ flex: 1, fontSize: 13.5 }}>{p.t}</Body>
            </View>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <H2>Lo más pedido en Guayaquil</H2>
          {popular.map((p) => (
            <Pressable key={p.title} accessibilityRole="button" onPress={() => router.push(`/categoria/${p.slug}`)} style={s.listItem}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.listTitle}>{p.title}</Text>
                <Body muted style={{ fontSize: 13 }}>{p.sub}</Body>
              </View>
              <Icon name="chevronRight" size={20} color={c.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWord: { fontFamily: font.displayHeavy, fontSize: 21, color: c.primary, letterSpacing: 0.8 },
  logoSub: { fontFamily: font.bodySemi, fontSize: 8.5, letterSpacing: 1.2, color: c.textMuted, marginTop: 1 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  locationText: { fontFamily: font.bodySemi, fontSize: 13, color: c.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 15, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '23%', flexGrow: 1, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  tileText: { fontFamily: font.bodySemi, fontSize: 11.5, color: c.text },
  promise: { gap: 12, padding: 18, borderRadius: radius.lg, backgroundColor: c.surfaceWarm, borderWidth: 1, borderColor: c.border },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  listTitle: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
});
