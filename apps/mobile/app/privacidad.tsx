import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { privacyPolicy, PRIVACY_UPDATED } from '@hulul/shared';
import { BackButton, Body, H1, H2 } from '@/components/ui';
import { c } from '@/theme';

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <BackButton />
        <View style={{ gap: 6 }}>
          <H1>Política de privacidad</H1>
          <Body muted>Última actualización: {PRIVACY_UPDATED}</Body>
        </View>
        <View style={s.note}>
          <Body style={{ fontSize: 13 }}>Borrador pendiente de revisión legal.</Body>
        </View>
        {privacyPolicy.map((sec) => (
          <View key={sec.id} style={{ gap: 10 }}>
            <H2>{sec.title}</H2>
            {sec.body.map((b, i) =>
              'p' in b ? (
                <Body key={i}>{b.p}</Body>
              ) : (
                <View key={i} style={{ gap: 8 }}>
                  {b.ul.map((li) => (
                    <View key={li} style={{ flexDirection: 'row', gap: 8 }}>
                      <Body>•</Body>
                      <Body style={{ flex: 1 }}>{li}</Body>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 22 },
  note: { padding: 12, borderRadius: 12, backgroundColor: c.copperSoft },
});
