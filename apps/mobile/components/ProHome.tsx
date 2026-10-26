import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COMMISSION_RATE, formatUSD, getCategory } from '@hulul/shared';
import { firestore, type ProBooking } from '@hulul/shared/firebase';
import { Icon } from '@/components/Icon';
import { Body, H1, H2 } from '@/components/ui';
import { c, font, radius } from '@/theme';
import { openWebAs } from '@/lib/web';


const STATUS: Record<string, string> = {
  pendiente: 'Nueva solicitud', confirmada: 'Confirmada', en_camino: 'En camino', en_curso: 'En curso',
  por_aprobar: 'Terminada', completada: 'Completada', cancelada: 'Cancelada',
};
const ACTIVE = ['pendiente', 'confirmada', 'en_camino', 'en_curso'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Fecha de hoy en Ecuador, AAAA-MM-DD. */
const todayEc = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const dayLabel = (iso: string) => {
  if (iso === todayEc()) return 'Hoy';
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
};
const earned = (b: ProBooking) => ((b.visit ?? b.subtotal ?? 0) + (b.surcharge ?? 0)) * (1 - COMMISSION_RATE)
  + (b.extra && ['por_cobrar', 'pagado', 'efectivo_pendiente', 'pagado_efectivo'].includes(b.extra.status) ? b.extra.amount - b.extra.commission : 0);

/**
 * Inicio del profesional: lo urgente primero (solicitudes nuevas, el próximo
 * trabajo), sus números de la semana y accesos a la agenda. Se actualiza solo.
 */
export function ProHome({ uid, name }: { uid: string; name: string }) {
  const [rows, setRows] = useState<ProBooking[] | null>(null);

  useEffect(() => {
    const q = query(collection(firestore(), 'bookings'), where('professionalId', '==', uid));
    return onSnapshot(q, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProBooking, 'id'>) }))), () => setRows([]));
  }, [uid]);

  const data = useMemo(() => {
    const list = rows ?? [];
    const today = todayEc();
    const weekAgo = new Date(Date.now() - 5 * 3_600_000 - 6 * 86_400_000).toISOString().slice(0, 10);
    const sorted = [...list].sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
    const upcoming = sorted.filter((b) => ACTIVE.includes(b.status) && b.date >= today);
    return {
      pending: upcoming.filter((b) => b.status === 'pendiente'),
      next: upcoming.find((b) => b.status !== 'pendiente'),
      upcoming: upcoming.slice(0, 6),
      todayCount: upcoming.filter((b) => b.date === today && b.status !== 'pendiente').length,
      week: list.filter((b) => ['por_aprobar', 'completada'].includes(b.status) && b.date >= weekAgo && b.date <= today).reduce((t, b) => t + earned(b), 0),
    };
  }, [rows]);

  const first = name.split(' ')[0];
  const open = () => router.push('/agenda');
  const openJob = (id: string) => router.push({ pathname: '/agenda/[id]', params: { id } });

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 4 }}>
        <Body muted>Hola{first ? `, ${first}` : ''}</Body>
        <H1>Tu día en HULUL</H1>
      </View>

      <View style={s.stats}>
        <Stat n={rows ? String(data.pending.length) : '…'} label="Solicitudes nuevas" hot={data.pending.length > 0} />
        <Stat n={rows ? String(data.todayCount) : '…'} label="Trabajos hoy" />
        <Stat n={rows ? formatUSD(data.week) : '…'} label="Ganado en 7 días" onPress={() => router.push('/estado-cuenta')} />
      </View>

      {data.pending.length > 0 && (
        <Pressable accessibilityRole="button" onPress={() => (data.pending.length === 1 ? openJob(data.pending[0].id) : open())} style={s.alert}>
          <Text style={s.alertTitle}>🔔 {data.pending.length === 1 ? 'Tienes una solicitud nueva' : `Tienes ${data.pending.length} solicitudes nuevas`}</Text>
          <Body style={{ color: '#fff', fontSize: 13.5 }}>
            {getCategory(data.pending[0].category)?.name} · {dayLabel(data.pending[0].date)} {data.pending[0].slot}. Acéptala o recházala en tu agenda.
          </Body>
          {!!data.pending[0].photos?.length && <Body style={{ color: '#fff', fontSize: 13 }}>📷 El cliente adjuntó {data.pending[0].photos.length} foto(s).</Body>}
          <View style={s.alertBtn}><Text style={s.alertBtnText}>Revisar ahora</Text></View>
        </Pressable>
      )}

      {data.next && (
        <View style={s.card}>
          <Text style={s.eyebrow}>PRÓXIMO TRABAJO · {STATUS[data.next.status]?.toUpperCase()}</Text>
          <Text style={s.nextTitle}>{dayLabel(data.next.date)} · {data.next.slot} · {getCategory(data.next.category)?.name}</Text>
          <Body muted style={{ fontSize: 13.5 }}>{String(data.next.contactName ?? '').split(' ')[0]} · {data.next.address}</Body>
          {data.next.notes ? <Body style={{ fontSize: 13.5 }} numberOfLines={2}>{data.next.notes}</Body> : null}
          {!!data.next.photos?.length && (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {data.next.photos.map((u) => (
                <Pressable key={u} onPress={() => Linking.openURL(u)}><Image source={{ uri: u }} style={{ width: 64, height: 64, borderRadius: 8 }} accessibilityLabel="Foto del cliente" /></Pressable>
              ))}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable accessibilityRole="button" onPress={() => openJob(data.next!.id)} style={s.primary}><Text style={s.primaryText}>Ver trabajo</Text></Pressable>
            {data.next.location && (
              <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${data.next!.location!.lat},${data.next!.location!.lng}`)} style={s.ghost}>
                <Icon name="pin" size={16} color={c.primary} /><Text style={s.ghostText}>Cómo llegar</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {rows && !data.next && data.pending.length === 0 && (
        <View style={s.card}>
          <Text style={s.nextTitle}>Sin trabajos por ahora</Text>
          <Body muted style={{ fontSize: 13.5 }}>Te sonará el celular apenas llegue una reserva. Revisa que tus servicios, tarifas y horario estén al día.</Body>
        </View>
      )}

      {data.upcoming.length > 1 && (
        <View style={{ gap: 10 }}>
          <H2>Próximos</H2>
          {data.upcoming.map((b) => (
            <Pressable key={b.id} accessibilityRole="button" onPress={() => openJob(b.id)} style={s.row}>
              <View style={s.when}><Text style={s.whenDay}>{dayLabel(b.date)}</Text><Text style={s.whenTime}>{b.slot}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{getCategory(b.category)?.name}</Text>
                <Body muted style={{ fontSize: 12.5 }} numberOfLines={1}>{b.address}</Body>
              </View>
              <Text style={[s.badge, b.status === 'pendiente' && s.badgeHot]}>{STATUS[b.status]}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={open} style={s.tile}><Icon name="calendar" size={22} color={c.primary} /><Text style={s.tileText}>Mi agenda</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/estado-cuenta')} style={s.tile}><Icon name="card" size={22} color={c.primary} /><Text style={s.tileText}>Estado de cuenta</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => openWebAs('/profesionales/registro')} style={s.tile}><Icon name="card" size={22} color={c.primary} /><Text style={s.tileText}>Servicios y tarifas</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/profesional/[id]', params: { id: uid } })} style={s.tile}><Icon name="user" size={22} color={c.primary} /><Text style={s.tileText}>Mi perfil</Text></Pressable>
      </View>
    </View>
  );
}

function Stat({ n, label, hot = false, onPress }: { n: string; label: string; hot?: boolean; onPress?: () => void }) {
  const body = (
    <>
      {/* El valor nunca se parte en dos líneas: si no cabe, se achica. */}
      <Text style={[s.statN, hot && { color: c.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{n}</Text>
      <Text style={s.statL}>{label}{onPress ? ' ›' : ''}</Text>
    </>
  );
  const style = [s.stat, hot && { borderColor: c.primary, backgroundColor: c.copperSoft }];
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${n}. Ver estado de cuenta`} onPress={onPress} style={style}>{body}</Pressable>
    : <View style={style}>{body}</View>;
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 2 },
  statN: { fontFamily: font.display, fontSize: 20, color: c.text },
  statL: { fontFamily: font.bodySemi, fontSize: 11.5, color: c.textSecondary },
  alert: { padding: 16, borderRadius: radius.lg, backgroundColor: c.primary, gap: 6 },
  alertTitle: { fontFamily: font.display, fontSize: 16, color: '#fff' },
  alertBtn: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  alertBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
  card: { padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 8 },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: c.copper },
  nextTitle: { fontFamily: font.display, fontSize: 17, color: c.text },
  primary: { backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  primaryText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff' },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  ghostText: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  when: { width: 58, alignItems: 'center' },
  whenDay: { fontFamily: font.bodyBold, fontSize: 12, color: c.copper },
  whenTime: { fontFamily: font.display, fontSize: 15, color: c.text },
  rowTitle: { fontFamily: font.bodyBold, fontSize: 14.5, color: c.text },
  badge: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.successSoft, color: c.success, fontFamily: font.bodyBold, fontSize: 11 },
  badgeHot: { backgroundColor: c.copperSoft, color: c.copper },
  tile: { flexGrow: 1, flexBasis: '45%', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  tileText: { fontFamily: font.bodySemi, fontSize: 12, color: c.text, textAlign: 'center' },
});
