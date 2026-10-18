import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { formatUSD, getCategory } from '@hulul/shared';
import { BOOKING_STATUS_LABEL, clientBookings, type ClientBooking } from '@hulul/shared/firebase';
import { ClientGate } from '@/components/ClientGate';
import { BackButton, Body, Card, H1, H2, Pill, PrimaryButton } from '@/components/ui';
import { logout } from '@/lib/auth';
import { c, font } from '@/theme';

/** Mi cuenta: datos del cliente y sus reservas. */
export default function AccountScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackButton />
        <ClientGate title="Entra a tu cuenta" lead="Con tu correo. Si es tu primera vez, se crea tu cuenta.">
          {({ user, profile }) => (
            <View style={{ gap: 20 }}>
              <H1>Mi cuenta</H1>
              <Card style={{ gap: 6 }}>
                <Text style={s.name}>{profile.name}</Text>
                <Body muted>{profile.phone} · {profile.email}</Body>
                <Pressable accessibilityRole="button" onPress={logout}><Text style={s.link}>Cerrar sesión</Text></Pressable>
              </Card>
              <Bookings uid={user.uid} />
            </View>
          )}
        </ClientGate>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bookings({ uid }: { uid: string }) {
  const [rows, setRows] = useState<ClientBooking[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { clientBookings(uid).then(setRows).catch(() => setError(true)); }, [uid]);
  return (
    <View style={{ gap: 12 }}>
      <H2>Mis reservas</H2>
      {error && <Body style={{ color: c.primary }}>No pudimos cargar tus reservas.</Body>}
      {!rows && !error && <Body muted>Cargando…</Body>}
      {rows?.length === 0 && (
        <Card style={{ gap: 12 }}>
          <Body muted>Aún no tienes reservas.</Body>
          <PrimaryButton label="Reservar un servicio" onPress={() => router.replace('/')} />
        </Card>
      )}
      {rows?.map((r) => (
        <Card key={r.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[s.name, { flex: 1, fontSize: 15 }]}>{getCategory(r.category)?.name ?? r.category} · {r.professionalName}</Text>
            <Pill label={BOOKING_STATUS_LABEL[r.status] ?? r.status} tone="warm" />
          </View>
          <Body muted style={{ fontSize: 13 }}>{r.date} a las {r.slot} · {formatUSD(r.total)} · {r.id.slice(0, 8).toUpperCase()}</Body>
          {r.notes ? <Body style={{ fontSize: 13.5 }}>{r.notes}</Body> : null}
        </Card>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  name: { fontFamily: font.bodyBold, fontSize: 17, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary, marginTop: 6 },
});
