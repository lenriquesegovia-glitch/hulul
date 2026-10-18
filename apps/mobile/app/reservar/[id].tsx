import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Checkbox } from '@/components/Checkbox';
import { BOOKING_DAYS, categoryPricing, dayAvailable, firstAvailable, formatUSD, getProfessional, quote, slotAvailable, type PaymentMethod } from '@hulul/shared';
import { BackButton, Body, H2, PrimaryButton } from '@/components/ui';
import { nextDays, PAYMENT_OPTIONS, SLOTS, useBooking } from '@/lib/booking';
import { c, font, radius } from '@/theme';

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pro = getProfessional(id);
  const { confirm } = useBooking();

  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => nextDays(BOOKING_DAYS, now), [now]);
  const first = useMemo(() => firstAvailable(now), [now]);
  const [day, setDay] = useState(first.day);
  const [slot, setSlot] = useState(first.slot);
  // Arranca en el mínimo del profesional (al menos 2 h) y no baja de ese mínimo.
  // Horas mínimas y cargo de visita: los fija HULUL por categoría.
  const price = pro ? categoryPricing(pro.category) : { hours: 1, visit: 0, rate: 0 };
  const minH = Math.max(1, price.hours);
  const [hours, setHours] = useState(minH);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('tarjeta');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactError, setContactError] = useState('');
  const [sending, setSending] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (!pro) {
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
    if (!slotAvailable(i, slot, now)) setSlot(SLOTS.findIndex((_, k) => slotAvailable(i, k, now)));
  };

  const onConfirm = async () => {
    if (sending) return;
    if (slot < 0 || !slotAvailable(day, slot, new Date())) {
      setError('Esa hora ya no está disponible. Elige otra hora de llegada.');
      return;
    }
    if (address.trim().length < 8) {
      setError('Escribe la dirección completa para que el profesional pueda llegar.');
      return;
    }
    if (name.trim().length < 2 || !/^0?9\d{8}$/.test(phone.replace(/\s/g, ''))) {
      setContactError('Escribe tu nombre y un celular válido (09XXXXXXXX).');
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
        professionalId: pro.id,
        professionalName: pro.name,
        category: pro.category,
        date: dateInDays(day),
        slot: SLOTS[slot],
        hours,
        address: address.trim(),
        notes: notes.trim(),
        contactName: name.trim(),
        contactPhone: phone.replace(/\s/g, ''),
        contactEmail: '',
        paymentMethod: payment,
        subtotal: q.subtotal,
        fee: q.fee,
        iva: q.iva,
        total: q.total,
        consentMarketing: false,
        demo: true,
      });
      confirm({ professionalId: pro.id, dayIndex: day, slotIndex: slot, hours, address, notes, payment, total: q.total, bookingId });
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
                const off = !dayAvailable(i, now);
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
                const off = !slotAvailable(day, i, now);
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
              <Pressable accessibilityRole="button" accessibilityLabel="Añadir una hora" onPress={() => setHours((h) => Math.min(8, h + 1))} style={s.stepper}>
                <Text style={s.stepperText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.label} nativeID="dir-label">Dirección</Text>
            <TextInput
              value={address}
              onChangeText={(t) => { setAddress(t); setError(''); }}
              placeholder="Urbanización, manzana y villa"
              maxLength={300}
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="dir-label"
              style={s.input}
            />
            {error ? <Text style={s.error}>{error}</Text> : null}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.label} nativeID="notes-label">Describe lo que necesitas</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Ej.: 2 splits de 12.000 BTU, uno gotea agua"
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="notes-label"
              multiline
              maxLength={1000}
              style={[s.input, { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }]}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.label} nativeID="name-label">Tu nombre</Text>
            <TextInput
              value={name}
              onChangeText={(t) => { setName(t); setContactError(''); }}
              placeholder="Nombre y apellido"
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="name-label"
              autoComplete="name"
              maxLength={120}
              style={s.input}
            />
            <Text style={s.label} nativeID="phone-label">Celular (WhatsApp)</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => { setPhone(t); setContactError(''); }}
              placeholder="09XXXXXXXX"
              placeholderTextColor={c.textMuted}
              accessibilityLabelledBy="phone-label"
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={13}
              style={s.input}
            />
            {contactError ? <Text style={s.error}>{contactError}</Text> : null}
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

          <View style={s.summary}>
            {q.visit > 0 && <Row label="Visita técnica (traslado y diagnóstico)" value={formatUSD(q.visit)} />}
            <Row label={`${hours} h × $${pro.hourlyRate}`} value={formatUSD(q.labor)} />
            <Row label="Cargo de plataforma HULUL" value={formatUSD(q.fee)} />
            <Row label="IVA 15%" value={formatUSD(q.iva)} />
            <View style={s.totalRow}>
              <Text style={s.totalText}>Total</Text>
              <Text style={s.totalText}>{formatUSD(q.total)}</Text>
            </View>
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
          <PrimaryButton label={sending ? 'Registrando tu reserva…' : `Confirmar y pagar ${formatUSD(q.total)}`} onPress={onConfirm} />
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
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background },
});
