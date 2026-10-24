import {useCity} from '@/lib/city';
import {serviceCity} from '@hulul/shared';
import {CitySelector} from '@/components/CitySelector';
import {Inbox} from '@/components/Inbox';
import { BrandLogo } from '@/components/BrandLogo';
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { categories, categoryImage, getCategory, suggestServices, homeCopy, featuredHomeServices, discoveryTitle } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { ActiveBooking } from '@/components/ActiveBooking';
import { ProHome } from '@/components/ProHome';
import { Body, H1, H2 } from '@/components/ui';
import { c, font, radius } from '@/theme';
import { useUser } from '@/lib/auth';
import { useProviderStatus } from '@/lib/pros';


export default function Home() {
  const {city}=useCity();
  const [discovery, setDiscovery] = useState(featuredHomeServices);
  useEffect(() => {
    let active = true;
    import('@hulul/shared/firebase').then(m => m.loadHomeDiscovery()).then(result => { if (active) setDiscovery(result); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const user = useUser();
  const isPro = useProviderStatus(user?.uid) === 'aprobado';
  // Un profesional elige arriba cómo usar la app: como profesional (su día) o como cliente.
  const [mode, setMode] = useState<'pro' | 'cliente'>('pro');
  useEffect(() => { AsyncStorage.getItem('hulul.modo').then((v) => { if (v === 'cliente' || v === 'pro') setMode(v); }).catch(() => {}); }, []);
  const pickMode = (m: 'pro' | 'cliente') => { setMode(m); AsyncStorage.setItem('hulul.modo', m).catch(() => {}); };
  const proMode = isPro && mode === 'pro';
  const [q, setQ] = useState('');
  // Mismo buscador que la web: sugerencias desde la primera letra.
  const suggestions = useMemo(() => suggestServices(q), [q]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={{flex:1}}><BrandLogo /><CitySelector /></View>
          <Inbox /><Pressable accessibilityRole="button" accessibilityLabel="Mi cuenta" onPress={() => router.push('/cuenta')} style={s.location}>
            <Icon name="user" size={18} />
            <Text style={s.locationText}>Mi cuenta</Text>
          </Pressable>
        </View>

        {isPro && (
          <View style={s.seg} accessibilityRole="tablist">
            {([['pro', 'Soy profesional'], ['cliente', 'Necesito un servicio']] as const).map(([m, l]) => (
              <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => pickMode(m)} style={[s.segBtn, mode === m && s.segOn]}>
                <Text style={[s.segText, mode === m && s.segTextOn]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {proMode && user ? <ProHome uid={user.uid} name={user.displayName ?? ''} /> : <>
        <ActiveBooking />

        <View style={{ gap: 6 }}>
          <Body muted style={{ fontSize: 12 }}>{`Buscando servicios en ${serviceCity(city)?.name || 'tu ciudad'}`}</Body>
          <H1 style={s.homeTitle}>{homeCopy.headline}</H1>
          <Body style={s.homeDescription}>{homeCopy.description}</Body>
          <Body style={s.homeProcess}>{homeCopy.process}</Body>
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
        {q.trim().length > 0 && suggestions.length === 0 && <Body muted>No encontramos ese servicio. Toca Explorar los 18 servicios.</Body>}

        <Pressable accessibilityRole="button" style={s.explore} onPress={() => router.push('/servicios')}>
          <Text style={s.exploreText}>Explorar los {categories.length} servicios →</Text>
        </Pressable>

        <View><Image source={require('../assets/hulul-tranquilidad.webp')} style={s.calmImage} resizeMode="cover" accessibilityLabel="Una mujer disfruta un momento tranquilo en casa" /><Body muted style={{fontSize:11,marginTop:6}}>Imagen ilustrativa</Body></View>
        <View style={{ gap: 12 }}>
          <H2>{discoveryTitle(discovery.mode)}</H2>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          {discovery.items.map((p) => {
            const category = getCategory(p.categoryId);
            if (!category) return null;
            return <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.label} onPress={() => router.push({ pathname: '/profesionales-disponibles/[slug]', params: { slug: p.categoryId, trabajo: p.label } })} style={s.featuredCard}>
              <Image source={{ uri: categoryImage(category.slug, 500) }} style={s.featuredImage} resizeMode="cover" accessible={false} />
              <View style={s.featuredCaption}>
                <Text style={[s.listTitle, { flex: 1 }]}>{p.label}</Text>
                <Icon name="chevronRight" size={18} color={c.primary} />
              </View>
            </Pressable>;
          })}
          </ScrollView>
          {discovery.mode !== 'popular' && <Body muted style={{fontSize:12}}>Estamos reuniendo solicitudes de esta semana. Mientras tanto, explora esta selección.</Body>}
          <Body muted style={{ fontSize: 12 }}>Fotos de referencia</Body>
        </View>


        <Pressable accessibilityRole="button" onPress={() => (isPro ? router.push('/agenda') : Linking.openURL('https://hululec.com/profesionales/registro'))} style={({ pressed }) => [s.proCard, pressed && { opacity: 0.9 }]}>
          <Image source={{ uri: categoryImage('electricidad', 700) }} style={s.proImg} resizeMode="cover" />
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={s.proEyebrow}>PARA TÉCNICOS Y PROFESIONALES</Text>
            <Text style={s.proTitle}>{isPro ? 'Tu agenda de profesional' : '¿Eres técnico o profesional? Gana más con HULUL'}</Text>
            <Text style={s.proText}>{isPro ? 'Acepta reservas, mira las direcciones en el mapa y marca "Voy en camino".' : 'Registro gratis. Tú pones tu tarifa por visita, tus zonas y tu horario.'}</Text>
            <View style={s.proBtn}><Text style={s.proBtnText}>{isPro ? 'Abrir mi agenda' : 'Regístrate gratis'}</Text></View>
          </View>
        </Pressable>
        {!isPro && (
          <Pressable accessibilityRole="link" onPress={() => router.push('/agenda')} style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: c.primary }}>Ya soy profesional de HULUL: abrir mi agenda</Text>
          </Pressable>
        )}

        <View style={s.promise}>
          <H2>Sin presupuestos. Sin esperas.</H2>
          {[
            { icon: 'shield' as const, t: 'Profesionales verificados: cédula, foto y antecedentes' },
            { icon: 'card' as const, t: 'Pago por la app: queda registrado en tu reserva' },
            { icon: 'clock' as const, t: 'Precio claro antes de reservar: tarifa por visita' },
          ].map((p) => (
            <View key={p.t} style={s.promiseRow}>
              <Icon name={p.icon} size={18} color={c.copper} strokeWidth={2} />
              <Body style={{ flex: 1, fontSize: 13.5 }}>{p.t}</Body>
            </View>
          ))}
        </View>


        </>}

        <Pressable accessibilityRole="link" onPress={() => router.push('/privacidad')} style={{ alignSelf: 'center', paddingVertical: 12 }}>
          <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.textMuted, textDecorationLine: 'underline' }}>Política de privacidad</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  featuredCard: { width: 224, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  featuredImage: { width: '100%', aspectRatio: 3 / 2 },
  featuredCaption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 76, padding: 14 },
  homeTitle: { fontSize: 38, lineHeight: 42, letterSpacing: -1.4, color: c.primary, fontFamily: font.displayHeavy, marginVertical: 10 },
  homeDescription: { fontSize: 16, lineHeight: 25 },
  homeProcess: { fontSize: 14, lineHeight: 22, color: c.textSecondary, marginTop: 8 },
  calmImage: {width:'100%', height:200, borderRadius:24},
  explore: { minHeight: 48, justifyContent: 'center', alignItems:'center', borderWidth:1, borderColor:c.primary, borderRadius:12, backgroundColor:c.surface },
  exploreText: { fontFamily: font.bodyBold, fontSize: 16, color: c.primary },
  content: { padding: 20, paddingBottom: 40, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seg: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceWarm, borderWidth: 1, borderColor: c.border, marginTop: -8 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segOn: { backgroundColor: c.primary },
  segText: { fontFamily: font.bodyBold, fontSize: 13.5, color: c.textSecondary },
  segTextOn: { color: '#fff' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWord: { fontFamily: font.displayHeavy, fontSize: 21, color: c.primary, letterSpacing: 0.8 },
  logoSub: { fontFamily: font.bodySemi, fontSize: 8.5, letterSpacing: 1.2, color: c.textMuted, marginTop: 1 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  locationText: { fontFamily: font.bodySemi, fontSize: 13, color: c.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: 15, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '48%', flexGrow: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: c.surface },
  photoImage: { width: '100%', aspectRatio: 4 / 3 },
  photoText: { fontFamily: font.display, fontSize: 16, color: c.text, padding: 12 },
  suggest: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface, padding: 4, marginTop: -12 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  suggestIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.copperSoft, alignItems: 'center', justifyContent: 'center' },
  promise: { gap: 12, padding: 18, borderRadius: radius.lg, backgroundColor: c.surfaceWarm, borderWidth: 1, borderColor: c.border },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  proCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: c.primary },
  proImg: { width: '100%', aspectRatio: 16 / 7, backgroundColor: c.primaryDark },
  proEyebrow: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: '#E8DFCF' },
  proTitle: { fontFamily: font.display, fontSize: 19, lineHeight: 24, color: '#fff' },
  proText: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.9)' },
  proBtn: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  proBtnText: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.primary },
  listTitle: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
});
