import { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatUSD, getCategory } from '@hulul/shared';
import type { ProBooking } from '@hulul/shared/firebase';
import { BackButton, Body, H1, H2, PrimaryButton } from '@/components/ui';
import { shortDay } from '@/components/Reschedule';
import { useUser } from '@/lib/auth';
import { useProviderStatus } from '@/lib/pros';
import { earned, STATUS_LABEL, todayEc, useProBookings } from '@/lib/agenda';
import { c, font, radius } from '@/theme';

/** Agenda del profesional dentro de la app: solicitudes, próximos trabajos e historial. */
export default function AgendaScreen() {
  const user = useUser();
  const status = useProviderStatus(user?.uid);
  const rows = useProBookings(status === 'aprobado' ? user?.uid : null);

  const g = useMemo(() => {
    const list = [...(rows ?? [])].sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
    const today = todayEc();
    return {
      pending: list.filter((b) => b.status === 'pendiente' && b.date >= today),
      active: list.filter((b) => ['confirmada', 'en_camino', 'en_curso'].includes(b.status)),
      closing: list.filter((b) => b.status === 'por_aprobar'),
      history: list.filter((b) => ['completada', 'cancelada'].includes(b.status) || (b.status === 'pendiente' && b.date < today)).reverse().slice(0, 20),
    };
  }, [rows]);

  const wrap = (node: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <H1 style={{ fontSize: 24 }}>Mi agenda</H1>
        </View>
        {node}
      </ScrollView>
    </SafeAreaView>
  );

  if (user === undefined || (user && status === undefined)) return wrap(<ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />);
  if (!user) return wrap(<><Body>Entra con tu cuenta de profesional para ver tu agenda.</Body><PrimaryButton label="Entrar" onPress={() => router.push('/cuenta')} /></>);
  if (status !== 'aprobado') {
    return wrap(
      <>
        <Body>{status === 'en_revision' ? 'Tu registro está en revisión. Cuando te aprobemos, aquí verás tus trabajos.' : 'Esta cuenta aún no es de profesional aprobado.'}</Body>
        <PrimaryButton label="Ir a mi registro" onPress={() => Linking.openURL('https://hululec.com/profesionales/registro')} />
      </>,
    );
  }

  return wrap(
    <>
      {rows === null && <ActivityIndicator color={c.primary} />}
      <Section title="Solicitudes nuevas" items={g.pending} empty="No tienes solicitudes nuevas. Te sonará el celular cuando llegue una." hot />
      <Section title="Próximos trabajos" items={g.active} empty="Sin trabajos confirmados por ahora." />
      {g.closing.length > 0 && <Section title="Por cerrar" items={g.closing} />}
      {g.history.length > 0 && <Section title="Historial" items={g.history} muted />}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={() => Linking.openURL('https://hululec.com/profesionales/registro')} style={s.tile}><Text style={s.tileText}>Servicios y tarifas</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => user && router.push({ pathname: '/profesional/[id]', params: { id: user.uid } })} style={s.tile}><Text style={s.tileText}>Mi perfil público</Text></Pressable>
      </View>
    </>,
  );
}

function Section({ title, items, empty, hot = false, muted = false }: { title: string; items: ProBooking[]; empty?: string; hot?: boolean; muted?: boolean }) {
  return (
    <View style={{ gap: 10 }}>
      <H2>{title}{items.length ? ` (${items.length})` : ''}</H2>
      {!items.length && empty ? <Body muted style={{ fontSize: 13.5 }}>{empty}</Body> : null}
      {items.map((b) => (
        <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: b.id } })}
          style={[s.row, hot && { borderColor: c.primary, borderWidth: 2 }, muted && { opacity: 0.75 }]}>
          <View style={s.when}>
            <Text style={s.whenDay}>{b.date === todayEc() ? 'Hoy' : shortDay(b.date)}</Text>
            <Text style={s.whenTime}>{b.slot}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.title}>{getCategory(b.category)?.name}{b.contactName ? ` · ${String(b.contactName).split(' ')[0]}` : ''}</Text>
            <Body muted style={{ fontSize: 12.5 }} numberOfLines={1}>{b.address}</Body>
            <Text style={[s.badge, b.status === 'pendiente' && s.badgeHot]}>{STATUS_LABEL[b.status] ?? b.status}{b.photos?.length ? ' · 📷' : ''}</Text>
          </View>
          <Text style={s.money}>{formatUSD(earned(b))}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  when: { width: 64, alignItems: 'center' },
  whenDay: { fontFamily: font.bodyBold, fontSize: 12, color: c.copper },
  whenTime: { fontFamily: font.display, fontSize: 16, color: c.text },
  title: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', marginTop: 2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.successSoft, color: c.success, fontFamily: font.bodyBold, fontSize: 11 },
  badgeHot: { backgroundColor: c.copperSoft, color: c.copper },
  money: { fontFamily: font.display, fontSize: 15, color: c.text },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  tileText: { fontFamily: font.bodySemi, fontSize: 13, color: c.text, textAlign: 'center' },
});
