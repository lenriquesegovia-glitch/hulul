import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { categories, categoryImage, suggestServices } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { ActiveBooking } from '@/components/ActiveBooking';
import { Body, H1, H2 } from '@/components/ui';
import { c, font, radius } from '@/theme';
import { useUser } from '@/lib/auth';
import { useProviderStatus } from '@/lib/pros';

const AGENDA_URL = 'https://hululec.com/profesionales/agenda';

const popular = [
  { slug: 'climatizacion', title: 'Mantenimiento de split', sub: 'Limpieza, revisión de gas y drenaje' },
  { slug: 'limpieza', title: 'Limpieza por horas', sub: 'Casas y departamentos' },
  { slug: 'plomeria', title: 'Destape de tuberías', sub: 'Fugas, destapes y bombas de agua' },
];

export default function Home() {
  const user = useUser();
  const isPro = useProviderStatus(user?.uid) === 'aprobado';
  const [q, setQ] = useState('');
  // Mismo buscador que la web: sugerencias desde la primera letra.
  const suggestions = useMemo(() => suggestServices(q), [q]);

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
          <Pressable accessibilityRole="button" accessibilityLabel="Mi cuenta" onPress={() => router.push('/cuenta')} style={s.location}>
            <Icon name="user" size={18} />
            <Text style={s.locationText}>Mi cuenta</Text>
          </Pressable>
        </View>

        <ActiveBooking />

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

        {suggestions.length > 0 && (
          <View style={s.suggest}>
            {suggestions.map((sg) => (
              <Pressable key={sg.label} accessibilityRole="button" style={s.suggestRow}
                onPress={() => router.push({ pathname: '/categoria/[slug]', params: { slug: sg.slug, trabajo: categories.find((x) => x.slug === sg.slug)?.servicios.includes(sg.label) ? sg.label : undefined } })}>
                <View style={s.suggestIcon}><Icon name={sg.icon} size={18} color={c.copper} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle}>{sg.label}</Text>
                  {sg.label !== sg.category && <Body muted style={{ fontSize: 12.5 }}>{sg.category}</Body>}
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {q.trim().length > 0 && suggestions.length === 0 && <Body muted>No encontramos ese servicio. Mira todas las categorías abajo.</Body>}

        <View style={s.grid}>
          {categories.map((cat) => (
            <Pressable
              key={cat.slug}
              accessibilityRole="button"
              accessibilityLabel={cat.name}
              onPress={() => router.push(`/categoria/${cat.slug}`)}
              style={({ pressed }) => [s.photo, pressed && { opacity: 0.85 }]}
            >
              <Image source={{ uri: categoryImage(cat.slug, 500) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={s.shade} />
              <Text style={s.photoText} numberOfLines={2}>{cat.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable accessibilityRole="button" onPress={() => Linking.openURL(isPro ? AGENDA_URL : 'https://hululec.com/profesionales/registro')} style={({ pressed }) => [s.proCard, pressed && { opacity: 0.9 }]}>
          <Image source={{ uri: categoryImage('electricidad', 700) }} style={s.proImg} resizeMode="cover" />
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={s.proEyebrow}>PARA TÉCNICOS Y PROFESIONALES</Text>
            <Text style={s.proTitle}>{isPro ? 'Tu agenda de profesional' : '¿Eres técnico o profesional? Gana más con HULUL'}</Text>
            <Text style={s.proText}>{isPro ? 'Acepta reservas, mira las direcciones en el mapa y marca "Voy en camino".' : 'Registro gratis. Tú pones tu tarifa, tus zonas y tu horario. Pago garantizado.'}</Text>
            <View style={s.proBtn}><Text style={s.proBtnText}>{isPro ? 'Abrir mi agenda' : 'Regístrate gratis'}</Text></View>
          </View>
        </Pressable>
        {!isPro && (
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(AGENDA_URL)} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: c.primary }}>Ya soy profesional de HULUL: abrir mi agenda</Text>
          </Pressable>
        )}

        <View style={s.promise}>
          <H2>Sin presupuestos. Sin esperas.</H2>
          {[
            { icon: 'shield' as const, t: 'Profesionales verificados: cédula, foto y antecedentes' },
            { icon: 'card' as const, t: 'Pago protegido: se libera cuando apruebas el trabajo' },
            { icon: 'clock' as const, t: 'Precio claro antes de reservar: visita + hora' },
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
            <Pressable key={p.title} accessibilityRole="button" onPress={() => router.push({ pathname: '/categoria/[slug]', params: { slug: p.slug, trabajo: p.title } })} style={s.listItem}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.listTitle}>{p.title}</Text>
                <Body muted style={{ fontSize: 13 }}>{p.sub}</Body>
              </View>
              <Icon name="chevronRight" size={20} color={c.textMuted} />
            </Pressable>
          ))}
        </View>


        <Pressable accessibilityRole="link" onPress={() => router.push('/privacidad')} style={{ alignSelf: 'center', paddingVertical: 12 }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.textMuted, textDecorationLine: 'underline' }}>Política de privacidad</Text>
        </Pressable>
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
  photo: { width: '48%', flexGrow: 1, aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surfaceWarm, justifyContent: 'flex-end' },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,26,26,0.32)' },
  photoText: { fontFamily: font.display, fontSize: 16, color: '#fff', padding: 12 },
  suggest: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface, padding: 4, marginTop: -12 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  suggestIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.copperSoft, alignItems: 'center', justifyContent: 'center' },
  promise: { gap: 12, padding: 18, borderRadius: radius.lg, backgroundColor: c.surfaceWarm, borderWidth: 1, borderColor: c.border },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  proCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: c.primary },
  proImg: { width: '100%', aspectRatio: 16 / 7, backgroundColor: c.primaryDark },
  proEyebrow: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: '#E9C9B3' },
  proTitle: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: '#fff' },
  proText: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.9)' },
  proBtn: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  proBtnText: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.primary },
  listTitle: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
});
