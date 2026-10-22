import { icons, type UiIconName } from '@hulul/shared';
import { Icon } from './Icon';

/** Dibuja un ícono compartido dentro del SVG grande, en la posición y tamaño indicados. */
function SvgIcon({ name, x, y, size, color, stroke = 1.6 }: { name: UiIconName; x: number; y: number; size: number; color: string; stroke?: number }) {
  const k = size / 24;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {icons[name].map((s, i) => {
        if (s.kind === 'path') return <path key={i} d={s.d} />;
        if (s.kind === 'circle') return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />;
        return <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />;
      })}
    </g>
  );
}

const rooms: { name: UiIconName; label: string; x: number; y: number }[] = [
  { name: 'snow', label: 'Climatización', x: 195, y: 205 },
  { name: 'sparkle', label: 'Limpieza', x: 325, y: 205 },
  { name: 'drop', label: 'Plomería', x: 195, y: 320 },
  { name: 'bolt', label: 'Electricidad', x: 325, y: 320 },
];

/**
 * Ilustración de la portada: la casa del logo con servicios en cada ambiente
 * y tarjetas que muestran el funcionamiento de la plataforma.
 * Decorativa: el contenido real está en el texto de la portada.
 */
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 520 440" width="100%" height="100%">
        <circle cx="260" cy="240" r="200" fill="#E8DFCF" />
        <circle cx="260" cy="240" r="150" fill="#F1EADF" />

        {/* Casa */}
        <path d="M112 168 L260 52 L408 168" fill="none" stroke="#123F43" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="128" y="150" width="264" height="232" rx="14" fill="#FFFFFF" stroke="#D5DDD9" strokeWidth="2" />
        <line x1="260" y1="150" x2="260" y2="382" stroke="#D5DDD9" strokeWidth="2" />
        <line x1="128" y1="266" x2="392" y2="266" stroke="#D5DDD9" strokeWidth="2" />
        <rect x="350" y="70" width="22" height="48" rx="3" fill="#685943" />

        {/* Ambientes con servicios */}
        {rooms.map((r) => (
          <g key={r.label}>
            <circle cx={r.x} cy={r.y - 10} r="30" fill="#E8DFCF" />
            <SvgIcon name={r.name} x={r.x} y={r.y - 10} size={30} color="#685943" stroke={1.8} />
            <text x={r.x} y={r.y + 40} textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="700" fontSize="13" fill="#3E5553">{r.label}</text>
          </g>
        ))}

        {/* Suelo */}
        <line x1="70" y1="384" x2="450" y2="384" stroke="#D6CBBE" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="hero-chip hero-chip-top">
        <span className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>CM</span>
        <span className="stack">
          <strong style={{ fontSize: 14 }}>Carlos va en camino</strong>
          <span className="muted" style={{ fontSize: 12.5 }}>Llega en 15 min</span>
        </span>
      </div>
      <div className="hero-chip hero-chip-left">
        <span style={{ color: '#685943', fontSize: 16 }}>★</span>
        <strong style={{ fontSize: 14 }}>4,9</strong>
        <span className="muted" style={{ fontSize: 12.5 }}>· 128 reseñas</span>
      </div>
      <div className="hero-chip hero-chip-bottom">
        <span className="hero-chip-icon"><Icon name="shield" size={18} color="#1F7A4A" strokeWidth={2} /></span>
        <span className="stack">
          <strong style={{ fontSize: 14 }}>Pago protegido</strong>
          <span className="muted" style={{ fontSize: 12.5 }}>Se libera cuando apruebas</span>
        </span>
      </div>
    </div>
  );
}
