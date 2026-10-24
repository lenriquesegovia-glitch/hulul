'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from 'firebase/auth';
import {
  BANKS_EC,
  categories,
  CATEGORY_REVIEW_LABEL,
  cities,
  e164Ecuador,
  evidenceProblem,
  getCategory,
  MAX_DOC_MB,
  POLICY,
  PRIVACY_VERSION,
  PROVIDER_DOCS,
  requiredDocs,
  validCedula,
  validRuc,
  TRADE_NAME,
  maxEndHour,
  isNoisy,
  offHoursProblem,
  type Surcharges,
  WEEKDAY_NAMES,
  type CategoryEvidence,
  type CategoryReview,
  type CategorySlug,
  type ProviderDocSpec,
  type ProviderKind,
  type ProviderStatus,
  TAX_REGIMES,
  TAX_REGIME_LABEL,
  type TaxRegime,
} from '@hulul/shared';
import { Icon } from '@/components/Icon';
import { logout, useUser } from '@/lib/auth';
import { SignIn } from '@/components/SignIn';
import { EvidenceEditor, Field, RateField, rateProblem, ServicesPicker } from './ServiceBits';
import { ServiceManager } from './ServiceManager';
import { OffHoursEditor } from './OffHoursEditor';

/* ------------------------------------------------------------------ */
/* Datos del registro                                                  */
/* ------------------------------------------------------------------ */

type DocKey = ProviderDocSpec['key'];

interface Draft {
  kind: ProviderKind;
  firstName: string;
  lastName: string;
  businessName: string;
  cedula: string;
  ruc: string;
  phone: string;
  email: string;
  categories: CategorySlug[];
  services: Partial<Record<CategorySlug, string[]>>;
  /** Tarifa por visita en cada categoría (la pone el profesional). */
  visitRates: Partial<Record<CategorySlug, number | undefined>>;
  /** Cómo demuestra que sabe hacer cada categoría. */
  catEvidence: Partial<Record<CategorySlug, CategoryEvidence>>;
  years: number;
  bio: string;
  cities: string[];
  days: number[];
  from: string;
  to: string;
  acceptsCash: boolean;
  /** Fuera de horario: horas en que acepta llegar (0–7, 18–23), feriados y tarifas especiales fijos. */
  offHours: number[];
  holidays: boolean;
  surcharges: Surcharges;
  docs: Partial<Record<DocKey, { path: string; name: string }>>;
  /** Régimen tributario en el SRI ('' = aún no elige): define si su visita lleva IVA. */
  taxRegime: TaxRegime | '';
  /** Tiene firma electrónica (para emitir sus facturas desde HULUL). */
  eSignature: boolean;
}

interface Bank {
  bank: string;
  type: 'ahorros' | 'corriente';
  number: string;
  holder: string;
  holderId: string;
}

const EMPTY: Draft = {
  kind: 'persona', firstName: '', lastName: '', businessName: '', cedula: '', ruc: '', phone: '', email: '',
  categories: [], services: {}, visitRates: {}, catEvidence: {}, years: 0, bio: '',
  cities: [], days: [1, 2, 3, 4, 5, 6], from: '08:00', to: '17:00', acceptsCash: true, offHours: [], holidays: false, surcharges: {}, docs: {},
  taxRegime: '', eSignature: false,
};
const EMPTY_BANK: Bank = { bank: '', type: 'ahorros', number: '', holder: '', holderId: '' };

const HOURS = Array.from({ length: 16 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`);
const ACTIVE_CITIES = cities.filter((c) => c.activa);

const STEPS = ['Tus datos', 'Servicios', 'Zonas y horario', 'Documentos', 'Cobros', 'Enviar'];

/* ------------------------------------------------------------------ */
/* Firebase (se carga solo aquí)                                        */
/* ------------------------------------------------------------------ */

async function fb() {
  const [{ firestore, firebaseApp }, fs, st] = await Promise.all([
    import('@hulul/shared/firebase'),
    import('firebase/firestore'),
    import('firebase/storage'),
  ]);
  return { db: firestore(), storage: st.getStorage(firebaseApp()), fs, st };
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                 */
/* ------------------------------------------------------------------ */

export function ProviderSignup() {
  const user = useUser();

  if (user === undefined) return <p className="muted">Cargando…</p>;
  if (!user) return <SignIn title="Crea tu cuenta de profesional" lead="Con tu cuenta guardas el avance del registro y, cuando te aprobemos, recibes trabajos en la app." />;
  return <Wizard user={user} />;
}

/* ---------------------------- Asistente ---------------------------- */

function Wizard({ user }: { user: User }) {
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState<ProviderStatus>('borrador');
  const [catStatus, setCatStatus] = useState<Partial<Record<CategorySlug, CategoryReview>> | undefined>();
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [bank, setBank] = useState<Bank>(EMPTY_BANK);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const top = useRef<HTMLDivElement>(null);

  // Carga el borrador guardado.
  useEffect(() => {
    let off = false;
    (async () => {
      const { db, fs } = await fb();
      const snap = await fs.getDoc(fs.doc(db, 'providers', user.uid));
      const bankSnap = await fs.getDoc(fs.doc(db, 'providers', user.uid, 'private', 'banco')).catch(() => null);
      if (off) return;
      if (snap.exists()) {
        const data = snap.data();
        setExists(true);
        setStatus(data.status ?? 'borrador');
        setCatStatus(data.catStatus);
        setD({ ...EMPTY, ...pick(data) });
        setStep(Math.min(Number(data.step ?? 0), STEPS.length - 1));
      } else {
        setD({ ...EMPTY, email: user.email ?? '', phone: localPhone(user.phoneNumber), firstName: (user.displayName ?? '').split(' ')[0] ?? '', lastName: (user.displayName ?? '').split(' ').slice(1).join(' ') });
      }
      if (bankSnap?.exists()) setBank({ ...EMPTY_BANK, ...(bankSnap.data() as Bank) });
      setLoaded(true);
    })().catch(() => { if (!off) { setError('No pudimos cargar tu registro. Revisa tu conexión.'); setLoaded(true); } });
    return () => { off = true; };
  }, [user]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  // El mensaje de error se borra apenas el profesional corrige algo.
  useEffect(() => { setError(''); }, [d, bank]);

  /** Guarda el borrador (y el banco, si corresponde). */
  const save = async (extra: Record<string, unknown> = {}, nextStep = step) => {
    const { db, fs } = await fb();
    const ref = fs.doc(db, 'providers', user.uid);
    await fs.setDoc(ref, {
      ...d,
      // Sin guardar categorías que ya no eligió.
      visitRates: Object.fromEntries(d.categories.filter((c) => d.visitRates[c]).map((c) => [c, d.visitRates[c]])),
      catEvidence: Object.fromEntries(d.categories.filter((c) => d.catEvidence[c]).map((c) => [c, d.catEvidence[c]])),
      // Firestore no acepta campos vacíos: solo los tarifas especiales que puso.
      surcharges: Object.fromEntries(Object.entries(d.surcharges).filter(([, v]) => typeof v === 'number')),
      // Firestore no acepta el régimen vacío: se omite hasta que lo elija.
      taxRegime: d.taxRegime || fs.deleteField(),
      uid: user.uid,
      status: extra.status ?? status,
      step: nextStep,
      updatedAt: fs.serverTimestamp(),
      ...(exists ? {} : { createdAt: fs.serverTimestamp() }),
      ...extra,
    }, { merge: true });
    setExists(true);
  };

  const go = async (to: number) => {
    setError('');
    if (to > step) {
      const msg = validate(step, d, bank);
      if (msg) { setError(msg); return; }
    }
    setSaving(true);
    try {
      await save({}, to);
      if (step === 4 && to > step) {
        const { db, fs } = await fb();
        await fs.setDoc(fs.doc(db, 'providers', user.uid, 'private', 'banco'), { ...bank, updatedAt: fs.serverTimestamp() });
      }
      setStep(to);
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      setError('No pudimos guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async (consents: { privacy: boolean; terms: boolean; truth: boolean }) => {
    setError('');
    if (!consents.privacy || !consents.terms || !consents.truth) { setError('Debes aceptar las tres declaraciones para enviar tu registro.'); return; }
    for (let s = 0; s < 5; s++) {
      const msg = validate(s, d, bank);
      if (msg) { setError(`${STEPS[s]}: ${msg}`); setStep(s); return; }
    }
    setSaving(true);
    try {
      const { fs } = await fb();
      await save({
        status: 'en_revision',
        submittedAt: fs.serverTimestamp(),
        consentPrivacy: true,
        privacyVersion: PRIVACY_VERSION,
        termsAccepted: true,
        // Mandato de cobro: HULUL cobra la visita en su nombre y le liquida cada semana.
        mandateAccepted: true,
      }, STEPS.length - 1);
      setStatus('en_revision');
      setEditing(false);
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      setError('No pudimos enviar tu registro. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="muted">Cargando tu registro…</p>;

  if (!editing && (status === 'en_revision' || status === 'aprobado' || status === 'rechazado' || status === 'suspendido')) {
    return (
      <div className="stack gap-24">
        <StatusCard status={status} name={d.firstName} user={user} onEdit={status === 'en_revision' ? () => { setEditing(true); setStep(0); } : undefined} />
        {status === 'aprobado' && <ServiceManager uid={user.uid} />}
      </div>
    );
  }

  return (
    <div className="stack gap-24" ref={top} style={{ scrollMarginTop: 90 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 13.5 }}>Conectado como {user.email ?? user.phoneNumber}</span>
        <button type="button" className="link-btn" onClick={logout}>Cerrar sesión</button>
      </div>
      {status === 'observado' && (
        <p className="notice"><strong>Revisamos tu registro y hay algo por corregir.</strong> Te escribimos por WhatsApp con el detalle. Corrígelo y vuelve a enviarlo.</p>
      )}
      {catStatus && d.categories.some((c) => catStatus[c] === 'observado' || catStatus[c] === 'rechazado') && (
        <p className="notice">
          {d.categories.filter((c) => catStatus[c] === 'observado' || catStatus[c] === 'rechazado').map((c) => `${getCategory(c)?.name}: ${CATEGORY_REVIEW_LABEL[catStatus[c]!].toLowerCase()}`).join(' · ')}. Revisa cómo demuestras que sabes hacer ese trabajo.
        </p>
      )}

      <Progress step={step} onPick={(i) => i < step && go(i)} />

      {step === 0 && <StepData d={d} set={set} />}
      {step === 1 && <StepServices d={d} setD={setD} uid={user.uid} />}
      {step === 2 && <StepZones d={d} set={set} />}
      {step === 3 && <StepDocs d={d} uid={user.uid} onUploaded={async (key, v) => {
        const next = { ...d, docs: { ...d.docs, [key]: v } };
        setD(next);
        const { db, fs } = await fb();
        await fs.setDoc(fs.doc(db, 'providers', user.uid), { docs: next.docs, uid: user.uid, status, updatedAt: fs.serverTimestamp(), ...(exists ? {} : { createdAt: fs.serverTimestamp() }) }, { merge: true });
        setExists(true);
      }} />}
      {step === 4 && <StepBank bank={bank} setBank={setBank} d={d} />}
      {step === 5 && <StepReview d={d} bank={bank} onSubmit={submit} saving={saving} />}

      {error && <p role="alert" className="form-error">{error}</p>}

      {step < 5 && (
        <div className="row gap-12" style={{ justifyContent: 'space-between' }}>
          {step > 0 ? <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => go(step - 1)}>Atrás</button> : <span />}
          <button type="button" className="btn btn-primary" style={{ minWidth: 160 }} disabled={saving} onClick={() => go(step + 1)}>
            {saving ? 'Guardando…' : 'Guardar y seguir'}
          </button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 13 }}>Tu avance se guarda en cada paso. Puedes salir y continuar después con la misma cuenta.</p>
    </div>
  );
}

/* ---------------------------- Validación ---------------------------- */

function validate(step: number, d: Draft, bank: Bank): string {
  if (step === 0) {
    if (d.firstName.trim().length < 2 || d.lastName.trim().length < 2) return 'Escribe tus nombres y apellidos.';
    if (!validCedula(d.cedula)) return 'La cédula no es válida. Revisa los 10 dígitos.';
    if (d.kind === 'empresa' && d.businessName.trim().length < 3) return 'Escribe el nombre de tu empresa.';
    if (d.kind === 'empresa' && !validRuc(d.ruc)) return 'El RUC de la empresa no es válido (13 dígitos que terminan en 001).';
    if (d.kind === 'persona' && !validRuc(d.ruc)) return 'El RUC es obligatorio para trabajar en HULUL (13 dígitos que terminan en 001). Si aún no lo tienes, sácalo gratis en SRI en línea.';
    if (d.kind === 'persona' && d.ruc.slice(0, 10) !== d.cedula) return 'Tu RUC debe ser tu número de cédula seguido de 001.';
    if (!e164Ecuador(d.phone)) return 'Escribe tu celular de 10 dígitos (09XXXXXXXX).';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return 'Escribe un correo válido.';
    if (!d.taxRegime) return 'Elige tu régimen en el SRI (lo ves en tu RUC). Si no lo sabes, revisa tu RUC en SRI en línea.';
  }
  if (step === 1) {
    if (!d.categories.length) return 'Elige al menos una categoría.';
    for (const c of d.categories) {
      const name = getCategory(c)?.name ?? c;
      if (!(d.services[c]?.length)) return `Marca qué trabajos haces en ${name}.`;
      const r = rateProblem(name, d.visitRates[c], c);
      if (r) return r;
      const ev = evidenceProblem(c, d.catEvidence[c]);
      if (ev) return `${name}: ${ev}`;
    }
    if (d.bio.trim().length < 30) return 'Cuéntales a los clientes tu experiencia (al menos 30 caracteres).';
  }
  if (step === 2) {
    if (!d.cities.length) return 'Elige al menos una ciudad donde trabajas.';
    if (!d.days.length) return 'Elige al menos un día de trabajo.';
    if (d.from >= d.to) return 'La hora de inicio debe ser antes de la hora de fin.';
    if (d.to > maxTo(d)) return `Tu horario debe terminar a más tardar a las ${maxTo(d)}.`;
    const off = offHoursProblem(d);
    if (off) return off;
  }
  if (step === 3) {
    const missing = requiredDocs(d.categories).filter((k) => !d.docs[k]);
    if (missing.length) return `Falta subir: ${missing.map((k) => PROVIDER_DOCS.find((x) => x.key === k)?.label).join(', ')}.`;
  }
  if (step === 4) {
    if (!bank.bank) return 'Elige tu banco.';
    if (!/^\d{6,20}$/.test(bank.number)) return 'Escribe el número de cuenta, solo dígitos.';
    if (bank.holder.trim().length < 3) return 'Escribe el nombre del titular de la cuenta.';
    if (!(validCedula(bank.holderId) || validRuc(bank.holderId))) return 'Escribe la cédula o RUC del titular.';
  }
  return '';
}

/* ---------------------------- Pasos ---------------------------- */

type SetField = <K extends keyof Draft>(k: K, v: Draft[K]) => void;

function StepData({ d, set }: { d: Draft; set: SetField }) {
  return (
    <section className="stack gap-16">
      <h2 className="fs-title">1. Tus datos</h2>
      <div className="seg" role="radiogroup" aria-label="Tipo de profesional">
        {([['persona', 'Persona'], ['empresa', 'Empresa']] as const).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={d.kind === v} className={d.kind === v ? 'on' : ''} onClick={() => set('kind', v)}>{l}</button>
        ))}
      </div>
      {d.kind === 'empresa' && (
        <Field id="biz" label="Nombre de la empresa">
          <input id="biz" value={d.businessName} maxLength={120} onChange={(e) => set('businessName', e.target.value)} />
        </Field>
      )}
      <div className="form-2">
        <Field id="fn" label={d.kind === 'empresa' ? 'Nombres del representante' : 'Nombres'}>
          <input id="fn" autoComplete="given-name" value={d.firstName} maxLength={60} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field id="ln" label="Apellidos">
          <input id="ln" autoComplete="family-name" value={d.lastName} maxLength={60} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
      </div>
      <div className="form-2">
        <Field id="ced" label="Cédula" hint={d.cedula.length === 10 ? (validCedula(d.cedula) ? '✓ Cédula válida' : 'Revisa los dígitos') : undefined}>
          <input id="ced" inputMode="numeric" maxLength={10} value={d.cedula} onChange={(e) => set('cedula', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field id="ruc" label={d.kind === 'empresa' ? 'RUC de la empresa' : 'RUC'} hint={d.kind === 'persona' ? 'Tu cédula + 001. Si no lo tienes, se saca gratis en SRI en línea.' : undefined}>
          <input id="ruc" inputMode="numeric" maxLength={13} value={d.ruc} onChange={(e) => set('ruc', e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
      <div className="form-2">
        <Field id="ph" label="Celular (WhatsApp)">
          <input id="ph" type="tel" inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXX" value={d.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field id="em" label="Correo">
          <input id="em" type="email" autoComplete="email" value={d.email} maxLength={160} onChange={(e) => set('email', e.target.value.trim())} />
        </Field>
      </div>
      <Field id="reg" label="Régimen en el SRI" hint={d.taxRegime ? TAX_REGIMES.find((r) => r.value === d.taxRegime)?.help : 'Aparece en tu RUC. Define si tu visita lleva IVA.'}>
        <select id="reg" value={d.taxRegime} onChange={(e) => set('taxRegime', e.target.value as TaxRegime)}>
          <option value="" disabled>Elige tu régimen</option>
          {TAX_REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <label className="check">
        <input type="checkbox" checked={d.eSignature} onChange={(e) => set('eSignature', e.target.checked)} />
        <span>Tengo firma electrónica. HULUL emitirá con ella la factura de cada visita a tu nombre, sin que hagas nada. Si no la tienes, puedes registrarte igual y sacarla después.</span>
      </label>
    </section>
  );
}

function StepServices({ d, setD, uid }: { d: Draft; setD: (fn: (x: Draft) => Draft) => void; uid: string }) {
  const toggleCat = (c: CategorySlug) => setD((x) => (x.categories.includes(c)
    ? { ...x, categories: x.categories.filter((y) => y !== c) }
    : { ...x, categories: [...x.categories, c] }));

  return (
    <section className="stack gap-16">
      <h2 className="fs-title">2. ¿Qué servicios ofreces?</h2>
      <p className="muted" style={{ fontSize: 14 }}>Elige todas las categorías que sabes hacer. En cada una pones tu <strong>tarifa por visita</strong> y demuestras que sabes hacerlo; cada categoría se aprueba por separado. Más adelante puedes sumar otras.</p>
      <div className="cat-grid pick-grid">
        {categories.map((c) => {
          const on = d.categories.includes(c.slug);
          return (
            <button key={c.slug} type="button" aria-pressed={on} className={`cat-tile pick ${on ? 'on' : ''}`} onClick={() => toggleCat(c.slug)}>
              <span className="cat-icon"><Icon name={c.icon} size={26} color={on ? '#fff' : '#685943'} /></span>
              <strong>{c.tileName ?? c.name}</strong>
            </button>
          );
        })}
      </div>

      {d.categories.length > 0 && (
        <div className="notice" style={{ fontSize: 13.5 }}>
          <strong>Cobras por visita, como un taxi.</strong> Tu tarifa cubre el traslado y el servicio (en arreglos, la revisión y lo que se resuelva en esa visita). Si hace falta más (materiales, más tiempo u otra visita), se lo propones al cliente en la app. HULUL retiene el {Math.round(POLICY.commission * 100)} % de la tarifa.
        </div>
      )}

      {d.categories.map((c) => {
        const cat = getCategory(c)!;
        return (
          <div key={c} className="card stack gap-12" style={{ padding: 18 }}>
            <strong style={{ fontSize: 17 }}>{cat.name}</strong>
            <ServicesPicker category={c} value={d.services[c] ?? []}
              onChange={(v) => setD((x) => ({ ...x, services: { ...x.services, [c]: v } }))} />
            <div className="form-2">
              <RateField category={c} uid={uid} value={d.visitRates[c]}
                onChange={(v) => setD((x) => ({ ...x, visitRates: { ...x.visitRates, [c]: v } }))} />
            </div>
            <EvidenceEditor category={c} uid={uid} value={d.catEvidence[c]}
              onChange={(v) => setD((x) => ({ ...x, catEvidence: { ...x.catEvidence, [c]: v } }))} />
          </div>
        );
      })}

      <div className="form-2">
        <Field id="yrs" label="Años de experiencia">
          <input id="yrs" type="text" inputMode="numeric" maxLength={2} value={d.years ? String(d.years) : ''}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').replace(/^0+/, ''); setD((x) => ({ ...x, years: v ? Number(v) : 0 })); }} />
        </Field>
      </div>
      <div className="stack gap-8">
        <span className="field-label">¿No sabes qué escribir? Elige una plantilla y edítala:</span>
        <div className="tag-row">
          {bioTemplates(d).map((t) => (
            <button key={t.label} type="button" className="tag" onClick={() => setD((x) => ({ ...x, bio: t.text.slice(0, 500) }))}>{t.label}</button>
          ))}
        </div>
      </div>
      <Field id="bio" label="Preséntate a los clientes" hint={`${d.bio.length}/500`}>
        <textarea id="bio" rows={4} maxLength={500} value={d.bio} placeholder="Ej.: Técnico en refrigeración con 10 años de experiencia. Trabajo con equipos inverter y llevo mis herramientas."
          onChange={(e) => setD((x) => ({ ...x, bio: e.target.value }))} />
      </Field>
    </section>
  );
}

function StepZones({ d, set }: { d: Draft; set: SetField }) {
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <section className="stack gap-16">
      <h2 className="fs-title">3. ¿Dónde y cuándo trabajas?</h2>
      <span className="field-label">Ciudades</span>
      <div className="tag-row">
        {ACTIVE_CITIES.map((c) => {
          const on = d.cities.includes(c.slug);
          return <button key={c.slug} type="button" aria-pressed={on} className={`tag ${on ? 'on' : ''}`} onClick={() => set('cities', toggle(d.cities, c.slug))}>{on && '✓ '}{c.name}</button>;
        })}
      </div>
      <span className="field-label">Días</span>
      <div className="tag-row">
        {[1, 2, 3, 4, 5, 6, 0].map((i) => {
          const on = d.days.includes(i);
          return <button key={i} type="button" aria-pressed={on} className={`tag ${on ? 'on' : ''}`} onClick={() => set('days', toggle(d.days, i).sort())}>{WEEKDAY_NAMES[i].slice(0, 3)}</button>;
        })}
      </div>
      <div className="form-2">
        <Field id="from" label="Desde">
          <select id="from" value={d.from} onChange={(e) => set('from', e.target.value)}>{HOURS.filter((h) => h >= '07:00' && h <= '17:00').map((h) => <option key={h}>{h}</option>)}</select>
        </Field>
        <Field id="to" label="Hasta">
          <select id="to" value={d.to} onChange={(e) => set('to', e.target.value)}>{HOURS.filter((h) => h >= '09:00' && h <= maxTo(d)).map((h) => <option key={h}>{h}</option>)}</select>
        </Field>
      </div>
      <div className="notice" style={{ fontSize: 13.5 }}>
        <strong>Horario normal de HULUL: 08:00 a 18:00.</strong> Las visitas en horario normal deben terminar a más tardar a las 18:00. Si quieres trabajar de noche o en feriados, actívalo abajo con tu tarifa completa.
      </div>
      <OffHoursEditor value={{ offHours: d.offHours, holidays: d.holidays, surcharges: d.surcharges }} noisy={d.categories.some(isNoisy)}
        onChange={(v) => { set('offHours', v.offHours); set('holidays', v.holidays); set('surcharges', v.surcharges); }} />
      <p className="muted" style={{ fontSize: 13.5 }}>Este es tu horario base. En la app podrás bloquear días puntuales, y al terminar cada trabajo marcarás &ldquo;Trabajo terminado&rdquo; para volver a estar disponible.</p>
      <label className="check">
        <input type="checkbox" checked={d.acceptsCash} onChange={(e) => set('acceptsCash', e.target.checked)} />
        <span><strong>Acepto pagos en efectivo.</strong> Si el cliente paga en efectivo, la comisión de HULUL y el cargo de plataforma quedan como saldo a tu cargo y se descuentan de tus próximos pagos. Si tu saldo pendiente pasa de $30, el efectivo se desactiva hasta que lo pagues.</span>
      </label>
    </section>
  );
}

function StepDocs({ d, uid, onUploaded }: { d: Draft; uid: string; onUploaded: (k: DocKey, v: { path: string; name: string }) => Promise<void> }) {
  const required = requiredDocs(d.categories);
  return (
    <section className="stack gap-16">
      <h2 className="fs-title">4. Documentos</h2>
      <p className="muted" style={{ fontSize: 14 }}>Solo el equipo de HULUL los ve, para verificar tu identidad. Fotos o PDF de hasta {MAX_DOC_MB} MB.</p>
      {PROVIDER_DOCS.map((spec) => (
        <DocUpload key={spec.key} spec={spec} uid={uid} required={required.includes(spec.key)} value={d.docs[spec.key]} onUploaded={onUploaded} />
      ))}
    </section>
  );
}

function DocUpload({ spec, uid, required, value, onUploaded }: {
  spec: ProviderDocSpec; uid: string; required: boolean; value?: { path: string; name: string };
  onUploaded: (k: DocKey, v: { path: string; name: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setErr('');
    if (file.size > MAX_DOC_MB * 1024 * 1024) { setErr(`El archivo pesa más de ${MAX_DOC_MB} MB.`); return; }
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) { setErr('Sube una foto o un PDF.'); return; }
    setBusy(true);
    try {
      const { storage, st } = await fb();
      const ext = (file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase().slice(0, 5);
      const path = `providers/${uid}/${spec.key}-${Date.now()}.${ext}`;
      await st.uploadBytes(st.ref(storage, path), file, { contentType: file.type });
      await onUploaded(spec.key, { path, name: file.name.slice(0, 120) });
    } catch {
      setErr('No se pudo subir. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`doc-row ${value ? 'done' : ''}`}>
      <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 15 }}>{spec.label} {required ? <span className="req">obligatorio</span> : <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(opcional)</span>}</strong>
        <span className="muted" style={{ fontSize: 13 }}>{value ? `✓ ${value.name}` : spec.help}</span>
        {err && <span className="form-error" style={{ fontSize: 13 }}>{err}</span>}
      </div>
      <label className={`btn ${value ? 'btn-ghost' : 'btn-primary'} doc-btn`} aria-busy={busy}>
        {busy ? 'Subiendo…' : value ? 'Cambiar' : spec.selfie ? 'Tomar foto' : 'Subir'}
        <input type="file" accept={spec.accept} {...(spec.selfie ? { capture: 'user' as const } : {})} disabled={busy}
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>
  );
}

function StepBank({ bank, setBank, d }: { bank: Bank; setBank: (b: Bank) => void; d: Draft }) {
  const set = <K extends keyof Bank>(k: K, v: Bank[K]) => setBank({ ...bank, [k]: v });
  return (
    <section className="stack gap-16">
      <h2 className="fs-title">5. ¿Dónde te pagamos?</h2>
      <p className="muted" style={{ fontSize: 14 }}>Te transferimos cada semana lo de tus trabajos pagados con tarjeta, menos la comisión y cualquier saldo pendiente. La cuenta debe estar a tu nombre{d.kind === 'empresa' ? ' o al de tu empresa' : ''}.</p>
      <Field id="bank" label="Banco o cooperativa">
        <select id="bank" value={bank.bank} onChange={(e) => set('bank', e.target.value)}>
          <option value="">Elige…</option>
          {BANKS_EC.map((b) => <option key={b}>{b}</option>)}
        </select>
      </Field>
      <div className="seg" role="radiogroup" aria-label="Tipo de cuenta">
        {([['ahorros', 'Ahorros'], ['corriente', 'Corriente']] as const).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={bank.type === v} className={bank.type === v ? 'on' : ''} onClick={() => set('type', v)}>{l}</button>
        ))}
      </div>
      <Field id="acc" label="Número de cuenta">
        <input id="acc" inputMode="numeric" maxLength={20} value={bank.number} onChange={(e) => set('number', e.target.value.replace(/\D/g, ''))} />
      </Field>
      <div className="form-2">
        <Field id="hold" label="Titular de la cuenta">
          <input id="hold" maxLength={120} value={bank.holder} placeholder={d.kind === 'empresa' ? d.businessName : `${d.firstName} ${d.lastName}`.trim()} onChange={(e) => set('holder', e.target.value)} />
        </Field>
        <Field id="hid" label="Cédula o RUC del titular">
          <input id="hid" inputMode="numeric" maxLength={13} value={bank.holderId} placeholder={d.cedula} onChange={(e) => set('holderId', e.target.value.replace(/\D/g, ''))} />
        </Field>
      </div>
    </section>
  );
}

function StepReview({ d, bank, onSubmit, saving }: { d: Draft; bank: Bank; onSubmit: (c: { privacy: boolean; terms: boolean; truth: boolean }) => void; saving: boolean }) {
  const [c, setC] = useState({ privacy: false, terms: false, truth: false });
  const name = d.kind === 'empresa' ? d.businessName : `${d.firstName} ${d.lastName}`;
  return (
    <section className="stack gap-16">
      <h2 className="fs-title">6. Revisa y envía</h2>
      <div className="card stack gap-8" style={{ padding: 18, fontSize: 14.5 }}>
        <Row k="Nombre" v={name} />
        <Row k="Cédula" v={d.cedula} />
        <Row k="Celular" v={d.phone} />
        <Row k="Servicios" v={d.categories.map((x) => `${getCategory(x)?.name} ($${d.visitRates[x]} por visita)`).join(' · ')} />
        <Row k="Ciudades" v={d.cities.map((x) => cities.find((y) => y.slug === x)?.name).join(', ')} />
        <Row k="Horario" v={`${d.days.map((i) => WEEKDAY_NAMES[i].slice(0, 3)).join(' ')} · ${d.from} a ${d.to}`} />
        <Row k="Fuera de horario" v={d.offHours.length ? `${[...d.offHours].sort((a, b) => ((a + 6) % 24) - ((b + 6) % 24)).map((h) => `${String(h).padStart(2, '0')}:00`).join(' ')} · tarifa completa $${d.surcharges.nocturno ?? 0}` : 'No'} />
        <Row k="Feriados" v={d.holidays ? `Sí · tarifa completa $${d.surcharges.feriado ?? 0}` : 'No'} />
        <Row k="Efectivo" v={d.acceptsCash ? 'Acepta' : 'No acepta'} />
        <Row k="Régimen SRI" v={d.taxRegime ? `${TAX_REGIME_LABEL[d.taxRegime]}${d.eSignature ? ' · con firma electrónica' : ''}` : 'Sin elegir'} />
        <Row k="Documentos" v={`${Object.keys(d.docs).length} subidos`} />
        <Row k="Cuenta" v={`${bank.bank} · ${bank.type} · ****${bank.number.slice(-4)}`} />
      </div>
      <div className="card stack gap-8" style={{ padding: 18 }}>
        <strong>Reglas del servicio que aceptas</strong>
        <ul className="stack gap-4" style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)', fontSize: 14 }}>
          <li>Cobras por visita: tu tarifa cubre ir, diagnosticar y arreglar lo que se resuelva en esa visita. Lo que haga falta después lo acuerdas con el cliente.</li>
          <li>HULUL retiene una comisión del 15 % de tu tarifa por visita (más IVA) y te entrega la factura de esa comisión cada semana.</li>
          <li>Autorizas a HULUL a cobrar en tu nombre lo que pagan los clientes con tarjeta y a emitir a tu nombre la factura de cada visita. Ese dinero es tuyo: HULUL lo retiene hasta que pasen las 48 horas para reclamos y te lo deposita cada semana, menos comisión, retenciones de ley, multas y lo que debas por cobros en efectivo.</li>
          <li>Acepta solo trabajos que sabes hacer. Al terminar dejas un resumen con fotos.</li>
          <li>Tolerancia de llegada: 15 minutos. Entre 15 y 30 minutos tarde, el cliente recibe un 10 % de descuento que se te descuenta.</li>
          <li>Más de 30 minutos tarde o cancelar con menos de 2 horas: multa de $5. No llegar sin avisar: multa de $10.</li>
          <li>3 faltas o cancelaciones tardías en 30 días: suspensión temporal.</li>
          <li>Los clientes te califican después de cada visita. Calificaciones bajas o reportes repetidos llevan a la suspensión.</li>
        </ul>
      </div>
      <label className="check"><input type="checkbox" checked={c.truth} onChange={(e) => setC({ ...c, truth: e.target.checked })} /><span>Declaro que los datos y documentos son verdaderos y me pertenecen.</span></label>
      <label className="check"><input type="checkbox" checked={c.terms} onChange={(e) => setC({ ...c, terms: e.target.checked })} /><span>Acepto los <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link> y las reglas del servicio de arriba.</span></label>
      <label className="check"><input type="checkbox" checked={c.privacy} onChange={(e) => setC({ ...c, privacy: e.target.checked })} /><span>Acepto la <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link> y que HULUL verifique mi identidad y antecedentes.</span></label>
      <button type="button" className="btn btn-primary" style={{ minHeight: 54, fontSize: 16 }} disabled={saving} onClick={() => onSubmit(c)}>
        {saving ? 'Enviando…' : 'Enviar mi registro a revisión'}
      </button>
    </section>
  );
}

/* ---------------------------- Estado ---------------------------- */

function StatusCard({ status, name, user, onEdit }: { status: ProviderStatus; name: string; user: User; onEdit?: () => void }) {
  const info: Record<string, { t: string; d: string; ok?: boolean }> = {
    en_revision: { t: `¡Listo${name ? `, ${name}` : ''}! Tu registro está en revisión`, d: 'Revisamos tus datos y documentos en 1 a 3 días hábiles. Te escribiremos por WhatsApp y correo con el resultado.', ok: true },
    aprobado: { t: '¡Ya estás en HULUL!', d: 'Tu perfil está publicado y los clientes pueden reservarte. En tu agenda aceptas las reservas, ves direcciones y marcas “Voy en camino”.', ok: true },
    rechazado: { t: 'No pudimos aprobar tu registro', d: 'Te escribimos por correo con el motivo. Si crees que es un error, contáctanos.' },
    suspendido: { t: 'Tu cuenta está suspendida', d: 'Te escribimos por correo con el motivo y los pasos para reactivarla.' },
  };
  const s = info[status];
  return (
    <div className="stack gap-16" role="status">
      <div className="card stack gap-12" style={{ alignItems: 'center', textAlign: 'center', padding: 32 }}>
        {s.ok && <span className="avatar" style={{ width: 64, height: 64, background: 'var(--success-soft)' }}><Icon name="check" size={32} color="var(--success)" strokeWidth={2.4} /></span>}
        <h2 style={{ fontSize: 24 }}>{s.t}</h2>
        <p style={{ color: 'var(--text-2)' }}>{s.d}</p>
        {status === 'aprobado' && (
          <div className="row gap-12" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/profesionales/agenda" className="btn btn-primary">Abrir mi agenda</Link>
            <Link href={`/profesional/${user.uid}`} className="btn btn-ghost">Ver mi perfil público</Link>
          </div>
        )}
      </div>
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 13.5 }}>Cuenta: {user.email ?? user.phoneNumber}</span>
        <div className="row gap-12">
          {onEdit && <button type="button" className="link-btn" onClick={onEdit}>Corregir mis datos</button>}
          <button type="button" className="link-btn" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Piezas ---------------------------- */

/** Hora máxima de fin según sus categorías (18:00; 20:00 en mascotas y urgentes). */
function maxTo(d: Draft): string {
  const h = d.categories.length ? Math.max(...d.categories.map((c) => maxEndHour(c))) : 18;
  return `${String(h).padStart(2, '0')}:00`;
}

/** Plantillas editables para "Preséntate a los clientes", con los datos que ya llenó. */
function bioTemplates(d: Draft): { label: string; text: string }[] {
  const cats = d.categories;
  const oficio = cats.length ? TRADE_NAME[cats[0]] : 'profesional';
  const areas = cats.map((c) => getCategory(c)?.name.toLowerCase()).filter(Boolean).join(', ') || 'servicios del hogar';
  const jobs = cats.flatMap((c) => d.services[c] ?? []).slice(0, 3).map((j) => j.toLowerCase());
  const jobsText = jobs.length ? jobs.join(', ') : areas;
  const years = d.years ? `${d.years} años` : 'varios años';
  const name = d.kind === 'empresa' ? d.businessName || 'nuestra empresa' : d.firstName || '';
  const cityText = d.cities.length ? d.cities.map((x) => cities.find((y) => y.slug === x)?.name).join(', ') : 'Guayaquil, Samborondón y Daule';
  if (d.kind === 'empresa') {
    return [
      { label: 'Empresa con experiencia', text: `Somos ${name}, un equipo dedicado a ${areas} con ${years} de experiencia. Hacemos ${jobsText}. Trabajamos con personal propio y herramientas profesionales.` },
      { label: 'Puntuales y ordenados', text: `En ${name} atendemos ${areas} en ${cityText}. Llegamos a la hora acordada, explicamos el trabajo antes de empezar y dejamos todo limpio. ${years} resolviendo ${jobsText}.` },
    ];
  }
  return [
    { label: 'Con experiencia', text: `Soy ${name}, ${oficio} con ${years} de experiencia. Me especializo en ${jobsText}. Llevo mis propias herramientas, soy puntual y dejo el área limpia.` },
    { label: 'Cercano y confiable', text: `Hola, soy ${name}. Me dedico a ${areas} hace ${years}. Te explico qué voy a hacer y cuánto toma antes de empezar, y te digo el precio antes de empezar cualquier trabajo extra. Atiendo en ${cityText}.` },
    { label: 'Corto y directo', text: `${oficio.charAt(0).toUpperCase() + oficio.slice(1)} con ${years} de experiencia: ${jobsText}. Puntual y ordenado.` },
  ];
}

function Progress({ step, onPick }: { step: number; onPick: (i: number) => void }) {
  return (
    <div className="stack gap-8">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 14 }}>Paso {step + 1} de {STEPS.length}: {STEPS[step]}</strong>
      </div>
      <div className="progress" aria-hidden>
        {STEPS.map((s, i) => <button key={s} type="button" tabIndex={-1} className={i <= step ? 'on' : ''} onClick={() => onPick(i)} />)}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="row gap-12" style={{ alignItems: 'flex-start' }}><span className="muted" style={{ width: 96, flexShrink: 0 }}>{k}</span><span>{v || '—'}</span></div>;
}


/** Teléfono +5939XXXXXXXX → 09XXXXXXXX. */
function localPhone(p: string | null): string {
  return p && p.startsWith('+593') ? `0${p.slice(4)}` : '';
}

/** Copia solo los campos del borrador desde Firestore. */
function pick(data: Record<string, unknown>): Partial<Draft> {
  const out: Partial<Draft> = {};
  for (const k of Object.keys(EMPTY) as (keyof Draft)[]) {
    if (data[k] !== undefined) (out as Record<string, unknown>)[k] = data[k];
  }
  return out;
}
