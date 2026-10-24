'use client';
import {useEffect,useState} from 'react';
import {loadClientSummary,type ClientSummaryData} from '@hulul/shared/firebase';
export function ClientSummary({bookingId}:{bookingId:string}) {
 const [data,setData]=useState<ClientSummaryData|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;loadClientSummary(bookingId).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[bookingId]);
 return <div className="notice" aria-label="Información del cliente"><strong>{data?.name || 'Tu cliente'}</strong><p>{error?'No pudimos cargar las calificaciones.':!data?'Cargando calificaciones…':data.count?`★ ${data.rating} · ${data.count} calificaciones de profesionales`:'Cliente nuevo · Sin calificaciones'}</p></div>;
}
