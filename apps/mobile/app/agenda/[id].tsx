import {ClientSummary} from '@/components/ClientSummary';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  acceptedDelay, appointmentTime, departPlan, travelEstimate, extraQuote, formatUSD, getCategory, hhmmEcuador, serviceCopy, outcomeLabel, hasProfanity, PROFANITY_MESSAGE, MAX_DIAGNOSIS_CHARS, MAX_DIAGNOSIS_PHOTOS,
  MAX_EXTRA, MIN_DIAGNOSIS_CHARS, MIN_EXTRA, POLICY, type JobOutcome,
} from '@hulul/shared';
import { EXTRA_STATUS_LABEL, extraCharge, proAction, rateClient, ringClient, shareLivePosition, type ExtraAction, type ProAction, type ProBooking } from '@hulul/shared/firebase';
import { BackButton, Body, Card, H1, Button, PrimaryButton } from '@/components/ui';
import { Chat } from '@/components/Chat';
import { DelayPro } from '@/components/Delay';
import { Reschedule, shortDay } from '@/components/Reschedule';
import { StarInput } from '@/components/Rating';
import { earned, STATUS_LABEL, todayEc, useBooking } from '@/lib/agenda';
import { photosAvailable, pickPhotos, uploadLocalPhotos } from '@/lib/photos';
import { useUser } from '@/lib/auth';
import { c, font, radius } from '@/theme';

const CHAT_OPEN = ['pendiente', 'confirmada', 'en_camino', 'en_curso', 'por_aprobar'];
const errText = (e: unknown) => (e as { message?: string }).message || 'No se pudo guardar. Inténtalo de nuevo.';

/** Un trabajo del profesional, en vivo, con todas sus acciones (todo dentro de la app). */
export default function JobScreen() {
  const { id, aviso, mensaje, chat } = useLocalSearchParams<{ id: string;aviso?:string;mensaje?:string;chat?:string }>();
  const user = useUser();
  const b = useBooking(id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <BackButton />
          {aviso && <Card><Body>{aviso}</Body>{mensaje && <Body muted>{mensaje}</Body>}</Card>}
          {b === undefined && <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />}
          {b === null && <Body>No encontramos este trabajo.</Body>}
          {b && user && <Job b={b} uid={user.uid} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Job({ b, uid }: { b: ProBooking; uid: string }) {
  const {chat:focusChat}=useLocalSearchParams<{chat?:string}>();
  const cat = getCategory(b.category);
  const first = String(b.contactName ?? 'el cliente').split(' ')[0];
  const [busy, setBusy] = useState<ProAction | ''>('');
  const [msg, setMsg] = useState('');
  const [asking, setAsking] = useState<'' | 'rechazar' | 'no_puedo' | 'cliente_ausente'>('');
  const [reason, setReason] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [code, setCode] = useState('');

  const act = async (a: ProAction, report?: Parameters<typeof proAction>[3]) => {
    setBusy(a); setMsg('');
    try {
      // "Estoy en la dirección" se comprueba con el GPS del celular.
      let pos: { lat: number; lng: number; accuracy: number | null } | undefined;
      if (a === 'en_puerta' && b.location) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) throw new Error('Permite el acceso a tu ubicación para marcar que llegaste.');
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null };
      }
      await proAction(b.id, a, reason.trim(), report, a === 'llegue' ? code.trim() : undefined, pos);
      setAsking(''); setFinishing(false); setReason('');
    }
    catch (e) { setMsg(errText(e)); }
    finally { setBusy(''); }
  };

  const nav = b.location
    ? { google: `https://www.google.com/maps/dir/?api=1&destination=${b.location.lat},${b.location.lng}`, waze: `https://waze.com/ul?ll=${b.location.lat},${b.location.lng}&navigate=yes` }
    : { google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`, waze: `https://waze.com/ul?q=${encodeURIComponent(b.address)}&navigate=yes` };
  const live = ['pendiente', 'confirmada', 'en_camino', 'en_curso'].includes(b.status);

  return (
    <View style={{ gap: 16 }}>
{focusChat === '1' && <View>{b.status !== 'cancelada' && (
        <Card style={{ gap: 10 }}>
          <Text style={s.label}>💬 Chat con {first}</Text>
          <Chat bookingId={b.id} uid={uid} me="profesional" otherName={first} open={CHAT_OPEN.includes(b.status)} />
          {live && <AskPhotosHint />}
        </Card>
      )}</View>}
      <View style={{ gap: 4 }}>
        <Text style={[s.badge, b.status === 'pendiente' && s.badgeHot]}>{STATUS_LABEL[b.status] ?? b.status}</Text>
        <H1 style={{ fontSize: 24 }}>{cat?.name} · {first}</H1>
        <Text style={s.when}>{b.date === todayEc() ? 'Hoy' : shortDay(b.date)} · {b.slot}</Text>
        <Body muted style={{ fontSize: 13.5 }}>{b.extra && !['propuesto', 'rechazado'].includes(b.extra.status) ? 'Visita + adicional' : 'Visita'}{b.surcharge ? ` + ${b.surchargeKind === 'feriado' ? 'recargo de feriado' : 'recargo nocturno'} (${formatUSD(b.surcharge)})` : ''}: te queda {formatUSD(earned(b))} · {b.paymentMethod === 'tarjeta' ? 'Tarjeta' : b.paymentMethod === 'transferencia' ? 'Transferencia' : 'DeUna'}{b.demo ? ' · prueba' : ''}</Body>
        {b.noiseAccepted && <Body muted style={{ fontSize: 12.5 }}>El cliente aceptó responder por el ruido ante vecinos y administración. Si no te dejan trabajar, espera y marca &quot;Cliente ausente&quot;.</Body>}
      </View>

      <Card style={{ gap: 10 }}>
        <ClientSummary bookingId={b.id} />
        <Text style={s.label}>Qué necesita</Text>
        <Body>{b.notes || 'Sin descripción.'}</Body>
        {!!b.photos?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {b.photos.map((u) => <Pressable key={u} onPress={() => Linking.openURL(u)}><Image source={{ uri: u }} style={s.photo} accessibilityLabel="Foto del cliente" /></Pressable>)}
          </View>
        )}
        <Text style={s.label}>Dónde</Text>
        <Body>📍 {b.address}</Body>
        {b.status !== 'cancelada' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="secondary" label="Google Maps" onPress={() => Linking.openURL(nav.google)} style={{ flex: 1 }} />
            <Button variant="secondary" label="Waze" onPress={() => Linking.openURL(nav.waze)} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      {b.outcome && (
        <Card style={{ gap: 8 }}>
          <Text style={s.label}>Tu {serviceCopy(b.category).reportTitle.toLowerCase()} · {outcomeLabel(b.outcome, b.category)}</Text>
          {b.diagnosis ? <Body>{b.diagnosis}</Body> : null}
          {!!b.diagnosisPhotos?.length && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {b.diagnosisPhotos.map((u) => <Pressable key={u} onPress={() => Linking.openURL(u)}><Image source={{ uri: u }} style={s.photo} /></Pressable>)}
            </View>
          )}
        </Card>
      )}

      {msg ? <Body style={{ color: c.primary, fontSize: 13.5 }}>{msg}</Body> : null}

      {finishing ? (
        <FinishPanel bookingId={b.id} category={b.category} uid={uid} busy={!!busy} onCancel={() => setFinishing(false)} onSend={(r) => act('terminar', r)} />
      ) : asking ? (
        <Card style={{ gap: 10 }}>
          <Text style={s.label}>{asking === 'rechazar' ? '¿Por qué no puedes? (opcional)' : asking === 'cliente_ausente' ? '¿Qué pasó? (opcional)' : 'Cuéntale al cliente qué pasó'}</Text>
          <TextInput value={reason} onChangeText={setReason} maxLength={300} style={s.input} placeholderTextColor={c.textMuted} placeholder="Escribe aquí" />
          {asking === 'no_puedo' && <Body muted style={{ fontSize: 12.5 }}>Cancelar con menos de 2 horas o yendo en camino cuenta como falta y tiene una multa de {formatUSD(POLICY.proLateFine)}.</Body>}
          {asking === 'cliente_ausente' && <Body muted style={{ fontSize: 12.5 }}>Se cancela la reserva y al cliente se le cobra la visita, que es para ti (menos la comisión). Después podrás calificarlo.</Body>}
          <Button variant={asking === 'rechazar' || asking === 'no_puedo' || asking === 'cliente_ausente' ? 'danger' : 'primary'} label={busy ? 'Guardando…' : 'Confirmar'} onPress={() => !busy && act(asking)} />
          <Button variant="secondary" label="Volver" onPress={() => setAsking('')} />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {b.status === 'pendiente' && b.date >= todayEc() && (
            <>
              <PrimaryButton label={busy === 'aceptar' ? 'Aceptando…' : 'Aceptar trabajo'} onPress={() => !busy && act('aceptar')} />
              <Button variant="danger" label="Rechazar" onPress={() => setAsking('rechazar')} />
              <Body muted style={{ fontSize: 12.5 }}>Lee bien qué necesita el cliente y acepta solo si sabes hacerlo.</Body>
            </>
          )}
          {b.status === 'confirmada' && <DepartInfo b={b} />}
          {['confirmada', 'en_camino'].includes(b.status) && <DelayPro id={b.id} slot={b.slot} delay={b.delay} client={first} />}
          {b.status === 'confirmada' && <PrimaryButton label={busy === 'en_camino' ? 'Guardando…' : 'Voy en camino'} onPress={() => !busy && act('en_camino')} />}
          {b.status === 'en_camino' && <LiveShare bookingId={b.id} />}
          {b.status === 'en_camino' && !b.arrivedAt && <PrimaryButton label={busy === 'en_puerta' ? 'Guardando…' : 'Estoy en la dirección'} onPress={() => !busy && act('en_puerta')} />}
          {b.status === 'en_camino' && b.arrivedAt && (
            <Card style={{ gap: 10 }}>
              <Text style={s.label}>Código del cliente</Text>
              <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} placeholder="0000" placeholderTextColor={c.textMuted} style={[s.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]} />
              <Body muted style={{ fontSize: 12.5 }}>Pídele al cliente el código de 4 dígitos que ve en su reserva. Sin código no puedes empezar ni terminar.</Body>
              <PrimaryButton label={busy === 'llegue' ? 'Verificando…' : 'Empezar el trabajo'} onPress={() => !busy && code.length === 4 && act('llegue')} />
            </Card>
          )}
          {b.status === 'en_curso' && <PrimaryButton label="Terminar la visita" onPress={() => setFinishing(true)} />}
          {b.status === 'en_camino' && b.arrivedAt && <RingButton id={b.id} rings={b.rings ?? []} client={first} />}
          {b.status === 'en_camino' && b.arrivedAt && <AbsentButton startedAt={Math.max(b.arrivedAt.toMillis(), appointmentTime(b.date, b.slot).getTime() + acceptedDelay(b) * 60_000)} rings={(b.rings ?? []).length} late={arrivedLate(b)} onPress={() => setAsking('cliente_ausente')} />}
          {(b.status === 'confirmada' || b.status === 'en_camino') && (
            <Button variant="danger" label="No puedo ir" onPress={() => setAsking('no_puedo')} />
          )}
        </View>
      )}

      <ExtraPro b={b} />

      {(['por_aprobar', 'completada'].includes(b.status) || b.cancelledBy === 'cliente_ausente') && !b.clientRating && <RateClient id={b.id} name={first} />}
      {b.rating ? <Body muted>El cliente te calificó {'★'.repeat(b.rating)}</Body> : null}

      {['pendiente', 'confirmada'].includes(b.status) && <Reschedule id={b.id} date={b.date} slot={b.slot} proposal={b.proposal} me="profesional" other={first} />}

      {focusChat !== '1' && <View>{b.status !== 'cancelada' && (
        <Card style={{ gap: 10 }}>
          <Text style={s.label}>💬 Chat con {first}</Text>
          <Chat bookingId={b.id} uid={uid} me="profesional" otherName={first} open={CHAT_OPEN.includes(b.status)} />
          {live && <AskPhotosHint />}
        </Card>
      )}</View>}
    </View>
  );
}

/** Pedir fotos: en la app va por el chat (el profesional escribe qué necesita). */
function AskPhotosHint() {
  return <Body muted style={{ fontSize: 12 }}>¿Quieres ver el lugar o algún detalle? Pídele fotos al cliente por el chat.</Body>;
}

/**
 * Antes de salir: a cuánto está, cuánto tarda con tráfico, a qué hora llegaría
 * si sale ahora y a qué hora debe salir a más tardar. Se actualiza cada 2 min.
 */
function DepartInfo({ b }: { b: ProBooking }) {
  const [trip, setTrip] = useState<{ km: number; minutes: number } | null>(null);
  const [note, setNote] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!b.location) { setNote('El cliente no marcó su ubicación en el mapa. Usa Google Maps para ver el tiempo de viaje.'); return; }
    let off = false;
    const measure = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) { if (!off) setNote('Permite la ubicación de HULUL para calcular cuándo llegas.'); return; }
        const p = (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!off && p) { setTrip(travelEstimate({ lat: p.coords.latitude, lng: p.coords.longitude }, b.location!)); setNote(''); setNow(new Date()); }
      } catch {
        if (!off) setNote('No pudimos leer tu ubicación. Revisa que el GPS esté encendido.');
      }
    };
    measure();
    const t = setInterval(measure, 120_000);
    return () => { off = true; clearInterval(t); };
  }, [b.location]);

  const plan = departPlan(b, now, trip?.minutes);
  const arrive = trip ? new Date(now.getTime() + trip.minutes * 60_000) : null;
  const late = plan.lateBy > 0;
  return (
    <View style={[s.info, trip && { backgroundColor: late ? '#FBEAE8' : c.successSoft }]}>
      {trip ? (
        <>
          <Text style={s.label}>Estás a {trip.km} km · unos {trip.minutes} min con tráfico</Text>
          <Body style={{ fontSize: 13.5 }}>
            Si sales ahora llegas a las <Text style={{ fontFamily: font.bodyBold }}>{hhmmEcuador(arrive!)}</Text>
            {late ? `, ${plan.lateBy} min tarde. Avisa al cliente con "Avisar que llegaré tarde".` : ` (tu cita es a las ${b.slot}).`}
            {!late && plan.latest ? ` Sal a más tardar a las ${hhmmEcuador(plan.latest)}.` : ''}
          </Body>
        </>
      ) : <Body style={{ fontSize: 13.5 }}>{note || 'Calculando cuánto tardas en llegar…'}</Body>}
      {!plan.canGo && <Body muted style={{ fontSize: 12.5 }}>Podrás marcar "Voy en camino" desde las {hhmmEcuador(plan.earliest)}.</Body>}
      <Body muted style={{ fontSize: 11.5 }}>Tiempo estimado con el tráfico promedio de la ciudad. Google Maps o Waze dan el tiempo exacto.</Body>
    </View>
  );
}

/** Comparte la ubicación con el cliente mientras va en camino (con esta pantalla abierta). */
function LiveShare({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<'buscando' | 'ok' | 'denegado' | 'error'>('buscando');
  const [last, setLast] = useState<Date | null>(null);
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let off = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setState('denegado'); return; }
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 40 }, async (p) => {
        try {
          await shareLivePosition(bookingId, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, heading: p.coords.heading });
          if (!off) { setState('ok'); setLast(new Date()); }
        } catch { /* sin conexión: se intenta con la siguiente posición */ }
      });
      if (off) sub.remove();
    })().catch(() => setState('error'));
    return () => { off = true; sub?.remove(); };
  }, [bookingId]);
  const text = {
    buscando: 'Activando tu ubicación para que el cliente te vea en el mapa…',
    ok: `📍 El cliente te ve en el mapa${last ? ` (última señal ${hhmmEcuador(last)})` : ''}. Deja esta pantalla abierta mientras vas.`,
    denegado: 'Permite la ubicación de HULUL en los ajustes del celular para que el cliente te vea llegar.',
    error: 'No pudimos leer tu GPS. Revisa que la ubicación esté encendida.',
  }[state];
  return <View style={s.info}><Body style={{ fontSize: 13.5, color: state === 'ok' ? c.text : c.primary }}>{text}</Body></View>;
}

/** "El cliente no está": 10 minutos después de marcar "Llegué". */
/** ¿Llegó más de 15 min después de la hora (contando el retraso aceptado)? Entonces no se cobra al cliente. */
function arrivedLate(b: ProBooking): boolean {
  const at = appointmentTime(b.date, b.slot).getTime() + acceptedDelay(b) * 60_000;
  return (b.arrivedAt?.toMillis?.() ?? 0) > at + POLICY.lateToleranceMinutes * 60_000;
}

function AbsentButton({ startedAt, rings, late, onPress }: { startedAt?: number; rings: number; late: boolean; onPress: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const left = startedAt ? Math.ceil((startedAt + POLICY.clientNoShowWaitMinutes * 60_000 - now) / 60_000) : 0;
  const missing = POLICY.ringsBeforeAbsent - rings;
  return (
    <Button variant="danger" disabled={left > 0 || missing > 0} onPress={onPress}
      label={missing > 0 ? `El cliente no está (timbra ${missing} ${missing === 1 ? 'vez' : 'veces'} más)` : left > 0 ? `El cliente no está (en ${left} min)` : late ? 'El cliente no está (sin cobro: llegaste tarde)' : 'El cliente no está'} />
  );
}

/** Timbrar: notificación con sonido al celular del cliente (hasta 3, cada 3 min). */
function RingButton({ id, rings, client }: { id: string; rings: number[]; client: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5_000); return () => clearInterval(t); }, []);
  const n = rings.length;
  const done = n >= POLICY.ringsBeforeAbsent;
  const last = n ? Number(rings[n - 1]) : 0;
  const left = last ? Math.ceil((last + POLICY.ringGapMinutes * 60_000 - now) / 60_000) : 0;
  const ring = async () => {
    setBusy(true); setErr('');
    try { await ringClient(id); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 8 }}>
      <Button variant="secondary" disabled={busy || done || left > 0} onPress={ring}
        label={busy ? 'Timbrando…' : done ? `🔔 Timbraste ${n} veces` : left > 0 ? `🔔 Timbrar otra vez (en ${left} min)` : `🔔 Timbrar a ${client} (${n}/${POLICY.ringsBeforeAbsent})`} />
      <Body muted style={{ fontSize: 12.5 }}>{done ? 'Si no responde, espera el tiempo que falta y marca "El cliente no está".' : 'Le suena una alerta en el celular. Cada timbre queda registrado.'}</Body>
      {!!err && <Body style={{ fontSize: 12.5, color: c.danger }}>{err}</Body>}
    </Card>
  );
}

/** Terminar: cómo quedó, informe o resumen y al menos una foto. */
function FinishPanel({ bookingId, category, uid, busy, onCancel, onSend }: {
  bookingId: string; category: string; uid: string; busy: boolean; onCancel: () => void; onSend: (r: { outcome: JobOutcome; diagnosis: string; photos: string[] }) => void;
}) {
  const [outcome, setOutcome] = useState<JobOutcome | ''>('');
  const [diagnosis, setDiagnosis] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const canPhoto = photosAvailable();
  const copy = serviceCopy(category);

  const add = async (from: 'camara' | 'galeria') => {
    setErr('');
    try {
      const uris = await pickPhotos(from, MAX_DIAGNOSIS_PHOTOS - photos.length);
      if (!uris.length) return;
      setUploading(true);
      const urls = await uploadLocalPhotos(`diagnosticos/${uid}/${bookingId}`, uris);
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      setErr((e as { code?: string }).code === 'sin-permiso-camara' ? 'Permite la cámara en los ajustes del celular.' : 'No se pudieron subir las fotos.');
    } finally {
      setUploading(false);
    }
  };

  const send = () => {
    setErr('');
    if (!outcome) { setErr('Elige cómo quedó el servicio.'); return; }
    if (outcome !== 'resuelto' && diagnosis.trim().length < MIN_DIAGNOSIS_CHARS) { setErr('Cuéntale al cliente qué pasó y qué recomiendas.'); return; }
    if (!photos.length) { setErr('Sube al menos una foto. Es tu respaldo.'); return; }
    onSend({ outcome, diagnosis: diagnosis.trim(), photos });
  };

  return (
    <Card style={{ gap: 12 }}>
      <Text style={s.label}>¿Cómo quedó?</Text>
      {(Object.keys(copy.outcomes) as JobOutcome[]).map((v) => ({ value: v, ...copy.outcomes[v] })).map((o) => (
        <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: outcome === o.value }} onPress={() => setOutcome(o.value)} style={[s.option, outcome === o.value && s.optionOn]}>
          <Text style={s.btnText}>{o.label}</Text>
          <Body muted style={{ fontSize: 12.5 }}>{o.help}</Body>
        </Pressable>
      ))}
      <TextInput value={diagnosis} onChangeText={setDiagnosis} maxLength={MAX_DIAGNOSIS_CHARS} multiline placeholderTextColor={c.textMuted}
        placeholder={`${copy.reportTitle}${outcome === 'resuelto' ? ' (opcional)' : ''}: ${copy.reportPlaceholder.toLowerCase()}`} style={[s.input, { minHeight: 90, textAlignVertical: 'top', paddingTop: 10 }]} />
      <Text style={s.label}>{copy.photosAtEnd} ({photos.length}/{MAX_DIAGNOSIS_PHOTOS}, mínimo 1)</Text>
      {photos.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{photos.map((u) => <Image key={u} source={{ uri: u }} style={s.photo} />)}</View>}
      {canPhoto ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="secondary" disabled={uploading} label={uploading ? 'Subiendo…' : '📷 Tomar foto'} onPress={() => add('camara')} style={{ flex: 1 }} />
          <Button variant="secondary" disabled={uploading} label="Galería" onPress={() => add('galeria')} style={{ flex: 1 }} />
        </View>
      ) : (
        <Body muted style={{ fontSize: 12.5 }}>Esta versión de la app aún no tiene cámara. Instala la versión nueva, o termina desde hululec.com/profesionales/agenda.</Body>
      )}
      {err ? <Body style={{ color: c.primary, fontSize: 13 }}>{err}</Body> : null}
      <PrimaryButton label={busy ? 'Guardando…' : 'Terminar y enviar al cliente'} onPress={() => !busy && !uploading && send()} />
      <Button variant="secondary" label="Volver" onPress={onCancel} />
    </Card>
  );
}

/** Cobro adicional: agregarlo y confirmar el pago en efectivo. */
function ExtraPro({ b }: { b: ProBooking }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const x = b.extra;
  const canAdd = ['en_curso', 'por_aprobar'].includes(b.status) && (!x || x.status === 'rechazado');
  const run = async (data: ExtraAction) => {
    setBusy(true); setMsg('');
    try { await extraCharge(data); setOpen(false); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };

  if (x && x.status !== 'rechazado') {
    return (
      <Card style={{ gap: 8 }}>
        <Text style={s.label}>Cobro adicional · {EXTRA_STATUS_LABEL[x.status]}</Text>
        <Body muted>{x.description}</Body>
        <Body>{x.iva > 0 ? `${formatUSD(x.amount)} + IVA = ${formatUSD(x.total)}` : formatUSD(x.total)}. Te queda {formatUSD(x.amount - x.commission)}.</Body>
        {msg ? <Body style={{ color: c.primary, fontSize: 13 }}>{msg}</Body> : null}
        {x.status === 'efectivo_pendiente' && <PrimaryButton label={busy ? 'Guardando…' : `Recibí ${formatUSD(x.total)} en efectivo`} onPress={() => !busy && run({ id: b.id, action: 'recibi_efectivo' })} />}
      </Card>
    );
  }
  if (!canAdd) return null;
  if (!open) return <Button variant="secondary" label="+ Agregar cobro adicional" onPress={() => setOpen(true)} />;

  const n = Number(amount.replace(',', '.'));
  const q = Number.isFinite(n) && n > 0 ? extraQuote(n, b.taxRegime) : null;
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.label}>Cobro adicional</Text>
      {x?.status === 'rechazado' && <Body muted style={{ fontSize: 12.5 }}>El cliente no aceptó el anterior ({formatUSD(x.total)}).</Body>}
      <Body muted style={{ fontSize: 12.5 }}>Repuestos, más trabajo u otra visita que acordaste con el cliente. Él lo acepta y lo paga en la app.</Body>
      <TextInput value={amount} onChangeText={(t) => setAmount(t.replace(/[^\d.,]/g, '').slice(0, 7))} keyboardType="decimal-pad" placeholder="Monto sin IVA (USD)" placeholderTextColor={c.textMuted} style={s.input} />
      <TextInput value={desc} onChangeText={setDesc} maxLength={300} placeholder="¿Qué incluye? Ej.: capacitor y 1 hora más" placeholderTextColor={c.textMuted} style={s.input} />
      {q && <Body muted style={{ fontSize: 12.5 }}>El cliente paga {formatUSD(q.total)}. Te queda {formatUSD(q.proPayout)}.</Body>}
      {msg ? <Body style={{ color: c.primary, fontSize: 13 }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar al cliente'} onPress={() => {
        if (busy) return;
        if (!q || n < MIN_EXTRA || n > MAX_EXTRA) { setMsg(`Escribe un monto entre $${MIN_EXTRA} y $${MAX_EXTRA}.`); return; }
        if (desc.trim().length < 10) { setMsg('Explica qué incluye (al menos 10 caracteres).'); return; }
        run({ id: b.id, action: 'proponer', amount: q.amount, description: desc.trim() });
      }} />
      <Button variant="secondary" label="Cancelar" onPress={() => setOpen(false)} />
    </Card>
  );
}

/** El profesional califica al cliente; el promedio es visible para sus profesionales, los comentarios siguen privados. */
function RateClient({ id, name }: { id: string; name: string }) {
  const [n, setN] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <Card style={{ gap: 8 }}>
      <Text style={s.label}>Califica a {name}</Text>
      <Body muted style={{ fontSize: 12.5 }}>El promedio y la cantidad de calificaciones serán visibles para los profesionales de sus reservas. Tu comentario queda privado para HULUL.</Body>
      <StarInput value={n} onChange={setN} size={28} label="Calificación del cliente" />
      {n > 0 && <TextInput value={text} onChangeText={setText} maxLength={600} placeholder="Comentario (opcional)" placeholderTextColor={c.textMuted} style={s.input} />}
      {msg ? <Body style={{ color: c.primary, fontSize: 13 }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar'} onPress={async () => {
        if (busy) return;
        if (!n) { setMsg('Elige las estrellas.'); return; }
        if (hasProfanity(text)) { setMsg(PROFANITY_MESSAGE); return; }
        setBusy(true); setMsg('');
        try { await rateClient({ id, stars: n, comment: text.trim() }); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
      }} />
    </Card>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.successSoft, color: c.success, fontFamily: font.bodyBold, fontSize: 12 },
  badgeHot: { backgroundColor: c.copperSoft, color: c.copper },
  when: { fontFamily: font.display, fontSize: 17, color: c.text },
  label: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  photo: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  btn: { flex: 1, minHeight: 46, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
  btnText: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary, paddingVertical: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: 12, fontFamily: font.body, fontSize: 14.5, color: c.text, backgroundColor: c.surface },
  info: { padding: 12, borderRadius: 10, backgroundColor: c.copperSoft, gap: 4 },
  option: { padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 2 },
  optionOn: { borderColor: c.primary, borderWidth: 2 },
});
