import {useEffect,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {serviceCity} from '@hulul/shared';
let current='guayaquil';let ready=false;const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(f=>f());
const init=AsyncStorage.getItem('hulul.city').then(v=>{if(v&&serviceCity(v))current=v;}).catch(()=>{}).finally(()=>{ready=true;emit();});
export async function selectCity(slug:string){await init;if(!serviceCity(slug))return;current=slug;emit();await AsyncStorage.setItem('hulul.city',slug).catch(()=>{});}
export function useCity(){const [value,setValue]=useState({city:current,ready});useEffect(()=>{const sync=()=>setValue({city:current,ready});listeners.add(sync);sync();return()=>{listeners.delete(sync);};},[]);return value;}
