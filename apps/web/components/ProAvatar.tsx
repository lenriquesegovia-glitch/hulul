'use client';
import { useState } from 'react';
export function ProAvatar({name,initials,photoUrl,size=52}:{name:string;initials:string;photoUrl?:string;size?:number}) {
  const [failed,setFailed]=useState(false);
  return photoUrl && !failed ? <img src={photoUrl} alt={`Foto de ${name}`} width={size} height={size} onError={()=>setFailed(true)} style={{borderRadius:'50%',objectFit:'cover',flexShrink:0}}/> : <span className="avatar" aria-label={name} style={{width:size,height:size,fontSize:size*.32,flexShrink:0}}>{initials}</span>;
}
