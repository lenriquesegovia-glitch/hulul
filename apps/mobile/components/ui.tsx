import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { c, font, radius } from '@/theme';
import { Icon } from './Icon';

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[s.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[s.h2, style]}>{children}</Text>;
}

export function Body({ children, muted, style, numberOfLines }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[s.body, muted && { color: c.textMuted }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Avatar({ initials, size = 48 }: { initials: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.primary, pressed && { backgroundColor: c.primaryDark }, style]}
    >
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

/** Volver atrás y, al lado, ir directo al inicio (sin tener que retroceder pantalla por pantalla). */
export function BackButton() {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.back} hitSlop={8}>
        <Icon name="chevronLeft" size={20} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Ir al inicio" onPress={() => router.dismissTo('/')} style={s.back} hitSlop={8}>
        <Icon name="home" size={19} />
      </Pressable>
    </View>
  );
}

export function Pill({ label, tone = 'success' }: { label: string; tone?: 'success' | 'warm' }) {
  const bg = tone === 'success' ? c.successSoft : c.copperSoft;
  const fg = tone === 'success' ? c.success : c.copper;
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { fontFamily: font.display, fontSize: 26, lineHeight: 32, color: c.text },
  h2: { fontFamily: font.display, fontSize: 17, lineHeight: 22, color: c.text },
  body: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.textSecondary },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 16 },
  avatar: { backgroundColor: c.copperSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.display, color: c.primary },
  primary: { minHeight: 52, borderRadius: radius.md, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  primaryText: { fontFamily: font.bodyBold, fontSize: 15.5, color: c.onPrimary },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontFamily: font.bodyBold, fontSize: 12 },
});
