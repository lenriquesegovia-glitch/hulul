import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { c } from '@/theme';
import { Icon } from './Icon';

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={s.row}
      hitSlop={6}
    >
      <View style={[s.box, checked && s.boxOn]}>
        {checked && <Icon name="check" size={16} color={c.onPrimary} strokeWidth={2.6} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#A39C95', backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: c.primary, borderColor: c.primary },
});
