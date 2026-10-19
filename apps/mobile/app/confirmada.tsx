import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatUSD, getCategory } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Avatar, Body, Card, H1, PrimaryButton } from '@/components/ui';
import { nextDays, SLOTS, useBooking } from '@/lib/booking';
import { c, font } from '@/theme';

const timeline = [
  { t: 'Reserva recibida', d: 'Te avisamos cada paso', done: true },
  { t: 'Profesional confirmado', d: 'Acepta tu reserva', done: false },
  { t: 'En camino', d: 'Verás en el mapa por dónde viene y cuánto falta', done: false },
  { t: 'Llegó', d: 'Le das tu código de 4 dígitos para empezar', done: false },
  { t: 'Trabajo en curso', d: 'El tiempo se cuenta en la app', done: false },
  { t: 'Terminado', d: 'Apruebas y calificas; recién ahí se libera el pago', done: false },
];

export default function ConfirmedScreen() {
  const { last } = useBooking();
  const pro = last ? { name: last.professionalName, initials: last.professionalName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() } : undefined;
  const cat = last ? getCategory(last.category) : undefined;

  if (!last || !pro || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16, justifyContent: 'center' }}>
        <Body>No hay una reserva reciente.</Body>
        <PrimaryButton label="Ir al inicio" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const when = `${pro.name} llegará ${nextDays()[last.dayIndex].long} a las ${last.slotTime ?? SLOTS[last.slotIndex]}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.checkCircle}>
            <Icon name="check" size={36} color={c.success} strokeWidth={2.4} />
          </View>
          <H1 style={{ fontSize: 24, textAlign: 'center' }}>Reserva recibida</H1>
          <Body muted style={{ textAlign: 'center' }}>{when}</Body>
          {last.bookingId ? <Body muted style={{ textAlign: 'center', fontSize: 13 }}>Código de reserva: {last.bookingId.slice(0, 8).toUpperCase()}</Body> : null}
          <Body muted style={{ textAlign: 'center', fontSize: 12.5 }}>Versión de prueba: no se hizo ningún cobro.</Body>
        </View>

        <Card style={s.proRow}>
          <Avatar initials={pro.initials} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.proName}>{pro.name}</Text>
            <Body muted style={{ fontSize: 13 }}>{last.notes ? `${last.notes} · ` : ''}{cat.name} · visita · {formatUSD(last.total)}</Body>
          </View>
        </Card>

        <Card>
          {timeline.map((step, i) => (
            <View key={step.t} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={[s.dot, step.done ? s.dotDone : s.dotTodo]} />
                {i < timeline.length - 1 && <View style={s.line} />}
              </View>
              <View style={{ paddingBottom: i < timeline.length - 1 ? 18 : 0 }}>
                <Text style={[s.stepTitle, !step.done && { color: c.textSecondary }]}>{step.t}</Text>
                <Body muted style={{ fontSize: 12.5 }}>{step.d}</Body>
              </View>
            </View>
          ))}
        </Card>

        <PrimaryButton label="Ver mis reservas" onPress={() => router.replace('/cuenta')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingTop: 40, gap: 22 },
  hero: { alignItems: 'center', gap: 12 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' },
  proRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proName: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotDone: { backgroundColor: c.success },
  dotTodo: { borderWidth: 2, borderColor: '#A39C95' },
  line: { width: 2, flex: 1, backgroundColor: c.border, marginVertical: 2 },
  stepTitle: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
});
