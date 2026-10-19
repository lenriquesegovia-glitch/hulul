import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { c, font, radius } from '@/theme';

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Cell { index: number; date: Date }

/** Agrupa los días reservables (0 = hoy … n-1) por mes, con semanas que empiezan el lunes. */
function months(from: Date, n: number): { title: string; weeks: (Cell | null)[][] }[] {
  const out: { title: string; weeks: (Cell | null)[][] }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const title = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let m = out[out.length - 1];
    if (!m || m.title !== title) {
      m = { title, weeks: [[]] };
      out.push(m);
      // Huecos antes del primer día mostrado del mes.
      const lead = (d.getDay() + 6) % 7;
      for (let k = 0; k < lead; k++) m.weeks[0].push(null);
    }
    let w = m.weeks[m.weeks.length - 1];
    if (w.length === 7) { w = []; m.weeks.push(w); }
    w.push({ index: i, date: d });
  }
  for (const m of out) {
    const last = m.weeks[m.weeks.length - 1];
    while (last.length < 7) last.push(null);
  }
  return out;
}

/** Calendario para elegir el día de la reserva (solo los próximos días que se pueden reservar). */
export function CalendarPicker({ visible, from, days, selected, isOff, onPick, onClose }: {
  visible: boolean;
  from: Date;
  days: number;
  selected: number;
  isOff: (index: number) => boolean;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
        <View style={s.head}>
          <Text style={s.title}>Elige el día</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar calendario" onPress={onClose} style={s.close}>
            <Text style={s.closeText}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
          {months(from, days).map((m) => (
            <View key={m.title} style={{ gap: 8 }}>
              <Text style={s.month}>{m.title}</Text>
              <View style={s.row}>
                {WEEK.map((w, k) => <Text key={k} style={s.week}>{w}</Text>)}
              </View>
              {m.weeks.map((week, wi) => (
                <View key={wi} style={s.row}>
                  {week.map((cell, k) => {
                    if (!cell) return <View key={k} style={s.cell} />;
                    const off = isOff(cell.index);
                    const on = cell.index === selected;
                    return (
                      <Pressable key={k} disabled={off} accessibilityRole="button"
                        accessibilityState={{ selected: on, disabled: off }}
                        accessibilityLabel={`${cell.date.getDate()} de ${MONTHS[cell.date.getMonth()]}${off ? ', no disponible' : ''}`}
                        onPress={() => { onPick(cell.index); onClose(); }}
                        style={[s.cell, s.day, on && s.on, off && s.off]}>
                        <Text style={[s.num, on && s.onText, off && s.offText]}>{cell.date.getDate()}</Text>
                        {cell.index === 0 && <Text style={[s.today, on && s.onText]}>hoy</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={16} color={c.textSecondary} />
            <Text style={s.hint}>Los días tachados no tienen horas libres para este servicio o profesional.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  title: { fontFamily: font.display, fontSize: 18, color: c.text },
  close: { paddingHorizontal: 12, paddingVertical: 8 },
  closeText: { fontFamily: font.bodyBold, fontSize: 15, color: c.primary },
  month: { fontFamily: font.display, fontSize: 16, color: c.text },
  row: { flexDirection: 'row', gap: 6 },
  week: { flex: 1, textAlign: 'center', fontFamily: font.bodyBold, fontSize: 12, color: c.textSecondary },
  cell: { flex: 1, aspectRatio: 1 },
  day: { borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: c.text, borderColor: c.text },
  off: { opacity: 0.35 },
  num: { fontFamily: font.display, fontSize: 16, color: c.text },
  onText: { color: c.onPrimary },
  offText: { textDecorationLine: 'line-through' },
  today: { fontFamily: font.bodyBold, fontSize: 9, color: c.copper, textTransform: 'uppercase' },
  hint: { flex: 1, fontFamily: font.body, fontSize: 13, color: c.textSecondary },
});
