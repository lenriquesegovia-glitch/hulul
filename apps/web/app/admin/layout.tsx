import type { Metadata } from 'next';
import { AdminShell } from './AdminShell';

export const metadata: Metadata = { title: 'Administración · HULUL', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
