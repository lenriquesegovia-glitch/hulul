import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { demoReviews, formatRating, getCategory, getProfessional, minimumLabel } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Avatar, BackButton, Body, Card, H1, H2, PrimaryButton } from '@/components/ui';
import { c, font } from '@/theme';

export default function ProfessionalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pro = getProfessional(id);
  const cat = pro ? getCategory(pro.category) : undefined;

  if (!pro || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>No encontramos este profesional.</Body>
      </SafeAreaView>
    );
  }

  const stats = [
    { v: `★ ${formatRating(pro.rating)}`, l: `${pro.reviewCount} reseñas` },
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

        <View style={{ gap: 10 }}>
          <H2>Qué incluye</H2>
          {cat.incluye.map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="check" size={18} color={c.success} strokeWidth={2.2} />
              <Body style={{ flex: 1 }}>{i}</Body>
            </View>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <H2>Reseñas</H2>
          {demoReviews.map((r) => (
            <Card key={r.clientName} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.reviewName}>{r.clientName} · {r.zone}</Text>
                <Body>{'★'.repeat(r.rating)}</Body>
              </View>
              <Body style={{ fontSize: 13.5 }}>{r.text}</Body>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View>
          <Text style={s.price}>${pro.hourlyRate}<Text style={s.perHour}> /hora</Text></Text>
          <Body muted style={{ fontSize: 12.5 }}>{minimumLabel(pro)}</Body>
        </View>
        <PrimaryButton label="Reservar ahora" onPress={() => router.push(`/reservar/${pro.id}`)} />
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
  reviewName: { fontFamily: font.bodyBold, fontSize: 13, color: c.text },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background },
  price: { fontFamily: font.display, fontSize: 20, color: c.text },
  perHour: { fontFamily: font.body, fontSize: 13, color: c.textMuted },
});
