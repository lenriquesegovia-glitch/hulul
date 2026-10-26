import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { photosAvailable, pickPhotos, uploadLocalPhotos } from '@/lib/photos';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { CalendarPicker } from '@/components/CalendarPicker';
import { Checkbox } from '@/components/Checkbox';
import { ClientGate } from '@/components/ClientGate';
import { Icon } from '@/components/Icon';
import { MapPicker } from '@/components/MapPicker';
import type { ClientProfile } from '@hulul/shared/firebase';
import { serviceCopy, HOME_SAFETY_ACCEPT, BOOKING_DAYS, checkSlot, leadMinutes, slotInWindow, surchargeFor, isOffHour, SURCHARGE_LABEL, HOME_SAFETY_NOTICE, HOME_SAFETY_TITLE, visitHours, visitLabel, getCategory, searchPlaces, type LatLng, type PlaceSuggestion, dayAvailable, firstAvailable, formatUSD, quoteVisit, type Professional, slotAvailable, TEST_SLOTS, testPeriodOpen, timeAvailable, MAX_REQUEST_PHOTOS, type PaymentMethod } from '@hulul/shared';
import { BackButton, Body, H2, PrimaryButton } from '@/components/ui';
import { nextDays, PAYMENT_OPTIONS, SLOTS, useBooking } from '@/lib/booking';
import { c, font, radius } from '@/theme';
import { ActivityIndicator } from 'react-native';
import { usePro } from '@/lib/pros';
import { KeyboardScroll } from '@/components/KeyboardScroll';

const OTHER = 'Otro';
const NOTES_MAX = 940;

/** Para reservar hay que tener cuenta (como Uber). */
export default function BookingScreen() {
  return (
    <ClientGate screen title="Crea tu cuenta para reservar" lead="Así sigues tu servicio, recibes la confirmación y el resumen de cada servicio.">
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
  const copy = serviceCopy(pro.category);
  const jobs = useMemo(() => {
    const own = pro.services ?? [];
    return cat ? [...own, ...cat.servicios.filter((x) => !own.includes(x))] : own;
  }, [pro.services, cat]);
  const { confirm } = useBooking();

  const now = useMemo(() => new Date(), []);
  // Modo prueba: solo profesionales marcados (providers/{uid}.tester) y solo durante el periodo de prueba.
  const tester = !!pro.tester && testPeriodOpen();
  const slots = tester ? TEST_SLOTS : SLOTS;
  const days = useMemo(() => nextDays(BOOKING_DAYS, now), [now]);
  // Se paga por visita. La duración estimada solo sirve para validar el horario.
  const minH = visitHours(pro.category);
  const hours = minH;
  /** Fecha AAAA-MM-DD de dentro de `d` días. */
  const isoAt = (d: number) => { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  /** Anticipación + horario de la categoría + horario del profesional. */
  const lead = leadMinutes(pro.category);
  const okWith = (d: number, k: number, h: number) => tester ? timeAvailable(d, slots[k], now, 0) : slotAvailable(d, k, now, lead) && checkSlot({ category: pro.category, date: isoAt(d), slot: slots[k], hours: h, pro }).ok;
  const first = useMemo(() => {
    const f = tester ? { day: 0, slot: 0 } : firstAvailable(now, lead);
    for (let d = f.day; d < BOOKING_DAYS; d++) {
      const k = slots.findIndex((_, i) => okWith(d, i, minH));
      if (k >= 0) return { day: d, slot: k };
    }
    return { day: f.day, slot: -1 };
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const [day, setDay] = useState(first.day);
  const [slot, setSlot] = useState(first.slot);
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const picked = useRef('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const dayRow = useRef<ScrollView>(null);
  const [job, setJob] = useState(trabajo && cat && (jobs.includes(trabajo) || trabajo === OTHER) ? trabajo : '');
  // Si ya lo eligió en la categoría, no se vuelve a preguntar (se puede cambiar).
  const [pickJob, setPickJob] = useState(!job);
  const [notes, setNotes] = useState('');
  // Fotos opcionales del problema (rutas locales; se suben al confirmar).
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoMsg, setPhotoMsg] = useState('');
  const addPhotos = async (from: 'camara' | 'galeria') => {
    setPhotoMsg('');
    try {
      const got = await pickPhotos(from, MAX_REQUEST_PHOTOS - photos.length);
      setPhotos((p) => [...p, ...got].slice(0, MAX_REQUEST_PHOTOS));
    } catch (e) {
      setPhotoMsg((e as { code?: string }).code === 'sin-permiso-camara' ? 'Permite la cámara en los ajustes del celular para tomar fotos.' : 'No se pudo abrir la cámara o la galería.');
    }
  };
  const [payment, setPayment] = useState<PaymentMethod>('tarjeta');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [safety, setSafety] = useState(false);
  const [safetyError, setSafetyError] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sugerencias de dirección mientras se escribe.
  useEffect(() => {
    const t = address.trim();
    // Recién elegida una sugerencia: no se vuelve a buscar (ni reaparece la lista).
    if (t.length < 3 || t === picked.current.trim()) { setSuggestions([]); setSearching(false); return; }
    const ctrl = new AbortController();
    const tm = setTimeout(() => {
      setSearching(true);
      searchPlaces(t, ctrl.signal).then(setSuggestions).catch(() => {}).finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(tm); ctrl.abort(); };
  }, [address]);

  const check = !tester && slot >= 0 ? checkSlot({ category: pro.category, date: isoAt(day), slot: slots[slot], hours, pro }) : null;
  const [ack, setAck] = useState(false);
  const warnKey = check?.warnings.join('|') ?? '';
  useEffect(() => { setAck(false); }, [warnKey]);

  // Disponibilidad de los 30 días y de las horas del día elegido: se calcula una
  // vez, no en cada letra que se escribe en la dirección o la descripción.
  const offDays = useMemo(
    () => days.map((_, i) => (!tester && !dayAvailable(i, now, lead)) || !slots.some((_, k) => okWith(i, k, hours))),
    [days, now, tester, lead, hours, pro], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const slotOk = useMemo(
    () => slots.map((_, k) => okWith(day, k, hours)),
    [day, now, tester, lead, hours, pro], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!pro || !cat) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
        <BackButton />
        <Body>No encontramos este profesional.</Body>
      </SafeAreaView>
    );
  }

  // Recargo nocturno o de feriado del profesional (monto fijo), si aplica.
  const sc = !tester && slot >= 0 ? surchargeFor(isoAt(day), slots[slot], pro) : { kind: null, amount: 0 };
  const q = quoteVisit(pro.visitRate, sc.amount, pro.taxRegime);

  /** Día sin horas libres (por anticipación, horario del servicio o del profesional). */
  const dayOff = (i: number) => offDays[i] ?? true;
  const pickDay = (i: number) => {
    setDay(i);
    // Lleva el día elegido a la vista en la fila de días (58 de ancho + 8 de separación).
    dayRow.current?.scrollTo({ x: Math.max(0, i * 66 - 120), animated: true });
    if (slot < 0 || !okWith(i, slot, hours)) setSlot(slots.findIndex((_, k) => okWith(i, k, hours)));
  };


  const onConfirm = async () => {
    if (sending) return;
    if (check && !check.ok) { setError(check.reason ?? 'Ese horario no está disponible.'); return; }
    if (check && check.warnings.length && !ack) { setError('Lee el aviso sobre el horario y marca que lo entiendes.'); return; }
    if (slot < 0 || (tester ? !timeAvailable(day, slots[slot], new Date(), 0) : !slotAvailable(day, slot, new Date(), lead))) {
      setError('Esa hora ya no está disponible. Elige otra hora de llegada.');
      return;
    }
    if (!job) {
      setError('Elige qué necesitas.');
      return;
    }
    if (job === OTHER && notes.trim().length < 10) {
      setError('Cuéntanos qué necesitas (al menos 10 caracteres).');
      return;
    }
    if (address.trim().length < 8) {
      setError('Escribe la dirección completa para que el profesional pueda llegar.');
      return;
    }
    if (!safety) {
      setSafetyError(true);
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
      const photoUrls = photos.length ? await uploadLocalPhotos(`solicitudes/${uid}/${Date.now().toString(36)}`, photos) : [];
      const bookingId = await saveBooking({
        source: 'app',
        clientId: uid,
        professionalId: pro.id,
        professionalName: pro.name,
        category: pro.category,
        date: dateInDays(day),
        slot: slots[slot],
        hours,
        pricing: 'visita',
        pricingVersion: 2,
        visit: q.visit,
        ...(sc.kind ? { surcharge: q.surcharge, surchargeKind: sc.kind } : {}),
        ...(check?.noisy ? { noiseAccepted: true as const } : {}),
        safetyAccepted: true,
        address: address.trim(),
        location: location ?? undefined,
        notes: [tester ? '[PRUEBA]' : '', job === OTHER ? '' : job, notes.trim()].filter(Boolean).join('. ').slice(0, 1000),
        ...(photoUrls.length ? { photos: photoUrls } : {}),
        contactName: profile.name,
        contactPhone: profile.phone,
        contactEmail: profile.email,
        paymentMethod: payment,
        subtotal: q.subtotal,
        fee: q.fee,
        iva: q.iva,
        total: q.total,
        // Régimen del profesional al reservar: define el IVA de la visita y las facturas.
        taxRegime: q.regime,
        visitIva: q.proInvoice.iva,
        consentMarketing: profile.consentMarketing,
        demo: true,
      });
      confirm({ professionalId: pro.id, professionalName: pro.name, category: pro.category, dayIndex: day, slotIndex: slot, slotTime: slots[slot], hours, address, notes: job, payment, total: q.total, bookingId });
      router.replace('/confirmada');
    } catch {
      setSaveError('No pudimos registrar tu reserva. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <KeyboardScroll contentContainerStyle={s.content}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BackButton />
            <View>
              <Text style={s.title}>Reservar</Text>
              <Body muted style={{ fontSize: 13 }}>{pro.name} · {visitLabel(pro.visitRate)}</Body>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text style={s.label}>Día · desliza para ver más</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver calendario" onPress={() => setCalOpen(true)} style={s.calBtn} hitSlop={8}>
                <Icon name="calendar" size={18} color={c.primary} strokeWidth={2} />
                <Text style={s.calText}>Ver calendario</Text>
              </Pressable>
            </View>
            <ScrollView ref={dayRow} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {days.map((d, i) => {
                const on = i === day;
                const off = dayOff(i);
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
            {tester && <Body style={{ fontSize: 12.5, color: c.copper }}>Modo prueba: cualquier hora, sin reglas de horario.</Body>}
            {!tester && <Body muted style={{fontSize:13,lineHeight:20}}>Horario de {pro.name.split(' ')[0]}: {pro.from || '08:00'}–{pro.to || '18:00'}. Puedes solicitar una hora futura sin anticipación mínima; el profesional confirma si puede atenderte. La visita dura aproximadamente {minH} h y puede terminar después del horario si acepta la solicitud. Una hora tachada no significa necesariamente que tenga una reserva.</Body>}
            <View style={s.slots}>
              {slots.map((t, i) => {
                if (!tester && !slotInWindow(pro.category, t, pro)) return null;
                const on = i === slot;
                const off = !slotOk[i];
                return (
                  <Pressable key={t} disabled={off} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }} onPress={() => setSlot(i)} style={[s.slot, on && s.on, off && s.off]}>
                    <Text style={[s.slotText, on && s.onText, off && { textDecorationLine: 'line-through' }]}>{!tester && isOffHour(t) ? `🌙 ${t}` : t}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!tester && (pro.offHours?.length ?? 0) > 0 && (
              <Body muted style={{ fontSize: 12.5 }}>🌙 Fuera de horario (antes de las 08:00 o desde las 18:00): tarifa nocturna de {formatUSD(pro.surcharges?.nocturno || pro.visitRate)}.</Body>
            )}
            {sc.kind && sc.amount > 0 && (
              <Body style={{ fontSize: 13, color: c.copper }}>{SURCHARGE_LABEL[sc.kind]}: {formatUSD(sc.amount)}. Lo fija {pro.name.split(' ')[0]} para atender {sc.kind === 'feriado' ? 'en feriado' : 'fuera de horario'}. Reemplaza la tarifa normal; no se suma.</Body>
            )}
          </View>

          {check ? (
            <Body muted style={{ fontSize: 13 }}>
              {check.ok ? `Llega a las ${slots[slot]}. Una visita de ${cat.name.toLowerCase()} suele tomar unas ${minH} h.` : check.reason}
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

          {!pickJob && job ? (
            <View style={s.chosen}>
              <View style={{ flex: 1 }}>
                <Body muted style={{ fontSize: 12.5 }}>{copy.jobQuestion}</Body>
                <Text style={s.chosenText}>{job}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setPickJob(true)} hitSlop={8}><Text style={s.chosenLink}>Cambiar</Text></Pressable>
            </View>
          ) : (
          <View style={{ gap: 10 }}>
            <Text style={s.label}>{copy.jobQuestion}</Text>
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
          )}

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
            {searching && suggestions.length === 0 && <Body muted style={{ fontSize: 12.5 }}>Buscando…</Body>}
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
            <Text style={s.label} nativeID="notes-label">{job === OTHER ? 'Cuéntanos qué necesitas' : 'Detalles (opcional)'}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={copy.detailsPlaceholder}
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="notes-label"
              multiline
              maxLength={NOTES_MAX}
              style={[s.input, { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }]}
            />
            <Body muted style={{ fontSize: 12.5, textAlign: 'right', color: notes.length >= NOTES_MAX ? c.primary : c.textMuted }}>{notes.length}/{NOTES_MAX}</Body>
            {error ? <Text style={s.error}>{error}</Text> : null}
          </View>

          {photosAvailable() && (
            <View style={{ gap: 8 }}>
              <Text style={s.label}>{copy.photosLabel}</Text>
              <Body muted style={{ fontSize: 12.5 }}>{copy.photosHelp}</Body>
              {photos.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {photos.map((u, i) => (
                    <Pressable key={u} accessibilityLabel={`Quitar foto ${i + 1}`} onPress={() => setPhotos((p) => p.filter((x) => x !== u))}>
                      <Image source={{ uri: u }} style={{ width: 76, height: 76, borderRadius: 10 }} />
                      <Text style={{ position: 'absolute', top: 2, right: 6, color: '#fff', fontFamily: font.bodyBold, fontSize: 16, textShadowColor: '#000', textShadowRadius: 3 }}>×</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {photos.length < MAX_REQUEST_PHOTOS && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable accessibilityRole="button" onPress={() => addPhotos('camara')} style={s.photoBtn}><Text style={s.photoBtnText}>📷 Tomar foto</Text></Pressable>
                  <Pressable accessibilityRole="button" onPress={() => addPhotos('galeria')} style={s.photoBtn}><Text style={s.photoBtnText}>Galería</Text></Pressable>
                </View>
              )}
              {photoMsg ? <Text style={s.error}>{photoMsg}</Text> : null}
            </View>
          )}

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

          <CalendarPicker visible={calOpen} from={now} days={BOOKING_DAYS} selected={day} isOff={dayOff} onPick={pickDay} onClose={() => setCalOpen(false)} />
          <MapPicker visible={mapOpen} initial={location} onClose={() => setMapOpen(false)} onConfirm={(p) => { setLocation(p); setMapOpen(false); }} />

          <View style={s.summary}>
            <Row label={`${pro.name.split(' ')[0]} (${copy.priceCovers})`} value={formatUSD(q.visit)} />
            {sc.kind && q.surcharge > 0 && <Row label={SURCHARGE_LABEL[sc.kind]} value={formatUSD(q.surcharge)} />}
            <Row label="Cargo de plataforma HULUL" value={formatUSD(q.fee)} />
            <Row label={q.proInvoice.iva > 0 ? 'IVA 15%' : 'IVA 15% (del cargo de plataforma)'} value={formatUSD(q.iva)} />
            <View style={s.totalRow}>
              <Text style={s.totalText}>Total</Text>
              <Text style={s.totalText}>{formatUSD(q.total)}</Text>
            </View>
            <Body muted style={{ fontSize: 12.5 }}>{copy.priceNote}</Body>
            <Body muted style={{ fontSize: 12.5 }}>Recibes dos comprobantes: la factura de {pro.name.split(' ')[0]} por la visita y la de HULUL por el cargo de plataforma.</Body>
            <Body style={{ fontSize: 12.5, color: c.copper }}>Versión de prueba: no se pide la tarjeta ni se cobra nada.</Body>
          </View>

          <View style={s.calm}>
            <Text style={s.mapTitle}>{HOME_SAFETY_TITLE}</Text>
            {HOME_SAFETY_NOTICE.map((t) => <Body key={t} style={{ fontSize: 13 }}>• {t}</Body>)}
            <Checkbox checked={safety} onChange={(v) => { setSafety(v); setSafetyError(false); }}>
              <Body style={{ fontSize: 13.5 }}>{HOME_SAFETY_ACCEPT}</Body>
            </Checkbox>
            {safetyError && <Text style={s.error}>Marca la casilla para continuar.</Text>}
          </View>

          <View style={{ gap: 6 }}>
            <Checkbox checked={agreed} onChange={(v) => { setAgreed(v); setAgreeError(false); }}>
              <Body style={{ fontSize: 13.5 }}>
                Acepto que HULUL comparta mi nombre, la dirección y la descripción del servicio con {pro.name} para realizar este servicio, según la{' '}
                <Link href="/privacidad" style={s.link}>Política de privacidad</Link>.
              </Body>
            </Checkbox>
            {agreeError && <Text style={s.error}>Marca la casilla para confirmar la reserva.</Text>}
          </View>
        </KeyboardScroll>

        <View style={s.footer}>
          {saveError ? <Text style={[s.error, { marginBottom: 8 }]}>{saveError}</Text> : null}
          <PrimaryButton label={sending ? 'Registrando tu reserva…' : `Confirmar reserva de prueba · ${formatUSD(q.total)}`} onPress={onConfirm} />
        </View>
      </View>
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
  calm: { gap: 6, padding: 14, borderRadius: radius.md, backgroundColor: c.surfaceWarm },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chosenText: { fontFamily: font.bodyBold, fontSize: 16, color: c.text },
  chosenLink: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
  photoBtn: { flex: 1, height: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  warn: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: c.copperSoft, borderLeftWidth: 4, borderLeftColor: c.primary },
  content: { padding: 20, paddingBottom: 32, gap: 22 },
  title: { fontFamily: font.display, fontSize: 18, color: c.text },
  label: { fontFamily: font.bodyBold, fontSize: 14, color: c.textSecondary },
  calBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calText: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
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
