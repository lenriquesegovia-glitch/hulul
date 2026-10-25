import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  formatUSD, LEDGER_KINDS, monthStartEc, pendingBalance, recentStrikes, rowEffect, statementFor,
  STRIKE_LIMIT, STRIKE_WINDOW_DAYS, type LedgerRow, type PayoutRow,
} from '@hulul/shared';
import { firestore } from '@hulul/shared/firebase';
import { BackButton, Body, H1, H2 } from '@/components/ui';
import { useUser } from '@/lib/auth';
import { c, font, radius } from '@/theme';

type Period = 'semana' | 'mes' | 'tres';
const PERIODS: [Period, string][] = [['semana', 'Últimos 7 días'], ['mes', 'Este mes'], ['tres', 'Últimos 3 meses']];
const ms = (t: unknown) => (t && typeof (t as { toMillis?: () => number }).toMillis === 'function' ? (t as { toMillis: () => number }).toMillis() : Number(t) || 0);
const day = (t: number) => new Date(t - 5 * 3_600_000).toISOString().slice(0, 10).split('-').reverse().join('/');
const code = (id?: string | null) => (id ? id.slice(0, 8).toUpperCase() : '');

export interface ProFields { strikeLog?: number[]; strikesResetAt?: number; fines?: number; suspendedUntil?: number; strikes?: number }

/** Estado de cuenta del profesional: lo ganado, lo descontado, faltas, saldo y liquidaciones. */
export default function EstadoCuenta() {
  const user = useUser();
  const uid = user?.uid;
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);
  const [pro, setPro] = useState<ProFields | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const db = firestore();
    const fail = () => setError(true);
    const offL = onSnapshot(query(collection(db, 'ledger'), where('proId', '==', uid)), (s) => setLedger(s.docs.map((d) => {
      const x = d.data();
      return { id: d.id, kind: x.kind, bucket: x.bucket, amount: Number(x.amount ?? 0), proDelta: Number(x.proDelta ?? 0), bookingId: x.bookingId ?? null,
        payoutId: x.payoutId ?? null, availableAt: Number(x.availableAt ?? 0), createdAtMs: ms(x.createdAt) || Number(x.availableAt ?? 0), memo: x.memo, reverses: x.reverses };
    })), fail);
    const offP = onSnapshot(query(collection(db, 'payouts'), where('proId', '==', uid)), (s) => setPayouts(s.docs.map((d) => {
      const x = d.data();
      return { id: d.id, week: String(x.week ?? ''), status: String(x.status ?? ''), gross: Number(x.gross ?? 0), deductions: Number(x.deductions ?? 0),
        retentions: x.retentions ?? {}, net: Number(x.net ?? 0), paidAtMs: ms(x.paidAt) };
    }).sort((a, b) => b.week.localeCompare(a.week))), fail);
    const offD = onSnapshot(doc(db, 'providers', uid), (s) => setPro((s.data() as ProFields) ?? {}), fail);
    return () => { offL(); offP(); offD(); };
  }, [uid]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton />
          <H1 style={{ fontSize: 24 }}>Estado de cuenta</H1>
        </View>
        {!uid ? <Body>Inicia sesión para ver tu estado de cuenta.</Body>
          : error ? <Body>No pudimos cargar tu estado de cuenta. Revisa tu conexión y vuelve a entrar.</Body>
          : !ledger || !payouts || !pro ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
          : <StatementView ledger={ledger} payouts={payouts} pro={pro} />}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Vista del estado de cuenta con los datos ya cargados. */
export function StatementView({ ledger, payouts, pro, now: nowProp }: { ledger: LedgerRow[]; payouts: PayoutRow[]; pro: ProFields; now?: number }) {
  const [period, setPeriod] = useState<Period>('mes');
  const [now] = useState(() => nowProp ?? Date.now());
  const from = period === 'semana' ? now - 7 * 86_400_000 : period === 'mes' ? monthStartEc(now) : now - 90 * 86_400_000;
  const st = useMemo(() => statementFor(ledger, from, now), [ledger, from, now]);
  const bal = useMemo(() => pendingBalance(ledger, now), [ledger, now]);
  const strikes = recentStrikes(pro.strikeLog, now, pro.strikesResetAt);
  const suspended = (pro.suspendedUntil ?? 0) > now;
  return (
            <>
              <View style={s.seg} accessibilityRole="tablist">
                {PERIODS.map(([p, l]) => (
                  <Pressable key={p} accessibilityRole="tab" accessibilityState={{ selected: period === p }} onPress={() => setPeriod(p)} style={[s.segBtn, period === p && s.segOn]}>
                    <Text style={[s.segText, period === p && s.segTextOn]} numberOfLines={1} adjustsFontSizeToFit>{l}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.card}>
                <Text style={s.eyebrow}>RESUMEN</Text>
                <Line label="Ganado por servicios" value={st.earned} sign="+" strong />
                <Line label="Comisión HULUL (con IVA)" value={st.commission} sign="−" />
                <Line label="Multas por faltas" value={st.fines} sign="−" />
                {st.retentions !== 0 && <Line label="Retenciones" value={st.retentions} sign="−" />}
                <View style={s.rule} />
                <Line label="Te queda" value={st.net} strong big />
                {st.cashCollected > 0 && <Body muted style={s.note}>De lo ganado, {formatUSD(st.cashCollected)} lo cobraste tú en efectivo.</Body>}
                {st.cashOwed > 0 && <Body muted style={s.note}>Cargos de plataforma cobrados en efectivo (son de HULUL): {formatUSD(st.cashOwed)}. Se descuentan de tus pagos.</Body>}
              </View>

              <View style={s.card}>
                <Text style={s.eyebrow}>SALDO CON HULUL</Text>
                {bal.total >= 0 ? (
                  <>
                    <Line label="Para tu próximo pago (lunes)" value={bal.available} strong />
                    <Line label="En espera (48 h para reclamos)" value={bal.held} />
                    <Body muted style={s.note}>HULUL te paga cada lunes por transferencia lo disponible, menos retenciones.</Body>
                  </>
                ) : (
                  <>
                    <Line label="Debes a HULUL" value={-bal.total} strong />
                    <Body muted style={s.note}>Por cargos de plataforma y comisiones de trabajos cobrados en efectivo. Se descuenta de tus próximos pagos con tarjeta.</Body>
                  </>
                )}
              </View>

              <View style={[s.card, (suspended || strikes > 0) && { borderColor: c.copper }]}>
                <Text style={s.eyebrow}>FALTAS</Text>
                <Line label={`Faltas en los últimos ${STRIKE_WINDOW_DAYS} días`} text={`${strikes} de ${STRIKE_LIMIT}`} strong />
                <Line label="Multas acumuladas" value={Number(pro.fines ?? 0)} />
                {suspended
                  ? <Body style={[s.note, { color: c.copper }]}>Cuenta pausada hasta el {day(pro.suspendedUntil!)}: no recibes trabajos nuevos.</Body>
                  : <Body muted style={s.note}>Llegar tarde, no ir o cancelar a última hora son faltas. Con {STRIKE_LIMIT} en {STRIKE_WINDOW_DAYS} días la cuenta se pausa 7 días.</Body>}
              </View>

              <H2>Pagos semanales</H2>
              {payouts.length === 0 ? <Body muted>Aún no tienes liquidaciones. Se hacen cada lunes.</Body> : payouts.slice(0, 12).map((p) => (
                <View key={p.id} style={s.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowTitle}>Semana del {p.week.split('-').reverse().join('/')}</Text>
                    <Body muted style={s.small}>Ganado {formatUSD(p.gross)} · descuentos {formatUSD(p.deductions)}{(p.retentions?.renta || p.retentions?.iva) ? ` · retenciones ${formatUSD((p.retentions?.renta ?? 0) + (p.retentions?.iva ?? 0))}` : ''}</Body>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.amount} numberOfLines={1}>{formatUSD(p.net)}</Text>
                    <Text style={[s.badge, p.status === 'pagado' ? s.badgeOk : s.badgeWarm]}>{p.status === 'pagado' ? 'Pagado' : 'Por pagar'}</Text>
                  </View>
                </View>
              ))}

              <H2>Movimientos</H2>
              {st.rows.length === 0 ? <Body muted>No hay movimientos en este periodo.</Body> : st.rows.slice(0, 80).map((e) => {
                const eff = rowEffect(e);
                return (
                  <View key={e.id} style={s.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowTitle}>{e.reverses ? 'Anulado: ' : ''}{LEDGER_KINDS[e.kind]?.label ?? e.kind}</Text>
                      <Body muted style={s.small}>{day(e.createdAtMs ?? 0)}{e.bookingId ? ` · Reserva ${code(e.bookingId)}` : ''}{e.payoutId ? ' · liquidado' : ''}</Body>
                    </View>
                    <Text style={[s.amount, eff.sign === '+' ? { color: c.success } : { color: c.text }]} numberOfLines={1}>{eff.sign}{formatUSD(eff.amount)}</Text>
                  </View>
                );
              })}
              <Body muted style={s.note}>Valores según el registro de HULUL. Si algo no cuadra, escríbenos con el código de la reserva.</Body>
            </>
  );
}

function Line({ label, value, text, sign, strong, big }: { label: string; value?: number; text?: string; sign?: '+' | '−'; strong?: boolean; big?: boolean }) {
  const shown = text ?? `${sign && value ? sign : ''}${formatUSD(value ?? 0)}`;
  return (
    <View style={s.line}>
      <Text style={[s.lineLabel, strong && { fontFamily: font.bodyBold, color: c.text }]}>{label}</Text>
      <Text style={[s.lineValue, strong && { fontFamily: font.display }, big && { fontSize: 20 }]} numberOfLines={1}>{shown}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceWarm, borderWidth: 1, borderColor: c.border },
  segBtn: { flex: 1, minHeight: 44, paddingHorizontal: 6, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: c.primary },
  segText: { fontFamily: font.bodyBold, fontSize: 13, color: c.textSecondary },
  segTextOn: { color: '#fff' },
  card: { padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 8 },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: c.copper },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flex: 1, fontFamily: font.body, fontSize: 14, color: c.textSecondary },
  lineValue: { fontFamily: font.bodySemi, fontSize: 15, color: c.text, fontVariant: ['tabular-nums'] },
  rule: { height: 1, backgroundColor: c.border, marginVertical: 2 },
  note: { fontSize: 12.5, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  rowTitle: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  small: { fontSize: 12.5 },
  amount: { fontFamily: font.display, fontSize: 15, color: c.text, fontVariant: ['tabular-nums'] },
  badge: { overflow: 'hidden', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, fontFamily: font.bodyBold, fontSize: 11 },
  badgeOk: { backgroundColor: c.successSoft, color: c.success },
  badgeWarm: { backgroundColor: c.copperSoft, color: c.copper },
});
