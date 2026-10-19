import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RESCHEDULE_HOURS, RESCHEDULE_MINUTES } from '@hulul/shared';
import { reschedule, type Proposal, type RescheduleAction } from '@hulul/shared/firebase';
import { Body, Button } from '@/components/ui';
import { Stepper } from '@/components/Stepper';
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
          ? <Button variant="secondary" label="Retirar propuesta" disabled={busy} onPress={() => run('retirar')} />
          : <>
              <Button label={busy ? 'Guardando…' : 'Aceptar nueva hora'} disabled={busy} onPress={() => run('aceptar')} />
              <Button variant="secondary" label="Mantener la hora original" disabled={busy} onPress={() => run('rechazar')} />
            </>}
      </View>
    );
  }
  if (!open) return <Button variant="secondary" label="Cambiar fecha u hora" onPress={() => setOpen(true)} />;
  const di = Math.max(0, days.indexOf(d));
  const hi = Math.max(0, RESCHEDULE_HOURS.indexOf(sl.slice(0, 2)));
  const mi = Math.max(0, RESCHEDULE_MINUTES.indexOf(sl.slice(3, 5)));
  const setH = (i: number) => setSl(`${RESCHEDULE_HOURS[i]}:${RESCHEDULE_MINUTES[mi]}`);
  const setM = (i: number) => setSl(`${RESCHEDULE_HOURS[hi]}:${RESCHEDULE_MINUTES[i]}`);
  return (
    <View style={s.box}>
      <Text style={s.title}>Proponer otra fecha u hora</Text>
      <Body muted style={{ fontSize: 13 }}>Puedes adelantar o atrasar. {other} debe aceptar.</Body>
      <Stepper label="Día" value={di === 0 ? 'Hoy' : di === 1 ? 'Mañana' : shortDay(days[di])}
        onMinus={() => setD(days[di - 1])} onPlus={() => setD(days[di + 1])} canMinus={di > 0} canPlus={di < days.length - 1} minusLabel="Día anterior" plusLabel="Día siguiente" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stepper label="Hora" value={RESCHEDULE_HOURS[hi]} onMinus={() => setH(hi - 1)} onPlus={() => setH(hi + 1)}
          canMinus={hi > 0} canPlus={hi < RESCHEDULE_HOURS.length - 1} minusLabel="Hora anterior" plusLabel="Hora siguiente" />
        <Stepper label="Minutos" value={`:${RESCHEDULE_MINUTES[mi]}`} onMinus={() => setM(mi - 1)} onPlus={() => setM(mi + 1)}
          canMinus={mi > 0} canPlus={mi < RESCHEDULE_MINUTES.length - 1} minusLabel="Menos minutos" plusLabel="Más minutos" />
      </View>
      <Body style={{ fontSize: 14, textAlign: 'center' }}>Nueva hora: <Text style={{ fontFamily: font.bodyBold }}>{shortDay(d)} · {sl}</Text></Body>
      {msg ? <Text style={s.err}>{msg}</Text> : null}
      <Button label={busy ? 'Enviando…' : 'Enviar propuesta'} disabled={busy || (d === date && sl === slot)} onPress={() => run('proponer')} />
      <Button variant="secondary" label="Volver" onPress={() => setOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.surfaceWarm },
  title: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
  err: { fontFamily: font.bodySemi, fontSize: 13, color: c.primary },
});
