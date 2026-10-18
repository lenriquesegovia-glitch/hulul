import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Checkbox } from '@/components/Checkbox';
import { ClientGate } from '@/components/ClientGate';
import { Icon } from '@/components/Icon';
import { MapPicker } from '@/components/MapPicker';
import type { ClientProfile } from '@hulul/shared/firebase';
import { BOOKING_DAYS, checkSlot, categoryPricing, getCategory, searchPlaces, type LatLng, type PlaceSuggestion, dayAvailable, firstAvailable, formatUSD, quote, type Professional, slotAvailable, type PaymentMethod } from '@hulul/shared';
import { BackButton, Body, H2, PrimaryButton } from '@/components/ui';
import { nextDays, PAYMENT_OPTIONS, SLOTS, useBooking } from '@/lib/booking';
import { c, font, radius } from '@/theme';
import { ActivityIndicator } from 'react-native';
import { usePro } from '@/lib/pros';

const OTHER = 'Otro trabajo';
const NOTES_MAX = 940;

/** Para reservar hay que tener cuenta (como Uber). */
export default function BookingScreen() {
  return (
    <ClientGate screen title="Crea tu cuenta para reservar" lead="Así sigues tu servicio, recibes la confirmación y tienes la garantía de HULUL.">
      {({ user, profile }) => <BookingForm uid={user.uid} profile={profile} />}
    </ClientGate>
  );
}

function BookingForm({ uid, profile }: { uid: string; profile: ClientProfile }) {
  const { id, c: catParam } = useLocalSearchParams<{ id: string; c?: string }>();
  const pro = usePro(id, catParam);
  if (pro === undefined) return <SafeAreaView style={{ flex: 1, padding: 20 }}><BackButton /><ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /></SafeAreaView>;
  if (!pro) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>Este profesional no está disponible.</Body>
      </SafeAreaView>
    );
  }
  if (pro.id === uid) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>Este es tu propio perfil: no puedes reservarte a ti mismo. Con esta misma cuenta sí puedes reservar a otros profesionales.</Body>
      </SafeAreaView>
    );
  }
  return <BookingFormInner pro={pro} uid={uid} profile={profile} />;
}

function BookingFormInner({ pro, uid, profile }: { pro: Professional; uid: string; profile: ClientProfile }) {
  const { trabajo } = useLocalSearchParams<{ trabajo?: string }>();
  const cat = getCategory(pro.category);
  const jobs = useMemo(() => {
    const own = pro.services ?? [];
    return cat ? [...own, ...cat.servicios.filter((x) => !own.includes(x))] : own;
  }, [pro.services, cat]);
  const { confirm } = useBooking();

  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => nextDays(BOOKING_DAYS, now), [now]);
  // Horas mínimas y cargo de visita: los fija HULUL por categoría.
  const price = pro ? categoryPricing(pro.category) : { hours: 1, visit: 0, rate: 0 };
  const minH = Math.max(1, price.hours);
  /** Fecha AAAA-MM-DD de dentro de `d` días. */
  const isoAt = (d: number) => { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  /** Anticipación + horario de la categoría + horario del profesional. */
  const okWith = (d: number, k: number, h: number) => slotAvailable(d, k, now) && checkSlot({ category: pro.category, date: isoAt(d), slot: SLOTS[k], hours: h, pro }).ok;
  const first = useMemo(() => {
    const f = firstAvailable(now);
    for (let d = f.day; d < BOOKING_DAYS; d++) {
      const k = SLOTS.findIndex((_, i) => okWith(d, i, minH));
      if (k >= 0) return { day: d, slot: k };
    }
    return { day: f.day, slot: -1 };
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(first.day);
  const [slot, setSlot] = useState(first.slot);
  const [hours, setHours] = useState(minH);
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const picked = useRef('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [job, setJob] = useState(trabajo && cat && (jobs.includes(trabajo) || trabajo === OTHER) ? trabajo : '');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('tarjeta');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sugerencias de dirección mientras se escribe.
  useEffect(() => {
    const t = address.trim();
    if (t.length < 3 || t === picked.current) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    const tm = setTimeout(() => searchPlaces(t, ctrl.signal).then(setSuggestions).catch(() => {}), 350);
    return () => { clearTimeout(tm); ctrl.abort(); };
  }, [address]);

  const check = slot >= 0 ? checkSlot({ category: pro.category, date: isoAt(day), slot: SLOTS[slot], hours, pro }) : null;
  const canAddHour = slot >= 0 && hours < 8 && okWith(day, slot, hours + 1);
  const [ack, setAck] = useState(false);
  const warnKey = check?.warnings.join('|') ?? '';
  useEffect(() => { setAck(false); }, [warnKey]);

  if (!pro || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>No encontramos este profesional.</Body>
      </SafeAreaView>
    );
  }

  const q = quote(pro.hourlyRate, hours, price.visit);

  const pickDay = (i: number) => {
    setDay(i);
    if (slot < 0 || !okWith(i, slot, hours)) setSlot(SLOTS.findIndex((_, k) => okWith(i, k, hours)));
  };


  const onConfirm = async () => {
    if (sending) return;
    if (check && !check.ok) { setError(check.reason ?? 'Ese horario no está disponible.'); return; }
    if (check && check.warnings.length && !ack) { setError('Lee el aviso sobre el horario y marca que lo entiendes.'); return; }
    if (slot < 0 || !slotAvailable(day, slot, new Date())) {
      setError('Esa hora ya no está disponible. Elige otra hora de llegada.');
      return;
    }
    if (!job) {
      setError('Elige qué trabajo necesitas (o "Otro trabajo").');
      return;
    }
    if (job === OTHER && notes.trim().length < 10) {
      setError('Describe el trabajo que necesitas (al menos 10 caracteres).');
      return;
    }
    if (address.trim().length < 8) {
      setError('Escribe la dirección completa para que el profesional pueda llegar.');
      return;
    }
    if (!agreed) {
      setAgreeError(true);
      return;
    }
    setSending(true);
    setSaveError('');
    try {
      const { saveBooking, dateInDays } = await import('@hulul/shared/firebase');
      const bookingId = await saveBooking({
        source: 'app',
        clientId: uid,
        professionalId: pro.id,
        professionalName: pro.name,
        category: pro.category,
        date: dateInDays(day),
        slot: SLOTS[slot],
        hours,
        address: address.trim(),
        location: location ?? undefined,
        notes: [job === OTHER ? '' : job, notes.trim()].filter(Boolean).join('. ').slice(0, 1000),
        contactName: profile.name,
        contactPhone: profile.phone,
        contactEmail: profile.email,
        paymentMethod: payment,
        subtotal: q.subtotal,
        fee: q.fee,
        iva: q.iva,
        total: q.total,
        consentMarketing: profile.consentMarketing,
        demo: true,
      });
      confirm({ professionalId: pro.id, professionalName: pro.name, category: pro.category, dayIndex: day, slotIndex: slot, hours, address, notes: job, payment, total: q.total, bookingId });
      router.replace('/confirmada');
    } catch {
      setSaveError('No pudimos registrar tu reserva. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BackButton />
            <View>
              <Text style={s.title}>Reservar</Text>
              <Body muted style={{ fontSize: 13 }}>{pro.name} · ${pro.hourlyRate}/hora</Body>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={s.label}>Día · desliza para ver más</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d, i) => {
                const on = i === day;
                const off = !dayAvailable(i, now) || !SLOTS.some((_, k) => okWith(i, k, hours));
                return (
                  <Pressable key={i} disabled={off} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={d.long} onPress={() => pickDay(i)} style={[s.day, on && s.on, off && s.off]}>
                    <Text style={[s.dayMonth, on && s.onText]}>{d.month}</Text>
                    <Text style={[s.dayTop, on && s.onText]}>{d.top}</Text>
                    <Text style={[s.dayNum, on && s.onText]}>{d.num}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={s.label}>Hora de llegada</Text>
            <View style={s.slots}>
              {SLOTS.map((t, i) => {
                const on = i === slot;
                const off = !okWith(day, i, hours);
                return (
                  <Pressable key={t} disabled={off} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }} onPress={() => setSlot(i)} style={[s.slot, on && s.on, off && s.off]}>
                    <Text style={[s.slotText, on && s.onText, off && { textDecorationLine: 'line-through' }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.hoursBox}>
            <View style={{ flex: 1 }}>
              <Text style={s.hoursTitle}>Horas de servicio</Text>
              <Body muted style={{ fontSize: 12.5 }}>Mínimo {minH} h · puedes ampliar durante el servicio</Body>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Quitar una hora" disabled={hours <= minH} onPress={() => setHours((h) => Math.max(minH, h - 1))} style={s.stepper}>
                <Text style={s.stepperText}>−</Text>
              </Pressable>
              <Text style={s.hoursValue}>{hours}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Añadir una hora" disabled={!canAddHour} onPress={() => setHours((h) => Math.min(8, h + 1))} style={[s.stepper, !canAddHour && { opacity: 0.4 }]}>
                <Text style={s.stepperText}>+</Text>
              </Pressable>
            </View>
          </View>
          {check ? (
            <Body muted style={{ fontSize: 13 }}>
              {check.ok ? `Llega a las ${SLOTS[slot]} y termina aprox. a las ${check.end}.` : check.reason}
            </Body>
          ) : <Body style={{ fontSize: 13, color: c.primary }}>No quedan horas disponibles ese día. Elige otro día.</Body>}
          {check?.ok && check.warnings.length > 0 && (
            <View style={s.warn}>
              {check.warnings.map((w) => <Body key={w} style={{ fontSize: 13 }}>⚠️ {w}</Body>)}
              <Checkbox checked={ack} onChange={(v) => { setAck(v); setError(''); }}>
                <Body style={{ fontSize: 13 }}>Entiendo y reservo bajo mi responsabilidad.</Body>
              </Checkbox>
            </View>
          )}

          <View style={{ gap: 10 }}>
            <Text style={s.label}>¿Qué trabajo necesitas?</Text>
            <View style={s.tags}>
              {[...jobs, OTHER].map((t) => {
                const on = job === t;
                return (
                  <Pressable key={t} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { setJob(t); setError(''); }} style={[s.tag, on && s.tagOn]}>
                    <Text style={[s.tagText, on && { color: c.success }]}>{on ? '✓ ' : ''}{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.label} nativeID="dir-label">Dirección y referencia</Text>
            <TextInput
              value={address}
              onChangeText={(t) => { setAddress(t); setError(''); }}
              placeholder="Escribe tu urbanización o calle"
              maxLength={300}
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="dir-label"
              style={s.input}
            />
            {suggestions.length > 0 && (
              <View style={s.suggest}>
                {suggestions.map((p) => (
                  <Pressable key={p.label + p.detail} accessibilityRole="button" style={s.suggestRow} onPress={() => {
                    const text = [p.label, p.detail.split(',')[0]].filter(Boolean).join(', ');
                    picked.current = text + ', ';
                    setAddress(text + ', ');
                    setLocation(p.p);
                    setSuggestions([]);
                  }}>
                    <Icon name="pin" size={16} color={c.copper} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.suggestTitle}>{p.label}</Text>
                      {p.detail ? <Body muted style={{ fontSize: 12.5 }}>{p.detail}</Body> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            <Body muted style={{ fontSize: 12.5 }}>Elige tu urbanización o calle y completa con manzana y villa.</Body>
            <Pressable accessibilityRole="button" onPress={() => setMapOpen(true)} style={[s.mapBtn, location && s.mapBtnOn]}>
              <Icon name="pin" size={20} color={location ? c.success : c.primary} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={s.mapTitle}>{location ? 'Ubicación marcada' : 'Marcar en el mapa'}</Text>
                <Body muted style={{ fontSize: 12.5 }}>{location ? 'Toca para revisar el punto exacto' : 'Así el profesional llega directo, sin perderse'}</Body>
              </View>
              <Icon name="chevronRight" size={18} color={c.textMuted} />
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.label} nativeID="notes-label">{job === OTHER ? 'Describe el trabajo' : 'Detalles (opcional)'}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={job === OTHER ? 'Cuéntanos qué necesitas' : 'Ej.: 2 splits de 12.000 BTU, uno gotea agua'}
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="notes-label"
              multiline
              maxLength={NOTES_MAX}
              style={[s.input, { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }]}
            />
            <Body muted style={{ fontSize: 12.5, textAlign: 'right', color: notes.length >= NOTES_MAX ? c.primary : c.textMuted }}>{notes.length}/{NOTES_MAX}</Body>
            {error ? <Text style={s.error}>{error}</Text> : null}
          </View>

          <View style={s.contact}>
            <View style={{ flex: 1 }}>
              <Text style={s.mapTitle}>{profile.name}</Text>
              <Body muted style={{ fontSize: 12.5 }}>{profile.phone} · {profile.email}</Body>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/cuenta')}><Text style={s.link}>Mi cuenta</Text></Pressable>
          </View>

          <View style={{ gap: 10 }}>
            <H2 style={{ fontSize: 14, fontFamily: font.bodyBold, color: c.textSecondary }}>Forma de pago</H2>
            {PAYMENT_OPTIONS.map((m) => {
              const on = m.value === payment;
              return (
                <Pressable key={m.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setPayment(m.value)} style={[s.pay, on && { borderColor: c.copper }]}>
                  <Text style={s.payText}>{m.label}</Text>
                  <View style={[s.radio, on && s.radioOn]} />
                </Pressable>
              );
            })}
          </View>

          <MapPicker visible={mapOpen} initial={location} onClose={() => setMapOpen(false)} onConfirm={(p) => { setLocation(p); setMapOpen(false); }} />

          <View style={s.summary}>
            {q.visit > 0 && <Row label="Visita técnica (traslado y diagnóstico)" value={formatUSD(q.visit)} />}
            <Row label={`${hours} h × $${pro.hourlyRate}`} value={formatUSD(q.labor)} />
            <Row label="Cargo de plataforma HULUL" value={formatUSD(q.fee)} />
            <Row label="IVA 15%" value={formatUSD(q.iva)} />
            <View style={s.totalRow}>
              <Text style={s.totalText}>Total</Text>
              <Text style={s.totalText}>{formatUSD(q.total)}</Text>
            </View>
            <Body muted style={{ fontSize: 12.5 }}>Materiales y repuestos aparte: el profesional te los cotiza en la app. Todo trabajo extra se agrega en la app para que tenga garantía.</Body>
            <Body style={{ fontSize: 12.5, color: c.copper }}>Versión de prueba: no se pide la tarjeta ni se cobra nada.</Body>
          </View>

          <View style={{ gap: 6 }}>
            <Checkbox checked={agreed} onChange={(v) => { setAgreed(v); setAgreeError(false); }}>
              <Body style={{ fontSize: 13.5 }}>
                Acepto que HULUL comparta mi nombre, la dirección y la descripción del trabajo con {pro.name} para realizar este servicio, según la{' '}
                <Link href="/privacidad" style={s.link}>Política de privacidad</Link>.
              </Body>
            </Checkbox>
            {agreeError && <Text style={s.error}>Marca la casilla para confirmar la reserva.</Text>}
          </View>
        </ScrollView>

        <View style={s.footer}>
          {saveError ? <Text style={[s.error, { marginBottom: 8 }]}>{saveError}</Text> : null}
          <PrimaryButton label={sending ? 'Registrando tu reserva…' : `Confirmar reserva de prueba · ${formatUSD(q.total)}`} onPress={onConfirm} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Body style={{ flex: 1 }}>{label}</Body>
      <Body>{value}</Body>
    </View>
  );
}

const s = StyleSheet.create({
  warn: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: c.copperSoft, borderLeftWidth: 4, borderLeftColor: c.primary },
  content: { padding: 20, paddingBottom: 32, gap: 22 },
  title: { fontFamily: font.display, fontSize: 18, color: c.text },
  label: { fontFamily: font.bodyBold, fontSize: 14, color: c.textSecondary },
  day: { minWidth: 58, height: 78, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayMonth: { fontFamily: font.bodyBold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: c.copper, minHeight: 12 },
  dayTop: { fontFamily: font.bodySemi, fontSize: 12, color: c.text },
  dayNum: { fontFamily: font.display, fontSize: 18, color: c.text },
  on: { backgroundColor: c.text, borderColor: c.text },
  onText: { color: c.onPrimary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '23%', flexGrow: 1, height: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.38 },
  slotText: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  hoursBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  hoursTitle: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
  hoursValue: { fontFamily: font.display, fontSize: 20, minWidth: 22, textAlign: 'center', color: c.text },
  stepper: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' },
  stepperText: { fontSize: 20, color: c.text },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, fontFamily: font.body, fontSize: 14.5, color: c.text },
  error: { fontFamily: font.bodySemi, fontSize: 13, color: c.primary },
  link: { color: c.primary, fontFamily: font.bodyBold, textDecorationLine: 'underline' },
  pay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: 16, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  payText: { fontFamily: font.bodySemi, fontSize: 14, color: c.text },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#A39C95' },
  radioOn: { borderWidth: 5, borderColor: c.copper },
  summary: { gap: 8, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
  totalText: { fontFamily: font.bodyBold, fontSize: 16, color: c.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  tagOn: { backgroundColor: c.successSoft, borderColor: c.success },
  tagText: { fontFamily: font.bodySemi, fontSize: 13.5, color: c.text },
  suggest: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface, padding: 4 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  suggestTitle: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.surface },
  mapBtnOn: { borderStyle: 'solid', borderColor: c.success },
  mapTitle: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background },
});
