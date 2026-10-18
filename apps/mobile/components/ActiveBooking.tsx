import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getCategory } from '@hulul/shared';
import { activeBooking, clientBookings, TRACK_STEPS, type ClientBooking } from '@hulul/shared/firebase';
import { Body } from '@/components/ui';
import { useUser } from '@/lib/auth';
import { c, font, radius } from '@/theme';

/** Arriba del inicio: la reserva activa y en qué paso va. Se actualiza al volver a la pantalla. */
export function ActiveBooking() {
  const user = useUser();
  const [b, setB] = useState<ClientBooking | null>(null);

  useFocusEffect(useCallback(() => {
    if (!user) { setB(null); return; }
    clientBookings(user.uid).then((l) => setB(activeBooking(l))).catch(() => {});
  }, [user]));

  if (!b) return null;
  const idx = Math.max(0, TRACK_STEPS.findIndex((s) => s.status === b.status));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Ver mi reserva" onPress={() => router.push('/cuenta')} style={s.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={s.title}>Tu reserva · {getCategory(b.category)?.name}</Text>
        <Body muted style={{ fontSize: 12.5 }}>{b.date} · {b.slot}</Body>
      </View>
      <View style={s.steps}>
        {TRACK_STEPS.map((st, i) => (
          <View key={st.status} style={{ flex: 1, gap: 5 }}>
            <View style={[s.bar, i < idx && { backgroundColor: c.success }, i === idx && { backgroundColor: c.copper }]} />
            <Text style={[s.label, i === idx && { color: c.copper }]} numberOfLines={1}>{st.label}</Text>
          </View>
        ))}
      </View>
      <Body muted style={{ fontSize: 12.5 }}>{b.professionalName} · toca para ver el detalle</Body>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: c.copper, backgroundColor: c.surface },
  title: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text, flex: 1 },
  steps: { flexDirection: 'row', gap: 6 },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.border },
  label: { fontFamily: font.bodyBold, fontSize: 10.5, color: c.textMuted },
});
