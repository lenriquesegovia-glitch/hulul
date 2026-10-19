import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { proReviews, rateService, type PublicReview } from '@hulul/shared/firebase';
import { hasProfanity, PROFANITY_MESSAGE } from '@hulul/shared';
import { Body, Card, PrimaryButton } from '@/components/ui';
import { c, font, radius } from '@/theme';

const LABELS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'];
const GOLD = '#E0A100';

export function StarInput({ value, onChange, size = 34, label }: { value: number; onChange: (n: number) => void; size?: number; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} de 5, ${LABELS[n]}`} onPress={() => onChange(n)} hitSlop={4}>
            <Text style={{ fontSize: size, lineHeight: size + 4, color: n <= value ? GOLD : c.border }}>★</Text>
          </Pressable>
        ))}
      </View>
      <Body muted style={{ fontSize: 13, minHeight: 18 }}>{LABELS[value] ?? ''}</Body>
    </View>
  );
}

/** El cliente califica al profesional (obligatorio) y a la app (opcional); al enviar se cierra el servicio. */
export function RatingBox({ id, proName }: { id: string; proName: string }) {
  const [pro, setPro] = useState(0);
  const [proText, setProText] = useState('');
  const [app, setApp] = useState(0);
  const [appText, setAppText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const send = async () => {
    if (busy) return;
    setMsg('');
    if (!pro) { setMsg(`Elige cuántas estrellas le das a ${proName}.`); return; }
    if (pro <= 2 && proText.trim().length < 10) { setMsg('Cuéntanos qué no te gustó (al menos 10 caracteres). Nos ayuda a mejorar.'); return; }
    if (hasProfanity(proText) || hasProfanity(appText)) { setMsg(PROFANITY_MESSAGE); return; }
    setBusy(true);
    try {
      await rateService({ id, proStars: pro, proComment: proText.trim(), ...(app ? { appStars: app, appComment: appText.trim() } : {}) });
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 12, borderColor: c.primary, borderWidth: 2 }}>
      <Text style={s.title}>¿Cómo te fue con {proName}?</Text>
      <Body muted style={{ fontSize: 13 }}>Tu calificación es pública en su perfil y ayuda a otros a elegir. Quien acumula malas calificaciones deja de recibir trabajos.</Body>
      <StarInput value={pro} onChange={setPro} label={`Calificación de ${proName}`} />
      <TextInput value={proText} onChangeText={setProText} maxLength={600} multiline placeholder={pro && pro <= 2 ? '¿Qué no te gustó?' : 'Comentario (opcional)'} placeholderTextColor={c.textMuted} style={s.input} />
      <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
        <Text style={s.sub}>¿Y la app HULUL? (opcional)</Text>
        <StarInput value={app} onChange={setApp} size={28} label="Calificación de la app" />
        {app > 0 && <TextInput value={appText} onChangeText={setAppText} maxLength={600} multiline placeholder="¿Qué mejorarías?" placeholderTextColor={c.textMuted} style={s.input} />}
      </View>
      {msg ? <Body style={{ fontSize: 13, color: c.primary }}>{msg}</Body> : null}
      <PrimaryButton label={busy ? 'Enviando…' : 'Enviar calificación'} onPress={send} />
    </Card>
  );
}

/** Reseñas públicas de un profesional. */
export function ReviewsList({ uid, first }: { uid: string; first: string }) {
  const [list, setList] = useState<PublicReview[] | null>(null);
  useEffect(() => { proReviews(uid).then(setList).catch(() => setList([])); }, [uid]);
  if (list === null) return <Body muted>Cargando reseñas…</Body>;
  if (!list.length) return <Body muted>{first} es nuevo en HULUL. Las reseñas aparecen aquí después de cada servicio.</Body>;
  return (
    <View style={{ gap: 10 }}>
      {list.map((r) => (
        <View key={r.id} style={s.review}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.sub}>{r.clientName}</Text>
            <Text style={{ color: GOLD }}>{'★'.repeat(r.rating)}<Text style={{ color: c.border }}>{'★'.repeat(5 - r.rating)}</Text></Text>
          </View>
          {r.text ? <Body muted style={{ fontSize: 13.5 }}>{r.text}</Body> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: 17, color: c.text },
  sub: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  input: { minHeight: 64, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: 10, fontFamily: font.body, fontSize: 14, color: c.text, textAlignVertical: 'top', backgroundColor: c.surface },
  review: { padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 4 },
});
