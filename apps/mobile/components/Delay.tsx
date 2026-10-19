import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DELAY_OPTIONS, delayAction, type Delay } from '@hulul/shared/firebase';
import { Body, PrimaryButton } from '@/components/ui';
import { c, font, radius } from '@/theme';

const plus = (slot: string, min: number) => {
  const [h, m] = slot.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const errText = (e: unknown) => (e as { message?: string }).message || 'No se pudo guardar.';

/** Profesional: avisar que llegará tarde (el cliente acepta o cancela sin costo). */
export function DelayPro({ id, slot, delay, client }: { id: string; slot: string; delay?: Delay; client: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (delay?.status === 'propuesto') return <View style={s.box}><Body style={{ fontSize: 13.5 }}>⏱ Avisaste {delay.added ?? delay.minutes} min de retraso. Esperando que {client} acepte.</Body></View>;
  return (
    <View style={{ gap: 8 }}>
      {delay?.status === 'aceptado' && <View style={s.box}><Body style={{ fontSize: 13.5 }}>⏱ {client} aceptó: te espera a las {plus(slot, delay.minutes)}. Si llegas más tarde, es falta.</Body></View>}
      {!open ? (
        <Pressable onPress={() => setOpen(true)}><Text style={s.link}>Avisar que llegaré tarde</Text></Pressable>
      ) : (
        <View style={[s.box, { gap: 10 }]}>
          <Text style={s.title}>¿Cuántos minutos tarde?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DELAY_OPTIONS.map((m) => (
              <Pressable key={m} disabled={busy} onPress={async () => {
                setBusy(true); setMsg('');
                try { await delayAction({ id, action: 'proponer', minutes: m }); setOpen(false); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
              }} style={s.chip}><Text style={s.chipText}>+{m} min</Text></Pressable>
            ))}
          </View>
          <Body muted style={{ fontSize: 12.5 }}>{client} decide: si acepta, la cita se corre; si no puede esperar, se cancela sin costo para él y es una falta para ti. Si no avisas y llegas tarde, no podrás cobrar "cliente ausente".</Body>
          {msg ? <Body style={{ color: c.primary, fontSize: 13 }}>{msg}</Body> : null}
          <Pressable onPress={() => setOpen(false)}><Text style={s.link}>Volver</Text></Pressable>
        </View>
      )}
    </View>
  );
}

/** Cliente: aceptar o rechazar el retraso que avisó el profesional. */
export function DelayClient({ id, slot, delay, pro }: { id: string; slot: string; delay?: Delay; pro: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!delay || delay.status === 'rechazado') return null;
  if (delay.status === 'aceptado') return <Body muted style={{ fontSize: 13.5 }}>⏱ Aceptaste que {pro} llegue a las {plus(slot, delay.minutes)}.</Body>;
  const act = async (action: 'aceptar' | 'rechazar') => {
    if (busy) return;
    setBusy(true); setMsg('');
    try { await delayAction({ id, action }); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };
  return (
    <View style={[s.box, { gap: 10, borderLeftWidth: 4, borderLeftColor: c.primary }]} accessibilityRole="alert">
      <Text style={s.title}>⏱ {pro} llegará {delay.added ?? delay.minutes} min tarde (aprox. {plus(slot, delay.minutes)})</Text>
      <Body style={{ fontSize: 13.5 }}>Si aceptas, la cita se corre a esa hora y después ya no podrás cancelar gratis por el retraso. Si no puedes esperar, cancela ahora sin costo.</Body>
      {msg ? <Body style={{ color: c.primary, fontSize: 13 }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Guardando…' : 'Acepto, lo espero'} onPress={() => act('aceptar')} />
      <Pressable onPress={() => act('rechazar')}><Text style={[s.link, { textAlign: 'center' }]}>No puedo esperar: cancelar sin costo</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: 12, borderRadius: radius.md, backgroundColor: c.copperSoft },
  title: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipText: { fontFamily: font.bodyBold, fontSize: 13.5, color: c.text },
});
