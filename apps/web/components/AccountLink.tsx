'use client';

import Link from 'next/link';
import { useUser } from '@/lib/auth';
import { Icon } from './Icon';

/** Acceso a la cuenta en la cabecera: "Ingresar" o el ícono de usuario. */
export function AccountLink() {
  const user = useUser();
  return (
    <Link href="/cuenta" className="nav-account" aria-label={user ? 'Mi cuenta' : 'Ingresar'}>
      <Icon name="user" size={22} strokeWidth={2} />
      <span className="nav-account-label">{user ? 'Mi cuenta' : 'Ingresar'}</span>
    </Link>
  );
}
