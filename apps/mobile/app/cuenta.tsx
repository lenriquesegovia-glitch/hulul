import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { cancelTerms, formatUSD, getCategory, usd } from '@hulul/shared';
import { BOOKING_STATUS_LABEL, cancelBooking, cancelErrorMessage, clientBookings, type ClientBooking } from '@hulul/shared/firebase';
import { ClientGate } from '@/components/ClientGate';
import { BackButton, Body, Button, Card, H1, H2, Pill, PrimaryButton } from '@/components/ui';
import { logout } from '@/lib/auth';
import { c, font, radius } from '@/theme';

/** Mi cuenta: datos del cliente y sus reservas. */
export default function AccountScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackButton />
        <ClientGate title="Entra a tu cuenta" lead="Con Google, Outlook o tu correo. Si es tu primera vez, se crea tu cuenta.">
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
  const [reload, setReload] = useState(0);
  useEffect(() => { clientBookings(uid).then(setRows).catch(() => setError(true)); }, [uid, reload]);
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
          {r.proposal ? <Text style={{ fontFamily: font.bodyBold, fontSize: 13, color: c.primary }}>Cambio de hora pendiente: {r.proposal.date} a las {r.proposal.slot}</Text> : null}
          <Button variant="secondary" label="Ver detalle y seguimiento" onPress={() => router.push({ pathname: '/reserva/[id]', params: { id: r.id } })} />
          {r.status === 'cancelada' && (
            <Body muted style={{ fontSize: 13 }}>
              {r.cancelFee ? `Cargo por cancelación tardía: ${usd(r.cancelFee)}${r.demo ? ' (prueba, no se cobra)' : ''}` : 'Cancelada sin costo.'}
            </Body>
          )}
          <CancelBox row={r} onDone={() => setReload((n) => n + 1)} />
        </Card>
      ))}
    </View>
  );
}

function shortWhen(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Cancelar: muestra antes de confirmar si es gratis o cuánto cuesta. */
export function CancelBox({ row, onDone }: { row: ClientBooking; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const t = cancelTerms(row);
  if (!t.allowed) return null;
  const hint = row.status === 'pendiente'
    ? `Gratis mientras ningún profesional la confirme. Ya confirmada, gratis hasta ${t.freeUntil ? shortWhen(t.freeUntil) : '2 h antes'}.`
    : t.fee === 0 && t.freeUntil ? `Cancelas gratis hasta ${shortWhen(t.freeUntil)}.` : '';

  if (!open) {
    return (
      <View style={{ gap: 6, marginTop: 6 }}>
        {hint ? <Body muted style={{ fontSize: 12.5 }}>{hint}</Body> : null}
        <Button variant="danger" label="Cancelar reserva" onPress={() => setOpen(true)} />
      </View>
    );
  }
  const confirm = async () => {
    setBusy(true); setMsg('');
    try { await cancelBooking(row.id, reason.trim()); onDone(); } catch (e) { setMsg(cancelErrorMessage(e)); setBusy(false); }
  };
  return (
    <View style={[s.cancel, t.fee > 0 && { backgroundColor: '#FBEAE8' }]}>
      <Text style={s.name}>{t.fee > 0 ? `Cancelar ahora cuesta ${usd(t.fee)}` : 'Cancelar es gratis'}</Text>
      <Body style={{ fontSize: 13.5 }}>{t.reason}</Body>
      {t.fee > 0 && row.demo ? <Body muted style={{ fontSize: 12.5 }}>Versión de prueba: el cargo se registra, pero no se cobra.</Body> : null}
      <TextInput value={reason} onChangeText={setReason} maxLength={300} placeholder="Motivo (opcional)" placeholderTextColor={c.textMuted} style={s.input} />
      {msg ? <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.primary }}>{msg}</Text> : null}
      <Button variant="danger" label={busy ? 'Cancelando…' : t.fee > 0 ? `Cancelar y pagar ${usd(t.fee)}` : 'Sí, cancelar'} onPress={busy ? () => {} : confirm} />
      <Button variant="secondary" label="Mantener reserva" onPress={() => setOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  cancel: { gap: 10, marginTop: 8, padding: 14, borderRadius: radius.md, backgroundColor: c.surfaceWarm },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, fontFamily: font.body, fontSize: 15, color: c.text },
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  name: { fontFamily: font.bodyBold, fontSize: 17, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary, marginTop: 6 },
});
