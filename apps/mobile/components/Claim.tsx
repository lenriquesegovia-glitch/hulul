import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CLAIM_RULES, CLAIM_STATUS_LABEL, PRO_PROBLEM_OPTIONS, reportProblem, reportProblemPro, respondClaim, watchClaim, type Claim } from '@hulul/shared/firebase';
import { Body, Button, Card, PrimaryButton } from '@/components/ui';
import { photosAvailable, pickPhotos, uploadLocalPhotos } from '@/lib/photos';
import { useUser } from '@/lib/auth';
import { c, font, radius } from '@/theme';

/** Fecha y hora en Ecuador: "lun 27 oct, 15:40". */
const whenEc = (ms: number) => {
  const d = new Date(ms - 5 * 3_600_000);
  const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

function Thumbs({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <View style={s.thumbs}>
      {urls.map((u) => (
        <Pressable key={u} onPress={() => Linking.openURL(u)} accessibilityRole="imagebutton" accessibilityLabel="Ver foto">
          <Image source={{ uri: u }} style={s.thumb} />
        </Pressable>
      ))}
    </View>
  );
}

/** Fotos de respaldo: cámara o galería, se suben a reclamos/{uid}/{reserva}. */
function ClaimPhotos({ bookingId, value, onChange }: { bookingId: string; value: string[]; onChange: (v: string[]) => void }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!user || !photosAvailable()) return null;
  const full = value.length >= CLAIM_RULES.maxPhotos;
  const add = async (from: 'camara' | 'galeria') => {
    setErr('');
    try {
      const uris = await pickPhotos(from, CLAIM_RULES.maxPhotos - value.length);
      if (!uris.length) return;
      setBusy(true);
      onChange([...value, ...(await uploadLocalPhotos(`reclamos/${user.uid}/${bookingId}`, uris))]);
    } catch (e) {
      setErr((e as { message?: string }).message || 'No se pudieron subir las fotos.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Fotos de respaldo (opcional)</Text>
      <Thumbs urls={value} />
      {!full && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="secondary" label={busy ? 'Subiendo…' : '📷 Cámara'} disabled={busy} onPress={() => add('camara')} style={{ flex: 1 }} />
          <Button variant="secondary" label="Galería" disabled={busy} onPress={() => add('galeria')} style={{ flex: 1 }} />
        </View>
      )}
      {err ? <Body style={{ color: c.danger, fontSize: 12.5 }}>{err}</Body> : null}
    </View>
  );
}

/** Expediente del reclamo para el cliente o el profesional. La otra parte responde aquí. */
export function ClaimCard({ id, side }: { id: string; side: 'cliente' | 'profesional' }) {
  const [cl, setCl] = useState<Claim | null | undefined>(undefined);
  useEffect(() => watchClaim(id, setCl), [id]);
  if (cl === undefined) return null;
  if (cl === null) return <Card style={{ gap: 6 }}><Text style={s.label}>Reclamo en revisión</Text><Body muted style={{ fontSize: 13 }}>HULUL revisa lo que pasó y te avisa la decisión.</Body></Card>;
  const mine = cl.openedBy === side;
  const other = side === 'cliente' ? cl.proName.split(' ')[0] || 'el profesional' : cl.clientName.split(' ')[0] || 'el cliente';
  const iRespond = !mine && !cl.response && cl.status !== 'resuelto';
  const d = cl.decision;
  return (
    <Card style={{ gap: 10, borderColor: cl.status === 'resuelto' ? c.border : c.primary, borderWidth: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <Text style={s.label}>Reclamo {cl.code}</Text>
        <Text style={s.status}>{CLAIM_STATUS_LABEL[cl.status] ?? cl.status}</Text>
      </View>
      <Body muted style={{ fontSize: 12.5 }}>{mine ? 'Lo abriste tú' : `Lo abrió ${other}`} · {whenEc(cl.openedAt)}</Body>
      <Text style={s.label}>{cl.kindLabel}</Text>
      <Body>{cl.text}</Body>
      <Thumbs urls={cl.photos} />
      {cl.response ? (
        <View style={s.block}>
          <Body muted style={{ fontSize: 12.5 }}>{mine ? `Versión de ${other}` : 'Tu versión'} · {whenEc(cl.response.at)}</Body>
          <Body>{cl.response.text}</Body>
          <Thumbs urls={cl.response.photos} />
        </View>
      ) : iRespond ? (
        <RespondBox id={id} due={cl.responseDueAt} />
      ) : cl.status !== 'resuelto' ? (
        <Body muted style={{ fontSize: 13 }}>{cl.responseMissed ? `${other} no respondió a tiempo. HULUL decide con la información que hay.` : `Esperamos la versión de ${other} hasta el ${whenEc(cl.responseDueAt)}.`}</Body>
      ) : null}
      {d ? (
        <View style={s.block}>
          <Text style={s.label}>Decisión de HULUL: {d.outcome === 'cliente' ? 'a favor del cliente' : 'a favor del profesional'}</Text>
          <Body>{d.note}</Body>
          {side === 'cliente' && !!d.creditoCliente && <Body style={{ fontSize: 13 }}>Crédito para tu próximo servicio: ${Number(d.creditoCliente).toFixed(2)}</Body>}
          {side === 'profesional' && !!d.multaPro && <Body style={{ fontSize: 13 }}>Multa: ${Number(d.multaPro).toFixed(2)}</Body>}
          {((side === 'profesional' && d.faltaPro) || (side === 'cliente' && d.faltaCliente)) && <Body style={{ fontSize: 13 }}>Se registró una falta en tu cuenta.</Body>}
        </View>
      ) : (
        <Body muted style={{ fontSize: 12.5 }}>HULUL revisa la llegada, los timbres, el código, las fotos, el informe y el chat, y decide a más tardar el {whenEc(cl.resolveDueAt)}.{cl.moneyHeld ? ' Mientras tanto el pago queda retenido.' : ''} Tus datos solo los ve el equipo de HULUL que revisa el caso.</Body>
      )}
    </Card>
  );
}

function RespondBox({ id, due }: { id: string; due: number }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    if (busy) return;
    setMsg('');
    if (text.trim().length < 15) { setMsg('Cuéntanos tu versión (al menos 15 caracteres).'); return; }
    setBusy(true);
    try { await respondClaim({ id, text: text.trim(), photos }); } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo enviar.'); } finally { setBusy(false); }
  };
  return (
    <View style={s.block}>
      <Text style={s.label}>Tu versión</Text>
      <Body muted style={{ fontSize: 12.5 }}>Tienes hasta el {whenEc(due)}. Cuenta lo que pasó con calma y adjunta fotos si las tienes. Solo se responde una vez.</Body>
      <TextInput value={text} onChangeText={setText} maxLength={1500} multiline placeholder="Lo que pasó desde tu lado" placeholderTextColor={c.textMuted} style={s.input} />
      <ClaimPhotos bookingId={id} value={photos} onChange={setPhotos} />
      {msg ? <Body style={{ color: c.danger, fontSize: 13 }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar mi versión'} onPress={send} />
    </View>
  );
}

/** Formulario de reclamo con fotos. side = quién reclama. */
export function ReportForm({ id, side, options, title, help, onCancel }: {
  id: string; side: 'cliente' | 'profesional'; options: { value: string; label: string }[]; title: string; help: string; onCancel: () => void;
}) {
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const send = async () => {
    if (busy) return;
    setMsg('');
    if (!kind) { setMsg('Elige una opción.'); return; }
    if (text.trim().length < 15) { setMsg('Cuéntanos qué pasó (al menos 15 caracteres).'); return; }
    setBusy(true);
    try { await (side === 'cliente' ? reportProblem : reportProblemPro)({ id, kind, text: text.trim(), photos }); }
    catch (e) { setMsg((e as { message?: string }).message || 'No se pudo enviar.'); }
    finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.label}>{title}</Text>
      <Body muted style={{ fontSize: 12.5 }}>{help}</Body>
      {options.map((o) => (
        <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: kind === o.value }} onPress={() => setKind(o.value)} style={[s.opt, kind === o.value && s.optOn]}>
          <Text style={s.optText}>{o.label}</Text>
        </Pressable>
      ))}
      <TextInput value={text} onChangeText={setText} maxLength={1500} multiline placeholder="Cuéntanos qué pasó" placeholderTextColor={c.textMuted} style={s.input} />
      <ClaimPhotos bookingId={id} value={photos} onChange={setPhotos} />
      <Body muted style={{ fontSize: 12 }}>La otra parte tiene {CLAIM_RULES.responseHours} h para dar su versión y HULUL decide en máximo {CLAIM_RULES.resolveHours} h.</Body>
      {msg ? <Body style={{ color: c.danger, fontSize: 13 }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar a HULUL'} onPress={send} />
      <Button variant="secondary" label="Volver" onPress={onCancel} />
    </Card>
  );
}

/** El profesional reporta un problema con el cliente. */
export function ProReportBox({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="secondary" label="Reportar un problema con el cliente" onPress={() => setOpen(true)} />;
  return <ReportForm id={id} side="profesional" options={PRO_PROBLEM_OPTIONS} title="¿Qué pasó con el cliente?" help="HULUL revisa el caso con la llegada, los timbres, el chat y las fotos. El cliente podrá dar su versión." onCancel={() => setOpen(false)} />;
}

const s = StyleSheet.create({
  label: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  status: { fontFamily: font.bodyBold, fontSize: 12.5, color: c.textMuted },
  block: { gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  opt: { padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  optOn: { borderColor: c.primary, borderWidth: 2 },
  optText: { fontFamily: font.bodySemi, fontSize: 14, color: c.text },
  input: { minHeight: 90, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: 10, fontFamily: font.body, fontSize: 14, color: c.text, textAlignVertical: 'top', backgroundColor: c.surface },
});
