import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Importamos solo los pesos que usa la app para no incluir todas las variantes.
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BookingProvider } from '@/lib/booking';
import { PrivacyProvider, usePrivacy } from '@/lib/privacy';
import { c } from '@/theme';
import { useAutoUpdate } from '@/lib/updates';
import { usePushNotifications } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

/** Pantallas que se pueden ver sin haber aceptado la política. */
const OPEN_ROUTES = ['bienvenida', 'privacidad'];

function Navigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, consent } = usePrivacy();
  const segments = useSegments();
  const loaded = fontsLoaded && ready;
  usePushNotifications();

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    const current = segments[0] ?? '';
    if (!consent && !OPEN_ROUTES.includes(current)) router.replace('/bienvenida');
  }, [loaded, consent, segments]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }} />
    </>
  );
}

export default function RootLayout() {
  useAutoUpdate();
  const [fontsLoaded] = useFonts({

    Manrope_800ExtraBold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  return (
    <SafeAreaProvider>
      <PrivacyProvider>
        <BookingProvider>
          <Navigator fontsLoaded={fontsLoaded} />
        </BookingProvider>
      </PrivacyProvider>
    </SafeAreaProvider>
  );
}
