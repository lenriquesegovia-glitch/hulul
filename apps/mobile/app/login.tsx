import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, H1, PrimaryButton } from '@/components/ui';
import { authErrorMessage, finishWebSignIn } from '@/lib/auth';
import { c } from '@/theme';

/** Vuelta desde hululec.com/app-login (hulul://login?token=…&state=…): termina la entrada con Google u Outlook. */
export default function LoginReturn() {
  const { token, state } = useLocalSearchParams<{ token?: string; state?: string }>();
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!token || !state) { setMsg('No recibimos la entrada. Vuelve a intentarlo.'); return; }
    finishWebSignIn(String(token), String(state))
      .then((back) => router.replace(back as never))
      .catch((e) => setMsg(authErrorMessage(e)));
  }, [token, state]);

  return (
    <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: c.background }}>
      <H1 style={{ fontSize: 22 }}>{msg ? 'No pudimos terminar la entrada' : 'Entrando…'}</H1>
      {msg ? (
        <>
          <Body muted>{msg}</Body>
          <PrimaryButton label="Volver" onPress={() => router.replace('/cuenta' as never)} />
        </>
      ) : <Body muted>Un momento, estamos abriendo tu cuenta.</Body>}
    </View>
  );
}
