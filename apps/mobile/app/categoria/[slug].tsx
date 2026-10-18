import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { formatRating, getCategory, minimumLabel, prosByCategory } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Avatar, BackButton, Body, Card, H1, Pill } from '@/components/ui';
import { c, font, radius } from '@/theme';

type Sort = 'rating' | 'today' | 'price';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'rating', label: 'Mejor valorados' },
  { value: 'today', label: 'Disponible hoy' },
  { value: 'price', label: 'Menor precio' },
];

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const cat = getCategory(slug);
  const [sort, setSort] = useState<Sort>('rating');

  const pros = useMemo(() => {
    const list = cat ? prosByCategory(cat.slug) : [];
    if (sort === 'today') return list.filter((p) => p.availableToday);
    if (sort === 'price') return [...list].sort((a, b) => a.hourlyRate - b.hourlyRate);
    return [...list].sort((a, b) => b.rating - a.rating);
  }, [cat, sort]);

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
        <View style={{ gap: 6 }}>
          <H1>{cat.name}</H1>
          <Body muted>{cat.sub}</Body>
          {cat.aviso && (
            <View style={s.notice} accessibilityRole="text">
              <Body style={{ fontSize: 13.5 }}><Text style={{ fontWeight: '700' }}>Importante: </Text>{cat.aviso}</Body>
            </View>
          )}
        </View>

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

        <Body muted style={{ fontSize: 13 }}>{pros.length} profesionales disponibles</Body>

        {pros.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/profesional/${p.id}`)}>
            {({ pressed }) => (
              <Card style={[{ gap: 12 }, pressed && { borderColor: c.copper }]}>
                <View style={s.proHead}>
                  <Avatar initials={p.initials} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.proName}>{p.name}</Text>
                      {p.verified && <Icon name="shield" size={16} color={c.copper} />}
                    </View>
                    <Body style={{ fontSize: 13 }}>★ {formatRating(p.rating)} ({p.reviewCount}) · {p.jobsDone} servicios</Body>
                    <Body muted style={{ fontSize: 12.5 }}>{p.zone}</Body>
                  </View>
                </View>
                <Body numberOfLines={2} style={{ fontSize: 13.5 }}>{p.bio}</Body>
                <View style={s.proFoot}>
                  <Body muted style={{ fontSize: 13 }}>{minimumLabel(p)}</Body>
                  <Text style={s.price}>${p.hourlyRate}<Text style={s.perHour}>/hora</Text></Text>
                </View>
                {p.availableToday && <Pill label="Disponible hoy" />}
              </Card>
            )}
          </Pressable>
        ))}
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
  notice: { backgroundColor: c.copperSoft, borderLeftWidth: 4, borderLeftColor: c.primary, borderRadius: 10, padding: 12 },
});
