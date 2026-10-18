import type { Metadata } from 'next';
import { ProProfile } from './ProProfile';

type Params = { id: string };

export const metadata: Metadata = { title: 'Profesional verificado', robots: { index: false } };

export default async function ProfessionalPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return <ProProfile id={id} />;
}
