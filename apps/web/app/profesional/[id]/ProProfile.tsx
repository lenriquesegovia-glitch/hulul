'use client';

import Link from 'next/link';
import { formatPrice, formatRating, getCategory, proHref } from '@hulul/shared';
import { DownloadBand } from '@/components/DownloadBand';
import { Icon } from '@/components/Icon';
import { usePro } from '@/lib/pros';
import { ReviewsList } from '@/components/Rating';

/** Ficha pública de un profesional aprobado (se lee de `pros/{uid}`). */
export function ProProfile({ id }: { id: string }) {
  const pro = usePro(id);

  if (pro === undefined) return <section className="section-sm"><div className="container"><p className="muted">Cargando…</p></div></section>;
  if (!pro) {
    return (
      <section className="section-sm">
        <div className="container card stack gap-12" style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 24 }}>Este profesional no está disponible</h1>
          <p className="muted">Puede que aún esté en revisión o que ya no atienda por HULUL.</p>
          <Link href="/" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Ver servicios</Link>
        </div>
      </section>
    );
  }
  const cat = getCategory(pro.category)!;
  const book = proHref('reservar', pro);
  const jobs = pro.services?.length ? pro.services : cat.servicios;

  return (
    <>
      <section className="section-sm">
        <div className="container stack gap-24" style={{ maxWidth: 880 }}>
          <nav className="breadcrumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span>/</span>
            <Link href={`/servicios/${cat.slug}`}>{cat.name}</Link><span>/</span>
            <span>{pro.name}</span>
          </nav>

          <div className="row gap-24" style={{ flexWrap: 'wrap' }}>
            <span className="avatar" style={{ width: 96, height: 96, fontSize: 30 }}>{pro.initials}</span>
            <div className="stack gap-8">
              <h1 className="row gap-8" style={{ fontSize: 32 }}>
                {pro.name}
                <Icon name="shield" size={24} color="#9A5B34" label="Verificado" />
              </h1>
              <p className="muted">{cat.name} · {pro.zone}{pro.isCompany ? ' · Perfil empresa' : ''}</p>
              {pro.availableToday && <span className="pill pill-success" style={{ alignSelf: 'flex-start' }}>Atiende hoy{pro.hours ? ` · ${pro.hours}` : ''}</span>}
            </div>
          </div>

          {(pro.categories?.length ?? 0) > 1 && (
            <div className="link-cloud">
              {pro.categories!.map((c) => (
                <Link key={c} href={proHref('profesional', { id: pro.id, category: c })} aria-current={c === pro.category ? 'page' : undefined}
                  className={c === pro.category ? 'on' : ''}>{getCategory(c)?.name}</Link>
              ))}
            </div>
          )}

          <Link href={book} className="btn btn-primary" style={{ alignSelf: 'flex-start', minHeight: 52, fontSize: 16 }}>
            Reservar ahora · {formatPrice(pro.visitRate)} por visita
          </Link>

          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="price">{pro.reviewCount > 0 ? `★ ${formatRating(pro.rating)}` : 'Nuevo'}</div>
              <div className="muted">{pro.reviewCount > 0 ? `${pro.reviewCount} reseñas` : 'en HULUL'}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">{pro.jobsDone}</div><div className="muted">servicios</div></div>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">{pro.years}</div><div className="muted">años de experiencia</div></div>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">{formatPrice(pro.visitRate)}</div><div className="muted">por visita</div></div>
          </div>

          {pro.bio && (
            <div className="stack gap-8">
              <h2 style={{ fontSize: 22 }}>Sobre {pro.isCompany ? 'nosotros' : 'mí'}</h2>
              <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{pro.bio}</p>
            </div>
          )}

          <div className="stack gap-8">
            <h2 style={{ fontSize: 22 }}>Trabajos que realiza</h2>
            <div className="link-cloud">
              {jobs.map((s) => <span key={s} className="pill pill-warm">{s}</span>)}
            </div>
          </div>

          <div className="stack gap-8">
            <h2 style={{ fontSize: 22 }}>Precio</h2>
            <p style={{ margin: 0, color: 'var(--text-2)' }}><strong>{formatPrice(pro.visitRate)}</strong> por visita, con el traslado incluido. Si quieres algo más, te lo propone en la app y tú decides.</p>
          </div>

          <div className="stack gap-12">
            <h2 style={{ fontSize: 22 }}>Reseñas</h2>
            <ReviewsList uid={pro.id} first={pro.name.split(' ')[0]} />
          </div>
        </div>
      </section>
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 880 }}>
          <Link href={book} className="btn btn-primary" style={{ width: '100%', minHeight: 54, fontSize: 16 }}>
            Reservar a {pro.name}
          </Link>
        </div>
      </section>
      <DownloadBand />
    </>
  );
}
