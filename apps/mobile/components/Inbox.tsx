import {Icon} from './Icon';
import {useEffect,useState} from 'react';
import {Pressable,View} from 'react-native';
import {router} from 'expo-router';
import {watchInbox,readInboxItem,type InboxItem} from '@hulul/shared/firebase';
import {useUser} from '@/lib/auth';
import {Body,Card} from './ui';
import {c} from '@/theme';
export function Inbox({page=false}:{page?:boolean}) {
 const user=useUser();const [items,setItems]=useState<InboxItem[]>([]);const [error,setError]=useState(false);const [loaded,setLoaded]=useState(false);
 useEffect(()=>{setItems([]);setLoaded(false);setError(false);if(!user)return;return watchInbox(user.uid,list=>{setItems(list);setLoaded(true);},()=>setError(true));},[user]);
 const count=items.filter(x=>!x.read).length;
 if(!page)return <Pressable accessibilityRole="button" accessibilityLabel={`Notificaciones, ${count} sin leer`} onPress={()=>router.push('/notificaciones')} style={{minHeight:48,justifyContent:'center',padding:10,borderWidth:1,borderColor:c.border,borderRadius:14}}><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Icon name="bell" size={20}/>{count>0&&<Body>{count}</Body>}</View></Pressable>;
 if(!user)return <Pressable onPress={()=>router.push('/cuenta')}><Body>Inicia sesión para ver tus notificaciones →</Body></Pressable>;
 return <View style={{gap:12}}>{error?<Body>No pudimos cargar los avisos. Vuelve a entrar para reintentar.</Body>:!loaded?<Body>Cargando avisos…</Body>:!items.length?<Body>Aquí aparecerán tus avisos de reservas, horarios y mensajes.</Body>:items.map(n=><Pressable key={n.id} accessibilityRole="button" onPress={()=>{readInboxItem(user.uid,n.id).catch(()=>{});const id=n.data.bookingId;if(id)router.push({pathname:n.data.to==='pro'?'/agenda/[id]':'/reserva/[id]',params:{id,aviso:n.title,mensaje:n.body,chat:n.data.chat?'1':''}});else router.push(n.data.to==='pro'?'/agenda':'/cuenta');}}><Card style={{borderLeftWidth:4,borderLeftColor:n.read?c.border:c.primary}}><Body>{!n.read?'● ':''}{n.title}</Body><Body muted>{n.body}</Body><Body muted style={{fontSize:12}}>{n.createdAt?.toDate().toLocaleString('es-EC')} · Ver detalle →</Body></Card></Pressable>)}</View>;
}
