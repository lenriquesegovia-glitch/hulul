import {useEffect,useState} from 'react';
import {loadClientSummary,type ClientSummaryData} from '@hulul/shared/firebase';
import {Body,Card} from './ui';
export function ClientSummary({bookingId}:{bookingId:string}) {
 const [data,setData]=useState<ClientSummaryData|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;loadClientSummary(bookingId).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[bookingId]);
 return <Card><Body>{data?.name || 'Tu cliente'}</Body><Body muted>{error?'No pudimos cargar las calificaciones.':!data?'Cargando calificaciones…':data.count?`★ ${data.rating} · ${data.count} calificaciones de profesionales`:'Cliente nuevo · Sin calificaciones'}</Body></Card>;
}
