import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { AFTER_VISIT_NOTE, appointmentTime, formatUSD, getCategory, hhmmEcuador, HOME_SAFETY_NOTICE, HOME_SAFETY_TITLE, OUTCOME_LABEL, SLOTS, usd } from '@hulul/shared';
import { confirmService, EXTRA_STATUS_LABEL, extraCharge, firestore, reschedule, type ClientBooking, type ExtraAction, type ExtraCharge, type RescheduleAction } from '@hulul/shared/firebase';
import { Icon } from '@/components/Icon';
import { LiveMap } from '@/components/LiveMap';
import { BackButton, Body, Card, H1, PrimaryButton } from '@/components/ui';
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
  const { id } = useLocalSearchParams<{ id: string }>();
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
        {b === undefined && <Body muted>Cargando…</Body>}
        {b === null && <Body>No encontramos esta reserva.</Body>}
        {b && <Detail b={b} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ b }: { b: ClientBooking }) {
  const cat = getCategory(b.category);
  const first = b.professionalName.split(' ')[0];
  const idx = STEPS.findIndex((x) => x.status === b.status);
  const at = appointmentTime(b.date, b.slot);
  const message: Record<string, string> = {
    pendiente: `Esperando que ${first} acepte tu reserva. Te avisamos apenas lo haga.`,
    confirmada: `${first} confirmó. Saldrá con el tiempo justo para llegar a las ${b.slot} (puede salir desde las ${hhmmEcuador(new Date(at.getTime() - 120 * 60_000))}).`,
    en_camino: `${first} va en camino. Míralo en el mapa en vivo.`,
    en_curso: `${first} está trabajando. Al terminar te deja el resultado y un diagnóstico con fotos.`,
    por_aprobar: `${first} terminó la visita. Revisa su diagnóstico; tienes 48 horas para calificarlo o reportar un problema.`,
    completada: 'Servicio completado.',
    cancelada: b.cancelledBy === 'sistema' ? 'Ningún profesional aceptó esta reserva antes de la hora; se canceló sin costo.' : b.cancelledBy === 'profesional' ? `${first} canceló. No se te cobra nada.` : `Cancelaste esta reserva${b.cancelFee ? ` con un cargo de ${usd(b.cancelFee)}${b.demo ? ' (prueba)' : ''}` : ' sin costo'}.`,
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <H1 style={{ fontSize: 24 }}>{cat?.name ?? b.category} con {b.professionalName}</H1>
        <Text style={s.when}>{shortDay(b.date)} · {b.slot}</Text>
      </View>
      <Card style={{ gap: 14 }}>
        <Body>{message[b.status] ?? ''}</Body>
        {b.status !== 'cancelada' && STEPS.map((st, i) => {
          const done = idx > i || ['por_aprobar', 'completada'].includes(b.status);
          const now = idx === i && !done;
          return (
            <View key={st.status} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.dot, done && { backgroundColor: c.success, borderColor: c.success }, now && { borderColor: c.copper }]}>
                {done && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
              </View>
              <Text style={[s.step, (done || now) && { color: c.text }]}>{st.t}</Text>
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
            <Text style={s.boxTitle}>Diagnóstico del profesional</Text>
            <Text style={[s.badge, b.outcome === 'resuelto' && { backgroundColor: c.successSoft, color: c.success }]}>{OUTCOME_LABEL[b.outcome]}</Text>
          </View>
          {b.diagnosis ? <Body>{b.diagnosis}</Body> : null}
          {!!b.diagnosisPhotos?.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {b.diagnosisPhotos.map((u) => (
                <Pressable key={u} onPress={() => Linking.openURL(u)}>
                  <Image source={{ uri: u }} style={s.photo} accessibilityLabel="Foto del diagnóstico" />
                </Pressable>
              ))}
            </View>
          )}
          <Body muted style={{ fontSize: 13 }}>{AFTER_VISIT_NOTE}</Body>
        </Card>
      )}
      {b.extra && <ExtraBox id={b.id} extra={b.extra} proName={first} />}
      {b.status === 'por_aprobar' && b.extra?.status !== 'propuesto' && <ConfirmBox id={b.id} />}
      {['confirmada', 'en_camino', 'en_curso'].includes(b.status) && (
        <View style={s.box}>
          <Text style={s.boxTitle}>{HOME_SAFETY_TITLE}</Text>
          {HOME_SAFETY_NOTICE.map((t) => <Body key={t} style={{ fontSize: 13.5 }}>• {t}</Body>)}
        </View>
      )}
      {['pendiente', 'confirmada'].includes(b.status) && <Reschedule b={b} other={first} />}
      <Card style={{ gap: 6 }}>
        {b.address ? <Body>📍 {b.address}</Body> : null}
        {b.notes ? <Body muted>{b.notes}</Body> : null}
        {!!b.photos?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {b.photos.map((u) => <Pressable key={u} onPress={() => Linking.openURL(u)}><Image source={{ uri: u }} style={s.photo} accessibilityLabel="Tu foto" /></Pressable>)}
          </View>
        )}
        <Body>{b.visit ? `Visita ${formatUSD(b.visit)} · ` : ''}Total: {formatUSD(b.total)} · Código {b.id.slice(0, 8).toUpperCase()}</Body>
      </Card>
      <CancelBox row={b} onDone={() => {}} />
    </View>
  );
}

function Reschedule({ b, other }: { b: ClientBooking; other: string }) {
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(Date.now() - 5 * 3_600_000 + i * 86_400_000).toISOString().slice(0, 10)), []);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(b.date);
  const [sl, setSl] = useState(b.slot);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (a: RescheduleAction) => {
    setBusy(true); setMsg('');
    try { await reschedule(b.id, a, a === 'proponer' ? d : undefined, a === 'proponer' ? sl : undefined); setOpen(false); }
    catch (e) { setMsg((e as { message?: string }).message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const p = b.proposal;
  if (p) {
    const mine = p.by === 'cliente';
    return (
      <View style={s.box}>
        <Text style={s.boxTitle}>{mine ? 'Propusiste cambiar la hora' : `${other} propone cambiar la hora`}</Text>
        <Body style={{ fontSize: 14 }}>De {shortDay(b.date)} {b.slot} → {shortDay(p.date)} {p.slot}.{mine ? ` Esperando la respuesta de ${other}.` : ''}</Body>
        {msg ? <Text style={s.err}>{msg}</Text> : null}
        {mine
          ? <Pressable onPress={() => !busy && run('retirar')}><Text style={s.link}>Retirar propuesta</Text></Pressable>
          : <>
              <PrimaryButton label={busy ? 'Guardando…' : 'Aceptar nueva hora'} onPress={() => !busy && run('aceptar')} />
              <Pressable onPress={() => !busy && run('rechazar')}><Text style={[s.link, { textAlign: 'center' }]}>Mantener la hora original</Text></Pressable>
            </>}
      </View>
    );
  }
  if (!open) return <Pressable onPress={() => setOpen(true)}><Text style={s.link}>Cambiar fecha u hora</Text></Pressable>;
  return (
    <View style={s.box}>
      <Text style={s.boxTitle}>Proponer otra fecha u hora</Text>
      <Body muted style={{ fontSize: 13 }}>Puedes adelantar o atrasar. {other} debe aceptar.</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {days.map((x, i) => (
          <Pressable key={x} onPress={() => setD(x)} style={[s.chip, d === x && s.chipOn]}>
            <Text style={[s.chipText, d === x && { color: '#fff' }]}>{i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : shortDay(x)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {SLOTS.map((x) => (
          <Pressable key={x} onPress={() => setSl(x)} style={[s.chip, sl === x && s.chipOn]}>
            <Text style={[s.chipText, sl === x && { color: '#fff' }]}>{x}</Text>
          </Pressable>
        ))}
      </View>
      {msg ? <Text style={s.err}>{msg}</Text> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar propuesta'} onPress={() => !busy && run('proponer')} />
      <Pressable onPress={() => setOpen(false)}><Text style={[s.link, { textAlign: 'center' }]}>Volver</Text></Pressable>
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
          <PrimaryButton label={busy ? 'Guardando…' : 'Aceptar y pagar con tarjeta (recomendado)'} onPress={() => act({ id, action: 'aceptar', method: 'tarjeta' })} />
          <Pressable accessibilityRole="button" onPress={() => act({ id, action: 'aceptar', method: 'efectivo' })} style={s.chip}><Text style={s.chipText}>Aceptar y pagar en efectivo</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => act({ id, action: 'rechazar' })}><Text style={[s.chipText, { color: c.primary, textAlign: 'center' }]}>No acepto</Text></Pressable>
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
      <Text style={s.boxTitle}>¿Todo en orden?</Text>
      <Body muted style={{ fontSize: 13 }}>Confirma para cerrar el servicio. Si no lo haces, se cierra solo 24 horas después de terminado.</Body>
      {msg ? <Body style={{ fontSize: 13, color: c.primary }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Guardando…' : 'Confirmar y cerrar el servicio'} onPress={go} />
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
