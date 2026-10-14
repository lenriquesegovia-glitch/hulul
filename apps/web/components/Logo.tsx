import Link from 'next/link';
import { Icon } from './Icon';

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="HULUL, ir al inicio">
      <Icon name="logo" size={34} color="#9A5B34" />
      <span className="stack">
        <span className="logo-word">HULUL</span>
        <span className="logo-sub">SERVICIOS DEL HOGAR</span>
      </span>
    </Link>
  );
}
