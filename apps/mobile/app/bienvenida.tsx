import { BrandLogo } from '@/components/BrandLogo';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { privacySummary } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { Checkbox } from '@/components/Checkbox';
import { Body, H1, PrimaryButton } from '@/components/ui';
import { usePrivacy } from '@/lib/privacy';
import { c, font, radius } from '@/theme';

/** Primera apertura de la app: aceptar la política de privacidad para continuar. */
export default function WelcomeScreen() {
  const { accept } = usePrivacy();
  const [agreed, setAgreed] = useState(false);
  const [analitica, setAnalitica] = useState(false);
  const [error, setError] = useState(false);

  const onContinue = async () => {
    if (!agreed) {
      setError(true);
      return;
    }
    await accept({ analitica });
    // Primera vez: elegir si es cliente o profesional.
    router.replace('/elige');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <BrandLogo />

        <View style={{ gap: 8 }}>
          <H1>Cuidamos tu privacidad</H1>
          <Body muted>Antes de empezar, esto es lo importante sobre tus datos:</Body>
        </View>

        <View style={s.card}>
          {privacySummary.map((t) => (
            <View key={t} style={s.bullet}>
              <Icon name="shield" size={18} color={c.copper} strokeWidth={2} />
              <Body style={{ flex: 1 }}>{t}</Body>
            </View>
          ))}
        </View>

        <View style={{ gap: 6 }}>
          <Checkbox checked={agreed} onChange={(v) => { setAgreed(v); setError(false); }}>
            <Body>
              He leído y acepto la{' '}
              <Link href="/privacidad" style={s.link}>Política de privacidad</Link>
              {' '}y los Términos y condiciones de HULUL.
            </Body>
          </Checkbox>
          {error && <Text style={s.error}>Para usar HULUL necesitas aceptar la política de privacidad.</Text>}
          <Checkbox checked={analitica} onChange={setAnalitica}>
            <Body>Permitir estadísticas de uso anónimas para mejorar la app (opcional).</Body>
          </Checkbox>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <PrimaryButton label="Aceptar y continuar" onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 24, paddingTop: 32, gap: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWord: { fontFamily: font.displayHeavy, fontSize: 26, color: c.primary, letterSpacing: 1 },
  logoSub: { fontFamily: font.bodySemi, fontSize: 9.5, letterSpacing: 1.4, color: c.textMuted, marginTop: 2 },
  card: { gap: 14, padding: 18, borderRadius: radius.lg, backgroundColor: c.surfaceWarm, borderWidth: 1, borderColor: c.border },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  link: { color: c.primary, fontFamily: font.bodyBold, textDecorationLine: 'underline' },
  error: { fontFamily: font.bodySemi, fontSize: 13, color: c.primary, marginLeft: 36 },
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border },
});
