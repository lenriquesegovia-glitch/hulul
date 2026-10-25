'use client';
import {useRef,useState} from 'react';
import {searchServiceCities,serviceCity} from '@hulul/shared';
import {selectCity,useCity} from '@/lib/city';
export function CitySelector(){const city=useCity();const dialog=useRef<HTMLDialogElement>(null);const [q,setQ]=useState('');return <>
 <button className="city-trigger" onClick={()=>{setQ('');dialog.current?.showModal();}} aria-label={`Cambiar ciudad: ${serviceCity(city)?.name}`}>⌖ {serviceCity(city)?.name} ▾</button>
 <dialog ref={dialog} className="city-dialog" aria-labelledby="city-title"><div className="stack gap-16"><div className="row" style={{justifyContent:'space-between'}}><h2 id="city-title">¿Dónde necesitas el servicio?</h2><button className="btn btn-secondary" onClick={()=>dialog.current?.close()} aria-label="Cerrar">✕</button></div><p>Busca tu ciudad o cantón en Ecuador.</p><input autoFocus aria-label="Buscar ciudad o cantón" placeholder="Ciudad o provincia…" value={q} onChange={e=>setQ(e.target.value)}/><div className="city-results">{searchServiceCities(q).map(c=><button key={c.slug} className="city-option" aria-pressed={city===c.slug} onClick={()=>{selectCity(c.slug);dialog.current?.close();}}><strong>{c.name}</strong><small>{c.province}{city===c.slug?' · Seleccionada':''}</small></button>)}{!searchServiceCities(q).length&&<p>No encontramos esa ciudad. Prueba con el nombre del cantón.</p>}</div><small>La disponibilidad depende de los profesionales que atienden en tu ciudad.</small></div></dialog>
 </>;}

export function SelectedCityLabel(){const city=useCity();return <>Buscando servicios en {serviceCity(city)?.name || 'tu ciudad'}</>;}
