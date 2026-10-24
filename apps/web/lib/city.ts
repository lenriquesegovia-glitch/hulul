'use client';
import {useSyncExternalStore} from 'react';
import {serviceCity} from '@hulul/shared';
const key='hulul.city';
const subscribe=(cb:()=>void)=>{window.addEventListener('hulul-city',cb);window.addEventListener('storage',cb);return()=>{window.removeEventListener('hulul-city',cb);window.removeEventListener('storage',cb);};};
const snapshot=()=>{try{const v=localStorage.getItem(key)||'';return serviceCity(v)?v:'guayaquil';}catch{return 'guayaquil';}};
export function useCity(){return useSyncExternalStore(subscribe,snapshot,()=> 'guayaquil');}
export function selectCity(slug:string){if(!serviceCity(slug))return;try{localStorage.setItem(key,slug);}catch{}window.dispatchEvent(new Event('hulul-city'));}
