'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Icon} from './Icon';
import {useUser} from '@/lib/auth';
import {watchInbox,readInboxItem,type InboxItem} from '@hulul/shared/firebase';
export function Inbox({page=false}:{page?:boolean}) {
 const user=useUser();const [items,setItems]=useState<InboxItem[]>([]);const [error,setError]=useState(false);const [loaded,setLoaded]=useState(false);
 useEffect(()=>{setItems([]);setLoaded(false);setError(false);if(!user)return;return watchInbox(user.uid,list=>{setItems(list);setLoaded(true);},()=>setError(true));},[user]);
 const count=items.filter(x=>!x.read).length;
 if(!page)return <Link href="/notificaciones" className="btn btn-secondary nav-inbox" aria-label={`Notificaciones, ${count} sin leer`} style={{minWidth:48,padding:10}}><Icon name="bell" size={20}/>{count ? <span>{count}</span> : <span className="inbox-label">Avisos</span>}</Link>;
 if(!user)return <p><Link href="/cuenta">Inicia sesión para ver tus notificaciones.</Link></p>;
 return <div className="stack gap-12">{error?<p role="alert">No pudimos cargar los avisos. Recarga para intentar de nuevo.</p>:!loaded?<p>Cargando avisos…</p>:!items.length?<p>Aquí aparecerán tus avisos de reservas, horarios y mensajes.</p>:items.map(n=>{
 const id=n.data.bookingId;const href=id?(n.data.to==='pro'?`/profesionales/agenda/reserva/${encodeURIComponent(id)}${n.data.chat?'?chat=1':''}`:`/cuenta/reserva/${id}${n.data.chat?'#chat':''}`):(n.data.to==='pro'?'/profesionales/agenda':'/cuenta');
 return <Link key={n.id} href={href} className="card stack gap-8" onClick={()=>readInboxItem(user.uid,n.id).catch(()=>{})} style={{borderLeft:`4px solid ${n.read?'var(--border)':'var(--primary)'}`}}><strong>{!n.read?'● ':''}{n.title}</strong><span>{n.body}</span><small>{n.createdAt?.toDate().toLocaleString('es-EC',{timeZone:'America/Guayaquil'})} · Ver detalle →</small></Link>;
 })}</div>;
}
