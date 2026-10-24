import Link from 'next/link';
import {WorkDetail} from '@/components/WorkDetail';
export default async function Work({params}:{params:Promise<{id:string}>}){const {id}=await params;return <div className="container section stack gap-16"><Link href="/profesionales/agenda">← Mi agenda</Link><h1>Detalle del trabajo</h1><WorkDetail id={id}/></div>;}
