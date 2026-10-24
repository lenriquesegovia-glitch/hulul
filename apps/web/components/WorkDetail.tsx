'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {doc,onSnapshot} from 'firebase/firestore';
import {firestore,type ProBooking} from '@hulul/shared/firebase';
import {useUser} from '@/lib/auth';
import {BookingCard} from '@/app/profesionales/agenda/Agenda';
export function WorkDetail({id}:{id:string}) {
 const user=useUser();const [booking,setBooking]=useState<ProBooking|null|undefined>();
 useEffect(()=>{setBooking(undefined);if(!user)return;return onSnapshot(doc(firestore(),'bookings',id),s=>{const b=s.data();setBooking(b?.professionalId===user.uid?{...b,id:s.id} as ProBooking:null);},()=>setBooking(null));},[user,id]);
 if(user===null)return <Link className="btn btn-primary" href="/cuenta">Inicia sesión para ver este trabajo</Link>;
 if(booking===undefined)return <p>Cargando trabajo…</p>;
 if(!booking)return <p>No encontramos un trabajo de tu cuenta con este código.</p>;
 return <BookingCard b={booking} highlight/>;
}
