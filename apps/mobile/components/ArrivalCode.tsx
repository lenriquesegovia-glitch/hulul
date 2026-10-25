import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ABSENT_PROBLEM_OPTIONS, watchArrivalCode } from '@hulul/shared/firebase';
import { ReportForm } from '@/components/Claim';
import { serviceCopy } from '@hulul/shared';
import { Body, Button, Card, PrimaryButton } from '@/components/ui';
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

/** Pedir ayuda con el servicio (hasta 48 h): el pago queda en espera y HULUL revisa. */
export function ProblemBox({ id, category, absent = false }: { id: string; category?: string; absent?: boolean }) {
  const copy = serviceCopy(category);
  const options: { value: string; label: string }[] = absent ? ABSENT_PROBLEM_OPTIONS : copy.helpOptions;
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="secondary" label={absent ? 'Yo sí estaba en casa' : copy.helpButton} onPress={() => setOpen(true)} />;
  return (
    <ReportForm id={id} side="cliente" options={options} onCancel={() => setOpen(false)}
      title={absent ? '¿Estabas en casa?' : copy.helpTitle}
      help={absent ? 'El cobro queda en espera y HULUL revisa la llegada del profesional, los timbres, el chat y las horas. Si estabas, no pagas nada.' : 'Cuéntanos y lo revisamos. Mientras tanto el pago queda en espera; si el servicio no se realizó, no pagas.'} />
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
