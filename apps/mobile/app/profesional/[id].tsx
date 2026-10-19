import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { AFTER_VISIT_NOTE, serviceCopy, formatPrice, formatRating, getCategory } from '@hulul/shared';
import { usePro } from '@/lib/pros';
import { Icon } from '@/components/Icon';
import { Avatar, BackButton, Body, Card, H1, H2, PrimaryButton } from '@/components/ui';
import { c, font } from '@/theme';
import { ReviewsList } from '@/components/Rating';

export default function ProfessionalScreen() {
  const { id, c: catParam, trabajo } = useLocalSearchParams<{ id: string; c?: string; trabajo?: string }>();
  const pro = usePro(id, catParam);
  const cat = pro ? getCategory(pro.category) : undefined;

  if (pro === undefined) return <SafeAreaView style={{ flex: 1, padding: 20 }}><BackButton /><ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /></SafeAreaView>;
  if (!pro || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>Este profesional no está disponible. Puede que aún esté en revisión.</Body>
      </SafeAreaView>
    );
  }

  const stats = [
    pro.reviewCount > 0 ? { v: `★ ${formatRating(pro.rating)}`, l: `${pro.reviewCount} reseñas` } : { v: 'Nuevo', l: 'en HULUL' },
    { v: String(pro.jobsDone), l: 'servicios' },
    { v: String(pro.years), l: 'años exp.' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <BackButton />
        <View style={s.hero}>
          <Avatar initials={pro.initials} size={88} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <H1 style={{ fontSize: 22 }}>{pro.name}</H1>
            {pro.verified && <Icon name="shield" size={20} color={c.copper} />}
          </View>
          <Body muted>{cat.name} · {pro.zone}</Body>
        </View>

        <View style={s.stats}>
          {stats.map((st) => (
            <Card key={st.l} style={s.stat}>
              <Text style={s.statValue}>{st.v}</Text>
              <Body muted style={{ fontSize: 12 }}>{st.l}</Body>
            </Card>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <H2>Sobre {pro.isCompany ? 'nosotros' : 'mí'}</H2>
          <Body>{pro.bio}</Body>
        </View>

        <View style={{ gap: 8 }}>
          <H2>Trabajos que realiza</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(pro.services?.length ? pro.services : cat.servicios).map((sv) => (
              <View key={sv} style={s.chip}><Text style={s.chipText}>{sv}</Text></View>
            ))}
          </View>
          <Body muted style={{ fontSize: 13 }}>¿Otro trabajo de {cat.name.toLowerCase()}? Elige &quot;Otro&quot; al reservar.</Body>
        </View>

        <View style={{ gap: 6 }}>
          <H2>Cómo se cobra</H2>
          <Body>• Visita: {formatPrice(pro.visitRate)}. Incluye {serviceCopy(cat?.slug).priceCovers}.</Body>
          <Body>• Al terminar, {pro.name.split(' ')[0]} te deja un {serviceCopy(cat?.slug).reportTitle.toLowerCase()} con fotos.</Body>
          <Body>• {AFTER_VISIT_NOTE}</Body>
        </View>

        <View style={{ gap: 10 }}>
          <H2>Siempre incluido</H2>
          {cat.incluye.map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="check" size={18} color={c.success} strokeWidth={2.2} />
              <Body style={{ flex: 1 }}>{i}</Body>
            </View>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <H2>Reseñas</H2>
          <ReviewsList uid={pro.id} first={pro.name.split(' ')[0]} />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View>
          <Text style={s.price}>{formatPrice(pro.visitRate)}<Text style={s.perHour}> por visita</Text></Text>
          <Body muted style={{ fontSize: 12.5 }}>Incluye el traslado</Body>
        </View>
        <PrimaryButton label="Reservar ahora" onPress={() => router.push({ pathname: '/reservar/[id]', params: { id: pro.id, c: pro.category, trabajo: trabajo || undefined } })} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 20 },
  hero: { alignItems: 'center', gap: 10 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', padding: 12 },
  statValue: { fontFamily: font.display, fontSize: 18, color: c.text },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.copperSoft },
  chipText: { fontFamily: font.bodyBold, fontSize: 13, color: c.copper },
  reviewName: { fontFamily: font.bodyBold, fontSize: 13, color: c.text },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background },
  price: { fontFamily: font.display, fontSize: 20, color: c.text },
  perHour: { fontFamily: font.body, fontSize: 13, color: c.textMuted },
});
