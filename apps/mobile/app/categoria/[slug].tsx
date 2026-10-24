import { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { usePros } from '@/lib/pros';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { serviceIcon, categoryImage, formatPrice, getCategory, ratingLabel } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Avatar, BackButton, Body, Card, H1, Pill } from '@/components/ui';
import { c, font, radius } from '@/theme';

const OTHER = 'Otro';

type Sort = 'rating' | 'today' | 'price';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'rating', label: 'Mejor valorados' },
  { value: 'today', label: 'Disponible hoy' },
  { value: 'price', label: 'Menor precio' },
];

export default function CategoryScreen({ providersOnly = false }: { providersOnly?: boolean }) {
  const { slug, trabajo } = useLocalSearchParams<{ slug: string; trabajo?: string }>();
  const cat = getCategory(slug);
  const [sort, setSort] = useState<Sort>('rating');
  // Trabajo elegido en "¿Qué necesitas?": viaja al perfil y a la reserva.
  const job = trabajo && (cat?.servicios.includes(trabajo) || trabajo === OTHER) ? trabajo : '';

  const { pros: all } = usePros(cat?.slug);
  const pros = useMemo(() => {
    let list = all ?? [];
    if (sort === 'today') list = list.filter((p) => p.availableToday);
    else if (sort === 'price') list = [...list].sort((a, b) => a.visitRate - b.visitRate);
    // Si eligió un trabajo, primero quienes lo marcaron.
    if (job && job !== OTHER) list = [...list].sort((a, b) => Number((b.services ?? []).includes(job)) - Number((a.services ?? []).includes(job)));
    return list;
  }, [all, sort, job]);

  if (!cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>No encontramos esta categoría.</Body>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <BackButton />
        {!providersOnly && <><Image source={{ uri: categoryImage(cat.slug, 900) }} style={s.hero} resizeMode="cover" accessibilityIgnoresInvertColors />
        <View style={{ gap: 6 }}>
          <H1>{cat.name}</H1>
          <Body muted>{cat.sub}</Body>
          {cat.aviso && (
            <View style={s.notice} accessibilityRole="text">
              <Body style={{ fontSize: 13.5 }}><Text style={{ fontWeight: '700' }}>Importante: </Text>{cat.aviso}</Body>
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={s.section}>¿Qué necesitas?</Text>
          {[...cat.servicios, OTHER].map((t) => {
            const on = job === t;
            // "Visita desde $X": la tarifa más baja de los profesionales de la categoría.
            const rates = (all ?? []).map((p) => p.visitRate).filter((r) => r > 0);
            const from = rates.length ? Math.min(...rates) : 0;
            return (
              <Pressable key={t} accessibilityRole="button" onPress={() => router.push({pathname:'/profesionales-disponibles/[slug]',params:{slug:cat.slug,trabajo:t}})} style={[s.job, on && s.jobOn]}>
                <View style={[s.jobIcon, on && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                  <Icon name={serviceIcon(t, cat.icon)} size={20} color={on ? '#fff' : c.copper} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.jobTitle, on && { color: '#fff' }]}>{t}</Text>
                  <Text style={[s.jobSub, on && { color: 'rgba(255,255,255,0.75)' }]}>
                    {t === OTHER ? 'Descríbelo al reservar' : from ? `Visita desde ${formatPrice(from)}` : 'Precio por visita'}
                  </Text>
                </View>
                <Icon name="chevronRight" size={20} color={c.primary} />
              </Pressable>
            );
          })}
        </View>

        </>}
        {providersOnly && <>
        <H1>Elige a tu profesional</H1>
        <Text style={s.section}>{job ? `Profesionales para: ${job}` : 'Profesionales'}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SORTS.map((o) => {
            const on = o.value === sort;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setSort(o.value)}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipText, on && { color: c.onPrimary }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {all === null ? <Body muted style={{ fontSize: 13 }}>Buscando profesionales…</Body>
          : all.length === 0 ? (
            <Card style={{ gap: 10 }}>
              <Text style={s.proName}>Estamos sumando profesionales de {cat.name.toLowerCase()}</Text>
              <Body muted style={{ fontSize: 13.5 }}>Aún no tenemos profesionales disponibles en esta ciudad para este servicio.</Body>
              <Link href="/profesionales" style={{ fontFamily: font.bodyBold, fontSize: 14, color: c.primary }}>¿Trabajas en {cat.name.toLowerCase()}? Regístrate</Link>
            </Card>
          ) : <Body muted style={{ fontSize: 13 }}>{pros.length} {pros.length === 1 ? 'profesional' : 'profesionales'}</Body>}

        {pros.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/profesional/[id]', params: { id: p.id, c: cat.slug, trabajo: job || undefined } })}>
            {({ pressed }) => (
              <Card style={[{ gap: 12 }, pressed && { borderColor: c.copper }]}>
                <View style={s.proHead}>
                  <Avatar initials={p.initials} photoUrl={p.photoUrl} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.proName}>{p.name}</Text>
                      {p.verified && <Icon name="shield" size={16} color={c.copper} />}
                    </View>
                    <Body style={{ fontSize: 13 }}>{ratingLabel(p)}{p.jobsDone > 0 ? ` · ${p.jobsDone} servicios` : ` · ${p.years} años exp.`}</Body>
                    <Body muted style={{ fontSize: 12.5 }}>{p.zone}</Body>
                  </View>
                </View>
                <Body numberOfLines={2} style={{ fontSize: 13.5 }}>{p.bio}</Body>
                <View style={s.proFoot}>
                  <Body muted style={{ fontSize: 13 }}>Incluye el traslado</Body>
                  <Text style={s.price}>{formatPrice(p.visitRate)}<Text style={s.perHour}> por visita</Text></Text>
                </View>
                {p.availableToday && <Pill label="Disponible hoy" />}
                <View style={{minHeight:48,backgroundColor:c.primary,borderRadius:12,alignItems:"center",justifyContent:"center"}}><Text style={{fontFamily:font.bodyBold,color:c.onPrimary}}>Ver perfil y horarios →</Text></View>
              </Card>
            )}
          </Pressable>
        ))}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: 'center' },
  chipOn: { backgroundColor: c.text, borderColor: c.text },
  chipText: { fontFamily: font.bodySemi, fontSize: 13, color: c.text },
  proHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proName: { fontFamily: font.bodyBold, fontSize: 15.5, color: c.text },
  proFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  price: { fontFamily: font.display, fontSize: 16, color: c.text },
  perHour: { fontFamily: font.body, fontSize: 12, color: c.textMuted },
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: c.surfaceWarm },
  section: { fontFamily: font.display, fontSize: 18, color: c.text },
  job: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  jobOn: { backgroundColor: c.text, borderColor: c.text },
  jobIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.copperSoft, alignItems: 'center', justifyContent: 'center' },
  jobTitle: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  jobSub: { fontFamily: font.body, fontSize: 12.5, color: c.textMuted },
  notice: { backgroundColor: c.copperSoft, borderLeftWidth: 4, borderLeftColor: c.primary, borderRadius: 10, padding: 12 },
});
