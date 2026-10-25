import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { AFTER_VISIT_NOTE, cancelledText, clientAlert, appointmentTime, formatUSD, getCategory, hhmmEcuador, HOME_SAFETY_NOTICE, HOME_SAFETY_TITLE, outcomeLabel, serviceCopy, usd } from '@hulul/shared';
import { confirmService, EXTRA_STATUS_LABEL, extraCharge, firestore, type ClientBooking, type ExtraAction, type ExtraCharge } from '@hulul/shared/firebase';
import { Icon } from '@/components/Icon';
import { LiveMap } from '@/components/LiveMap';
import { RatingBox } from '@/components/Rating';
import { Chat } from '@/components/Chat';
import { DelayClient } from '@/components/Delay';
import { Reschedule } from '@/components/Reschedule';
import { ArrivalCode, ProblemBox } from '@/components/ArrivalCode';
import { ClaimCard } from '@/components/Claim';
import { useUser } from '@/lib/auth';
import { BackButton, Body, Button, Card, H1, PrimaryButton } from '@/components/ui';
import { CancelBox } from '../cuenta';
import { c, font, radius } from '@/theme';

const STEPS = [
  { status: 'pendiente', t: 'Reserva recibida' },
  { status: 'confirmada', t: 'Profesional confirmado' },
  { status: 'en_camino', t: 'En camino' },
  { status: 'en_curso', t: 'Trabajando' },
  { status: 'por_aprobar', t: 'Terminado' },
];
const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MO[m - 1]}`;
}

/** Detalle de una reserva para el cliente, en vivo. */
export default function BookingDetailScreen() {
  const { id, aviso, mensaje, chat } = useLocalSearchParams<{ id: string;aviso?:string;mensaje?:string;chat?:string }>();
  const [b, setB] = useState<ClientBooking | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(firestore(), 'bookings', id),
      (snap) => setB(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<ClientBooking, 'id'>) }) : null),
      () => setB(null));
  }, [id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <BackButton />
          {aviso && <Card><Body>{aviso}</Body>{mensaje && <Body muted>{mensaje}</Body>}</Card>}
        {b === undefined && <Body muted>Cargando…</Body>}
        {b === null && <Body>No encontramos esta reserva.</Body>}
        {b && <Detail b={b} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ b }: { b: ClientBooking }) {
  const {chat:focusChat}=useLocalSearchParams<{chat?:string}>();
  const me = useUser();
  const cat = getCategory(b.category);
  const first = b.professionalName.split(' ')[0];
  const idx = STEPS.findIndex((x) => x.status === b.status);
  const at = appointmentTime(b.date, b.slot);
  const alert = clientAlert(b, first);
  const message: Record<string, string> = {
    pendiente: `Esperando que ${first} acepte tu reserva. Te avisamos apenas lo haga.`,
    confirmada: `${first} confirmó. Saldrá con el tiempo justo para llegar a las ${b.slot} (puede salir desde las ${hhmmEcuador(new Date(at.getTime() - 120 * 60_000))}).`,
    en_camino: b.arrivedAt ? `${first} está en tu dirección. Recíbelo y dale tu código de llegada.` : `${first} va en camino. Míralo en el mapa en vivo.`,
    en_curso: `${first} está en tu servicio. Al terminar te deja un resumen con fotos.`,
    por_aprobar: `${first} terminó. Mira su resumen y califícalo; tienes 48 horas.`,
    completada: 'Servicio completado.',
    en_disputa: 'Nos pediste ayuda con este servicio. HULUL lo está revisando y el pago queda en espera mientras tanto.',
    cancelada: cancelledText(b, first),
  };

  return (
    <View style={{ gap: 16 }}>
{focusChat === '1' && <View>{b.status !== 'cancelada' && me && (
        <Card style={{ gap: 10 }}>
          <Text style={s.boxTitle}>💬 Chat con {first}</Text>
          <Chat bookingId={b.id} uid={me.uid} me="cliente" otherName={first} open={['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'].includes(b.status)} />
</Card>)} </View>}
      <View style={{ gap: 4 }}>
        <H1 style={{ fontSize: 24 }}>{cat?.name ?? b.category} con {b.professionalName}</H1>
        <Text style={s.when}>{shortDay(b.date)} · {b.slot}</Text>
      </View>
      {['pendiente', 'confirmada'].includes(b.status) && <Reschedule id={b.id} date={b.date} slot={b.slot} proposal={b.proposal} me="cliente" other={first} />}
      {['confirmada', 'en_camino'].includes(b.status) && <ArrivalCode id={b.id} pro={first} />}
      {['confirmada', 'en_camino'].includes(b.status) && <DelayClient id={b.id} slot={b.slot} delay={b.delay} pro={first} />}
      {alert && (
        <View style={[s.box, { backgroundColor: c.copperSoft, borderLeftWidth: 4, borderLeftColor: alert.tone === 'bad' ? c.primary : c.copper }]} accessibilityRole="alert">
          <Body style={{ fontSize: 14, fontFamily: alert.tone === 'bad' ? font.bodyBold : font.body }}>{alert.text}</Body>
        </View>
      )}
      <Card style={{ gap: 14 }}>
        <Body>{message[b.status] ?? ''}</Body>
        {!['cancelada', 'en_disputa'].includes(b.status) && STEPS.map((st, i) => {
          const done = idx > i || b.status === 'completada';
          const now = idx === i && !done;
          return (
            <View key={st.status} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: now ? c.primary : 'transparent' }}>
              <View style={[s.dot, done && { backgroundColor: c.success, borderColor: c.success }, now && { borderColor: '#fff', backgroundColor: '#fff' }]}>
                {done && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={[s.step, done && { color: c.text }, now && { color: '#fff', fontFamily: font.bodyBold }]}>{now ? 'AHORA · ' : ''}{st.status === 'en_camino' && b.arrivedAt ? 'En tu dirección' : st.t}</Text>
            </View>
          );
        })}
      </Card>
      {b.status === 'en_camino' && (
        <Card style={{ gap: 10 }}>
          <Text style={s.boxTitle}>¿Por dónde viene {first}?</Text>
          <LiveMap bookingId={b.id} destination={b.location} name={first} />
        </Card>
      )}
      {b.outcome && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={s.boxTitle}>{serviceCopy(b.category).reportTitle}</Text>
            <Text style={[s.badge, b.outcome === 'resuelto' && { backgroundColor: c.successSoft, color: c.success }]}>{outcomeLabel(b.outcome, b.category)}</Text>
          </View>
          {b.diagnosis ? <Body>{b.diagnosis}</Body> : null}
          {!!b.diagnosisPhotos?.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {b.diagnosisPhotos.map((u) => (
                <Pressable key={u} onPress={() => Linking.openURL(u)}>
                  <Image source={{ uri: u }} style={s.photo} accessibilityLabel="Foto del servicio" />
                </Pressable>
              ))}
            </View>
          )}
          <Body muted style={{ fontSize: 13 }}>{AFTER_VISIT_NOTE}</Body>
        </Card>
      )}
      {b.extra && <ExtraBox id={b.id} extra={b.extra} proName={first} />}
      {b.status === 'cancelada' && b.proFault && !b.rating && <RatingBox id={b.id} proName={first} />}
      {['por_aprobar', 'completada'].includes(b.status) && !b.rating && b.extra?.status !== 'propuesto' && <RatingBox id={b.id} proName={first} />}
      {b.rating ? <Body muted>Calificaste a {first} con {'★'.repeat(b.rating)}. ¡Gracias!</Body> : null}
      {b.status === 'por_aprobar' && !b.rating && b.extra?.status !== 'propuesto' && <ConfirmBox id={b.id} />}
      {(b.claimId || b.dispute) && <ClaimCard id={b.id} side="cliente" />}
      {['por_aprobar', 'completada'].includes(b.status) && !b.dispute && <ProblemBox id={b.id} category={b.category} />}
      {b.status === 'cancelada' && b.cancelledBy === 'cliente_ausente' && !b.dispute && Date.now() - (b.cancelledAt?.toMillis?.() ?? 0) < 48 * 3_600_000 && <ProblemBox id={b.id} category={b.category} absent />}
      {['confirmada', 'en_camino', 'en_curso'].includes(b.status) && (
        <View style={s.box}>
          <Text style={s.boxTitle}>{HOME_SAFETY_TITLE}</Text>
          {HOME_SAFETY_NOTICE.map((t) => <Body key={t} style={{ fontSize: 13.5 }}>• {t}</Body>)}
        </View>
      )}

      <Card style={{ gap: 6 }}>
        {b.address ? <Body>📍 {b.address}</Body> : null}
        {b.notes ? <Body muted>{b.notes}</Body> : null}
        {!!b.photos?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {b.photos.map((u) => <Pressable key={u} onPress={() => Linking.openURL(u)}><Image source={{ uri: u }} style={s.photo} accessibilityLabel="Tu foto" /></Pressable>)}
          </View>
        )}
        <Body>{b.visit ? `Visita ${formatUSD(b.visit)} · ` : ''}{b.surcharge ? `${b.surchargeKind === 'feriado' ? 'Recargo de feriado' : 'Recargo nocturno'} ${formatUSD(b.surcharge)} · ` : ''}Total: {formatUSD(b.total)} · Código {b.id.slice(0, 8).toUpperCase()}</Body>
      </Card>
      {focusChat !== '1' && <View>{b.status !== 'cancelada' && me && (
        <Card style={{ gap: 10 }}>
          <Text style={s.boxTitle}>💬 Chat con {first}</Text>
          <Chat bookingId={b.id} uid={me.uid} me="cliente" otherName={first} open={['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'].includes(b.status)} />
</Card>)} </View>}
      <CancelBox row={b} onDone={() => {}} />
    </View>
  );
}


/** Cobro adicional del profesional: el cliente lo acepta (tarjeta o efectivo) o lo rechaza. */
function ExtraBox({ id, extra, proName }: { id: string; extra: ExtraCharge; proName: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const act = async (data: ExtraAction) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try { await extraCharge(data); } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.'); } finally { setBusy(false); }
  };
  const paid = ['pagado', 'pagado_efectivo'].includes(extra.status);
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={s.boxTitle}>Cobro adicional de {proName}</Text>
        <Text style={[s.badge, paid && { backgroundColor: c.successSoft, color: c.success }]}>{EXTRA_STATUS_LABEL[extra.status]}</Text>
      </View>
      <Body muted>{extra.description}</Body>
      <Body>Monto {formatUSD(extra.amount)} + IVA {formatUSD(extra.iva)} = {formatUSD(extra.total)}</Body>
      {extra.status === 'propuesto' && (
        <>
          <Body muted style={{ fontSize: 12.5 }}>Págalo por la app para que quede registrado. HULUL no garantiza el trabajo adicional: califica al profesional según cómo lo hizo.</Body>
          {msg ? <Body style={{ fontSize: 13, color: c.primary }}>{msg}</Body> : null}
          <Button label={busy ? 'Guardando…' : 'Aceptar y pagar con tarjeta'} onPress={() => act({ id, action: 'aceptar', method: 'tarjeta' })} />
          <Button variant="secondary" label="Aceptar y pagar en efectivo" onPress={() => act({ id, action: 'aceptar', method: 'efectivo' })} />
          <Button variant="danger" label="No acepto" onPress={() => act({ id, action: 'rechazar' })} />
        </>
      )}
      {extra.status === 'por_cobrar' && <Body muted style={{ fontSize: 12.5 }}>Se cobrará con tu tarjeta. Versión de prueba: todavía no se hace el cobro real.</Body>}
      {extra.status === 'efectivo_pendiente' && <Body muted style={{ fontSize: 12.5 }}>Págale {formatUSD(extra.total)} en efectivo a {proName}. Él confirmará que lo recibió.</Body>}
    </Card>
  );
}

/** El cliente confirma que el servicio terminó (si no, se cierra solo a las 24 horas). */
function ConfirmBox({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async () => {
    if (busy) return;
    setBusy(true); setMsg('');
    try { await confirmService(id); } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.boxTitle}>¿Prefieres no calificar ahora?</Text>
      <Body muted style={{ fontSize: 13 }}>Puedes cerrar el servicio sin calificar. Si no haces nada, se cierra solo 24 horas después de terminado.</Body>
      {msg ? <Body style={{ fontSize: 13, color: c.primary }}>{msg}</Body> : null}
      <Button variant="secondary" label={busy ? 'Guardando…' : 'Cerrar sin calificar'} onPress={go} />
    </Card>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  when: { fontFamily: font.bodyBold, fontSize: 16, color: c.text },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
  step: { fontFamily: font.bodySemi, fontSize: 14.5, color: c.textMuted },
  box: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.surfaceWarm },
  boxTitle: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
  err: { fontFamily: font.bodySemi, fontSize: 13, color: c.primary },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipOn: { backgroundColor: c.text, borderColor: c.text },
  chipText: { fontFamily: font.bodySemi, fontSize: 13, color: c.text },
  badge: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.copperSoft, color: c.text, fontFamily: font.bodyBold, fontSize: 12.5 },
  photo: { width: 88, height: 88, borderRadius: 10, borderWidth: 1, borderColor: c.border },
});
