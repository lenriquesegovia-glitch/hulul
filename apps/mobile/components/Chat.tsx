import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { sendChat, watchChat, type ChatMessage } from '@hulul/shared/firebase';
import { Body, Button } from '@/components/ui';
import { photosAvailable, pickPhotos, uploadLocalPhotos } from '@/lib/photos';
import { c, font, radius } from '@/theme';

const hhmm = (d?: Date) => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');

/** Chat de la reserva entre cliente y profesional, sin compartir números. */
export function Chat({ bookingId, uid, me, otherName, open }: { bookingId: string; uid: string; me: 'cliente' | 'profesional'; otherName: string; open: boolean }) {
  const [list, setList] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scroll = useRef<ScrollView>(null);

  useEffect(() => watchChat(bookingId, setList), [bookingId]);

  const send = (m: { kind: 'texto' | 'foto' | 'pedir_fotos'; text?: string; photo?: string }) => sendChat(bookingId, { from: me, uid, ...m });

  const sendText = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setErr('');
    try { await send({ kind: 'texto', text: t }); setText(''); } catch { setErr('No se pudo enviar. Revisa tu conexión.'); } finally { setBusy(false); }
  };

  const sendPhotos = async (from: 'camara' | 'galeria') => {
    setErr('');
    try {
      const uris = await pickPhotos(from, 4);
      if (!uris.length) return;
      setBusy(true);
      const urls = await uploadLocalPhotos(`chat/${bookingId}/${uid}`, uris);
      for (const u of urls) await send({ kind: 'foto', photo: u });
    } catch (e) {
      setErr((e as { code?: string }).code === 'sin-permiso-camara' ? 'Permite la cámara en los ajustes del celular.' : 'No se pudo enviar la foto.');
    } finally {
      setBusy(false);
    }
  };

  const lastAsk = list ? [...list].reverse().find((m) => m.kind === 'pedir_fotos') : undefined;
  const answered = !!lastAsk && !!list?.some((m) => m.kind === 'foto' && m.from === 'cliente' && (m.at?.getTime() ?? 0) >= (lastAsk.at?.getTime() ?? 0));
  const canPhoto = photosAvailable();

  return (
    <View style={{ gap: 8 }}>
      <ScrollView ref={scroll} style={s.box} contentContainerStyle={{ gap: 8, padding: 10 }} nestedScrollEnabled
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {list === null && <Body muted style={{ fontSize: 13 }}>Cargando mensajes…</Body>}
        {list?.length === 0 && <Body muted style={{ fontSize: 13 }}>Escríbele a {otherName} por aquí. Tu número no se comparte.</Body>}
        {list?.map((m) => {
          const mine = m.from === me;
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                {m.kind === 'pedir_fotos' && <Text style={[s.small, mine && { color: '#fff' }]}>📷 Pidió fotos</Text>}
                {m.text ? <Text style={[s.text, mine && { color: '#fff' }]}>{m.text}</Text> : null}
                {m.photo ? <Pressable onPress={() => Linking.openURL(m.photo!)}><Image source={{ uri: m.photo }} style={s.photo} accessibilityLabel="Foto del chat" /></Pressable> : null}
              </View>
              <Text style={[s.time, { textAlign: mine ? 'right' : 'left' }]}>{hhmm(m.at)}</Text>
            </View>
          );
        })}
      </ScrollView>

      {open && me === 'cliente' && lastAsk && !answered && (
        <View style={s.ask}>
          <Text style={s.askTitle}>{otherName} te pide fotos</Text>
          {canPhoto ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="📷 Tomar foto" onPress={() => sendPhotos('camara')} style={{ flex: 1 }} />
              <Button variant="secondary" label="Galería" onPress={() => sendPhotos('galeria')} style={{ flex: 1 }} />
            </View>
          ) : <Body muted style={{ fontSize: 12.5 }}>Actualiza la app para enviar fotos desde aquí, o envíalas desde hululec.com.</Body>}
        </View>
      )}

      {open ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={text} onChangeText={setText} maxLength={1000} placeholder={`Mensaje para ${otherName}`} placeholderTextColor={c.textMuted} style={s.input} onSubmitEditing={sendText} returnKeyType="send" />
            <Pressable accessibilityRole="button" accessibilityLabel="Enviar" onPress={sendText} style={[s.btn, s.btnPrimary, { flex: 0, paddingHorizontal: 16 }]}><Text style={[s.btnText, { color: '#fff' }]}>Enviar</Text></Pressable>
          </View>
          {canPhoto && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="secondary" label="📷 Tomar foto" onPress={() => sendPhotos('camara')} style={{ flex: 1 }} />
              <Button variant="secondary" label="Galería" onPress={() => sendPhotos('galeria')} style={{ flex: 1 }} />
            </View>
          )}
        </>
      ) : <Body muted style={{ fontSize: 12.5 }}>El chat se cerró con la reserva. Los mensajes quedan como respaldo.</Body>}
      {err ? <Body style={{ fontSize: 13, color: c.primary }}>{err}</Body> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { maxHeight: 300, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceWarm },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, gap: 4 },
  mine: { backgroundColor: c.primary },
  theirs: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  text: { fontFamily: font.body, fontSize: 14.5, color: c.text },
  small: { fontFamily: font.bodyBold, fontSize: 12, color: c.copper },
  time: { fontFamily: font.body, fontSize: 11, color: c.textMuted, marginTop: 2 },
  photo: { width: 170, height: 170, borderRadius: 10 },
  ask: { padding: 12, borderRadius: 10, backgroundColor: c.copperSoft, gap: 8 },
  askTitle: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
  input: { flex: 1, height: 46, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: 12, fontFamily: font.body, fontSize: 14.5, color: c.text, backgroundColor: c.surface },
  btn: { flex: 1, height: 46, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
  btnText: { fontFamily: font.bodyBold, fontSize: 14, color: c.text },
});
