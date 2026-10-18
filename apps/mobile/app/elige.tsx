import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { categoryImage } from '@hulul/shared';
import { Body, H1 } from '@/components/ui';
import { c, font, radius } from '@/theme';

/** Después de aceptar la privacidad: ¿cliente o profesional? Lleva directo al registro. */
export default function ChooseRoleScreen() {
  const options = [
    {
      title: 'Necesito un servicio',
      sub: 'Reserva técnicos y profesionales a domicilio',
      img: categoryImage('limpieza', 500),
      go: () => router.replace('/cuenta'),
    },
    {
      title: 'Quiero ofrecer mis servicios',
      sub: 'Soy técnico o profesional y quiero recibir trabajos',
      img: categoryImage('electricidad', 500),
      go: () => { Linking.openURL('https://hululec.com/profesionales/registro'); router.replace('/'); },
    },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ gap: 6 }}>
          <H1>¿Cómo quieres usar HULUL?</H1>
          <Body muted>Te llevamos directo a crear tu cuenta.</Body>
        </View>
        {options.map((o) => (
          <Pressable key={o.title} accessibilityRole="button" onPress={o.go} style={({ pressed }) => [s.card, pressed && { borderColor: c.primary }]}>
            <Image source={{ uri: o.img }} style={s.img} resizeMode="cover" />
            <View style={{ padding: 14, gap: 4 }}>
              <Text style={s.title}>{o.title}</Text>
              <Body muted style={{ fontSize: 13.5 }}>{o.sub}</Body>
            </View>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={{ alignSelf: 'center', padding: 12 }}>
          <Text style={s.link}>Solo quiero mirar por ahora</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 24, paddingTop: 32, gap: 18 },
  card: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 16 / 8, backgroundColor: c.surfaceWarm },
  title: { fontFamily: font.display, fontSize: 18, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.primary },
});
