import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import type { User } from 'firebase/auth';
import { e164Ecuador } from '@hulul/shared';
import { createClientProfile, loadClientProfile, type ClientProfile } from '@hulul/shared/firebase';
import { Checkbox } from '@/components/Checkbox';
import { BackButton, Body, Card, H1, PrimaryButton } from '@/components/ui';
import { authErrorMessage, logout, resetPassword, signInEmail, startWebSignIn, useUser, type WebProvider } from '@/lib/auth';
import { c, font, radius } from '@/theme';

/**
 * Cuenta de cliente obligatoria para reservar (como Uber): inicia sesión y,
 * la primera vez, completa nombre, celular y correo. Misma cuenta que la web.
 */
export function ClientGate({ title, lead, children, screen = false }: {
  title: string;
  lead: string;
  children: (ctx: { user: User; profile: ClientProfile }) => ReactNode;
  /** true: la pantalla de acceso se muestra a pantalla completa, con botón de volver. */
  screen?: boolean;
}) {
  const user = useUser();
  const [profile, setProfile] = useState<ClientProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!user) { setProfile(undefined); return; }
    let off = false;
    loadClientProfile(user.uid).then((p) => { if (!off) setProfile(p); }).catch(() => { if (!off) setProfile(null); });
    return () => { off = true; };
  }, [user]);

  const wrap = (node: ReactNode) => (screen ? (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }} keyboardShouldPersistTaps="handled">
          <BackButton />
          {node}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  ) : node);

  if (user === undefined || (user && profile === undefined)) return wrap(<ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />);
  if (!user) return wrap(<SignIn title={title} lead={lead} />);
  if (!profile) return wrap(<ProfileForm user={user} onSaved={setProfile} />);
  return <>{children({ user, profile })}</>;
}

function SignIn({ title, lead }: { title: string; lead: string }) {
  const [create, setCreate] = useState(true);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const go = async () => {
    setMsg('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setMsg('Escribe un correo válido.'); return; }
    if (pass.length < 6) { setMsg('La contraseña debe tener al menos 6 caracteres.'); return; }
    setBusy(true);
    try { await signInEmail(email.trim(), pass, create); } catch (e) { setMsg(authErrorMessage(e)); } finally { setBusy(false); }
  };

  const goWeb = async (p: WebProvider) => {
    setMsg('');
    try { await startWebSignIn(p); setMsg('Termina de entrar en el navegador; volverás solo a la app.'); } catch (e) { setMsg(authErrorMessage(e)); }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <H1 style={{ fontSize: 24 }}>{title}</H1>
        <Body muted>{lead}</Body>
      </View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => goWeb('google')} style={s.google}>
        <Text style={s.googleG}>G</Text>
        <Text style={s.googleText}>Continuar con Google</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => goWeb('microsoft')} style={s.google}>
        <View style={s.msLogo}>
          <View style={[s.msSq, { backgroundColor: '#F25022' }]} /><View style={[s.msSq, { backgroundColor: '#7FBA00' }]} />
          <View style={[s.msSq, { backgroundColor: '#00A4EF' }]} /><View style={[s.msSq, { backgroundColor: '#FFB900' }]} />
        </View>
        <Text style={s.googleText}>Continuar con Outlook</Text>
      </Pressable>
      <Body muted style={{ textAlign: 'center', fontSize: 13 }}>o con tu correo</Body>
      <View style={s.seg}>
        {[['Crear cuenta', true], ['Ya tengo cuenta', false]].map(([l, v]) => (
          <Pressable key={String(l)} accessibilityRole="radio" accessibilityState={{ checked: create === v }} onPress={() => setCreate(v as boolean)} style={[s.segBtn, create === v && s.segOn]}>
            <Text style={[s.segText, create === v && { color: c.text }]}>{l as string}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Correo">
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={s.input} placeholder="tucorreo@ejemplo.com" placeholderTextColor={c.textMuted} />
      </Field>
      <Field label="Contraseña">
        <TextInput value={pass} onChangeText={setPass} secureTextEntry autoComplete={create ? 'new-password' : 'current-password'} style={s.input} placeholder="Mínimo 6 caracteres" placeholderTextColor={c.textMuted} />
      </Field>
      {msg ? <Text style={s.error}>{msg}</Text> : null}
      <PrimaryButton label={busy ? 'Un momento…' : create ? 'Crear mi cuenta' : 'Entrar'} onPress={go} />
      {!create && (
        <Pressable accessibilityRole="button" onPress={async () => {
          if (!email.trim()) { setMsg('Escribe tu correo y vuelve a tocar "Olvidé mi contraseña".'); return; }
          try { await resetPassword(email.trim()); setMsg('Te enviamos un correo para crear tu contraseña (revisa también la carpeta de spam). Sirve aunque hayas creado la cuenta con Google: después entras aquí con tu correo y esa contraseña.'); } catch (e) { setMsg(authErrorMessage(e)); }
        }}>
          <Text style={s.link}>Olvidé mi contraseña</Text>
        </Pressable>
      )}
      <Card style={{ backgroundColor: c.surfaceWarm }}>
        <Body muted style={{ fontSize: 13 }}>Es la misma cuenta que usas en hululec.com. Con Google u Outlook se abre el navegador para entrar y vuelves solo a la app.</Body>
      </Card>
    </View>
  );
}

function ProfileForm({ user, onSaved }: { user: User; onSaved: (p: ClientProfile) => void }) {
  const [name, setName] = useState(user.displayName ?? '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user.email ?? '');
  const [privacy, setPrivacy] = useState(false);
  const [promos, setPromos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setMsg('');
    if (name.trim().split(/\s+/).length < 2) { setMsg('Escribe tu nombre y apellido.'); return; }
    if (!e164Ecuador(phone)) { setMsg('Escribe tu celular de 10 dígitos (09XXXXXXXX).'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setMsg('Escribe un correo válido.'); return; }
    if (!privacy) { setMsg('Para crear tu cuenta debes aceptar los Términos y la Política de privacidad.'); return; }
    setBusy(true);
    try {
      const p: ClientProfile = { name: name.trim(), phone: phone.replace(/\D/g, ''), email: email.trim(), consentMarketing: promos };
      await createClientProfile(user.uid, p);
      onSaved(p);
    } catch {
      setMsg('No pudimos guardar tus datos. Revisa tu conexión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <H1 style={{ fontSize: 24 }}>Completa tu cuenta</H1>
        <Body muted>Solo esta vez. Con estos datos confirmamos tus reservas.</Body>
      </View>
      <Field label="Nombre y apellido"><TextInput value={name} onChangeText={setName} autoComplete="name" style={s.input} /></Field>
      <Field label="Celular (WhatsApp)"><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="09XXXXXXXX" placeholderTextColor={c.textMuted} style={s.input} /></Field>
      <Field label="Correo"><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} /></Field>
      <Checkbox checked={privacy} onChange={setPrivacy}>
        <Body style={{ fontSize: 13.5 }}>Acepto los Términos y condiciones y la <Link href="/privacidad" style={s.link}>Política de privacidad</Link>.</Body>
      </Checkbox>
      <Checkbox checked={promos} onChange={setPromos}>
        <Body style={{ fontSize: 13.5 }}>Quiero recibir novedades y promociones (opcional).</Body>
      </Checkbox>
      {msg ? <Text style={s.error}>{msg}</Text> : null}
      <PrimaryButton label={busy ? 'Guardando…' : 'Crear mi cuenta'} onPress={save} />
      <Pressable accessibilityRole="button" onPress={logout}><Text style={s.link}>Usar otra cuenta</Text></Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  googleG: { fontFamily: font.display, fontSize: 18, color: '#4285F4' },
  msLogo: { width: 18, height: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  msSq: { width: 8.5, height: 8.5 },
  googleText: { fontFamily: font.bodyBold, fontSize: 15, color: c.text },
  label: { fontFamily: font.bodyBold, fontSize: 14, color: c.textSecondary },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, fontFamily: font.body, fontSize: 16, color: c.text },
  error: { fontFamily: font.bodySemi, fontSize: 13, color: c.primary },
  link: { fontFamily: font.bodyBold, fontSize: 14, color: c.primary },
  seg: { flexDirection: 'row', backgroundColor: c.surfaceWarm, borderRadius: 12, padding: 4, gap: 4, alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9 },
  segOn: { backgroundColor: c.surface },
  segText: { fontFamily: font.bodyBold, fontSize: 14, color: c.textSecondary },
});
