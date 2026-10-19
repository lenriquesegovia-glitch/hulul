import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PROBLEM_OPTIONS, reportProblem, watchArrivalCode } from '@hulul/shared/firebase';
import { Body, Card, PrimaryButton } from '@/components/ui';
import { c, font, radius } from '@/theme';

/** Código de llegada del cliente: se lo da al profesional cuando llega, para que empiece. */
export function ArrivalCode({ id, pro }: { id: string; pro: string }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => watchArrivalCode(id, setCode), [id]);
  if (!code) return null;
  return (
    <Card style={{ gap: 6, borderColor: c.primary, borderWidth: 2 }}>
      <Text style={s.label}>Tu código de llegada</Text>
      <Text style={s.code} accessibilityLabel={`Código ${code.split('').join(' ')}`}>{code}</Text>
      <Body muted style={{ fontSize: 13 }}>Dáselo a {pro} cuando esté en tu casa. Sin este código no puede empezar ni cerrar el trabajo. No lo compartas antes.</Body>
    </Card>
  );
}

/** Reportar un problema (hasta 48 h): el pago queda retenido y HULUL revisa. */
export function ProblemBox({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!open) return <Pressable onPress={() => setOpen(true)}><Text style={s.link}>Reportar un problema</Text></Pressable>;
  const send = async () => {
    if (busy) return;
    setMsg('');
    if (!kind) { setMsg('Elige qué pasó.'); return; }
    if (text.trim().length < 15) { setMsg('Cuéntanos qué pasó (al menos 15 caracteres).'); return; }
    setBusy(true);
    try { await reportProblem({ id, kind, text: text.trim() }); } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo enviar.'); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.label}>Reportar un problema</Text>
      <Body muted style={{ fontSize: 12.5 }}>El pago queda retenido y HULUL revisa el código de llegada, la ubicación, las fotos y el chat. Si el trabajo no se hizo, te devolvemos lo pagado.</Body>
      {PROBLEM_OPTIONS.map((o) => (
        <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: kind === o.value }} onPress={() => setKind(o.value)} style={[s.opt, kind === o.value && s.optOn]}>
          <Text style={s.optText}>{o.label}</Text>
        </Pressable>
      ))}
      <TextInput value={text} onChangeText={setText} maxLength={1000} multiline placeholder="Qué pasó, a qué hora, qué te dijo…" placeholderTextColor={c.textMuted} style={s.input} />
      {msg ? <Body style={{ color: c.primary, fontSize: 13 }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar reporte'} onPress={send} />
      <Pressable onPress={() => setOpen(false)}><Text style={[s.link, { textAlign: 'center' }]}>Volver</Text></Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  code: { fontFamily: font.displayHeavy, fontSize: 38, letterSpacing: 10, color: c.text },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary, paddingVertical: 4 },
  opt: { padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  optOn: { borderColor: c.primary, borderWidth: 2 },
  optText: { fontFamily: font.bodySemi, fontSize: 14, color: c.text },
  input: { minHeight: 80, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: 10, fontFamily: font.body, fontSize: 14, color: c.text, textAlignVertical: 'top', backgroundColor: c.surface },
});
