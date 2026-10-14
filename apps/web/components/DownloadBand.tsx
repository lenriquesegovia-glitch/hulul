import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/site';

export function DownloadBand({ title = 'Reserva desde la web o desde la app' }: { title?: string }) {
  return (
    <section id="descargar" className="section-sm">
      <div className="container">
        <div className="band stack gap-16">
          <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)' }}>{title}</h2>
          <p style={{ maxWidth: 580 }}>
            Puedes reservar aquí mismo, desde tu computadora o tu celular, sin instalar nada. Si prefieres, la app de HULUL te avisa cuando el profesional va en camino y guarda tu historial.
          </p>
          <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
            <a href={APP_STORE_URL} className="btn btn-ghost">Descargar en App Store</a>
            <a href={PLAY_STORE_URL} className="btn btn-ghost">Descargar en Google Play</a>
          </div>
        </div>
      </div>
    </section>
  );
}
