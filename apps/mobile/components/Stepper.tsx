import { Pressable, StyleSheet, Text, View } from 'react-native';
import { c, font, radius } from '@/theme';

/**
 * Selector tipo reloj: un valor grande en el centro y botones − / + a los
 * lados. Reemplaza las filas de muchas opciones (horas, minutos, días).
 */
export function Stepper({ label, value, onMinus, onPlus, canMinus = true, canPlus = true, minusLabel = 'Menos', plusLabel = 'Más' }: {
  label?: string; value: string; onMinus: () => void; onPlus: () => void; canMinus?: boolean; canPlus?: boolean; minusLabel?: string; plusLabel?: string;
}) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={minusLabel} disabled={!canMinus} onPress={onMinus} hitSlop={6} style={[s.btn, !canMinus && s.off]}>
          <Text style={s.sign}>−</Text>
        </Pressable>
        <Text style={s.value} accessibilityLiveRegion="polite">{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={plusLabel} disabled={!canPlus} onPress={onPlus} hitSlop={6} style={[s.btn, !canPlus && s.off]}>
          <Text style={s.sign}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: font.bodyBold, fontSize: 12.5, color: c.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.copperSoft, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  sign: { fontFamily: font.bodyBold, fontSize: 24, lineHeight: 28, color: c.primary },
  value: { flex: 1, textAlign: 'center', fontFamily: font.display, fontSize: 24, color: c.text },
});
