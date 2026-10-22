import Link from 'next/link';
import { logoHorizontalPaths, logoHorizontalViewBox } from '@hulul/shared';

export function Logo() {
  return <Link href="/" className="logo" aria-label="HULUL, ir al inicio">
    <svg className="brand-lockup" viewBox={logoHorizontalViewBox} width="176" height="52" fill="currentColor" aria-hidden="true">
      {logoHorizontalPaths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  </Link>;
}
