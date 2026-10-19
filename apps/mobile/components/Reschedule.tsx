import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SLOTS } from '@hulul/shared';
import { reschedule, type Proposal, type RescheduleAction } from '@hulul/shared/firebase';
import { Body, PrimaryButton } from '@/components/ui';
import { c, font, radius } from '@/theme';

const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MO[m - 1]}`;
}

/** Proponer otra fecha u hora, o responder la propuesta de la otra parte. */
export function Reschedule({ id, date, slot, proposal, me, other }: {
  id: string; date: string; slot: string; proposal?: Proposal; me: 'cliente' | 'profesional'; other: string;
}) {
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(Date.now() - 5 * 3_600_000 + i * 86_400_000).toISOString().slice(0, 10)), []);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(date);
  const [sl, setSl] = useState(slot);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async (a: RescheduleAction) => {
    setBusy(true); setMsg('');
    try { await reschedule(id, a, a === 'proponer' ? d : undefined, a === 'proponer' ? sl : undefined); setOpen(false); }
    catch (e) { setMsg((e as { message?: string }).message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  const p = proposal;
  if (p) {
    const mine = p.by === me;
    return (
      <View style={s.box}>
        <Text style={s.title}>{mine ? 'Propusiste cambiar la hora' : `${other} propone cambiar la hora`}</Text>
        <Body style={{ fontSize: 14 }}>De {shortDay(date)} {slot} → {shortDay(p.date)} {p.slot}.{mine ? ` Esperando la respuesta de ${other}.` : ''}</Body>
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
      <Text style={s.title}>Proponer otra fecha u hora</Text>
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

const s = StyleSheet.create({
  box: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.surfaceWarm },
  title: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
  err: { fontFamily: font.bodySemi, fontSize: 13, color: c.primary },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipOn: { backgroundColor: c.text, borderColor: c.text },
  chipText: { fontFamily: font.bodySemi, fontSize: 13, color: c.text },
});
