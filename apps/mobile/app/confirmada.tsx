import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatUSD, getCategory, getProfessional } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Avatar, Body, Card, H1, PrimaryButton } from '@/components/ui';
import { nextDays, SLOTS, useBooking } from '@/lib/booking';
import { c, font } from '@/theme';

const timeline = [
  { t: 'Reserva confirmada', d: 'Pago retenido por HULUL', done: true },
  { t: 'Profesional en camino', d: 'Verás su ubicación en vivo', done: false },
  { t: 'Servicio en curso', d: 'Código de inicio de 4 dígitos', done: false },
  { t: 'Apruebas y calificas', d: 'Recién ahí se libera el pago', done: false },
];

export default function ConfirmedScreen() {
  const { last } = useBooking();
  const pro = last ? getProfessional(last.professionalId) : undefined;
  const cat = pro ? getCategory(pro.category) : undefined;

  if (!last || !pro || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16, justifyContent: 'center' }}>
        <Body>No hay una reserva reciente.</Body>
        <PrimaryButton label="Ir al inicio" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const when = `${pro.name} llegará ${nextDays(7)[last.dayIndex].long} a las ${SLOTS[last.slotIndex]}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.checkCircle}>
            <Icon name="check" size={36} color={c.success} strokeWidth={2.4} />
          </View>
          <H1 style={{ fontSize: 24, textAlign: 'center' }}>Reserva confirmada</H1>
          <Body muted style={{ textAlign: 'center' }}>{when}</Body>
        </View>

        <Card style={s.proRow}>
          <Avatar initials={pro.initials} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.proName}>{pro.name}</Text>
            <Body muted style={{ fontSize: 13 }}>{cat.name} · {last.hours} h · {formatUSD(last.total)}</Body>
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

        <PrimaryButton label="Volver al inicio" onPress={() => router.replace('/')} />
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
