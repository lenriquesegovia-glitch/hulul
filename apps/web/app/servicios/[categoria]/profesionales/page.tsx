import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getCategory,serviceCities} from '@hulul/shared';
import {ServicePicker} from '@/components/ServicePicker';
export default async function Professionals({params,searchParams}:{params:Promise<{categoria:string}>;searchParams:Promise<{trabajo?:string;ciudad?:string}>}){
 const {categoria}=await params;const query=await searchParams;const cat=getCategory(categoria);if(!cat)notFound();
 const city=serviceCities.find(c=>c.slug===query.ciudad);
 return <main className="section-sm"><div className="container stack gap-24"><Link className="btn btn-ghost" style={{alignSelf:'flex-start'}} href={`/servicios/${cat.slug}`}>← Cambiar servicio</Link><h1>Elige a tu profesional</h1><p className="muted">Revisa su perfil, precio y horario antes de reservar.</p><ServicePicker cat={cat} city={city?.slug} cityName={city?.name} initialJob={query.trabajo} providersOnly/></div></main>
}
