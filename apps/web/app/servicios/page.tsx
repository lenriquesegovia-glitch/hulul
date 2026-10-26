import Link from 'next/link';
import { PhotoGrid } from '@/components/PhotoGrid';
import '@/components/home-intro.css';
export default function ServicesPage(){return <main className="hulul-home"><section className="hh-catalog"><Link href="/" className="btn btn-ghost">← Volver al inicio</Link><p style={{marginTop:24}}>ELIGE TU SERVICIO</p><h1>¿En qué te ayudamos?</h1><p>19 categorías para resolver tu día. Toca una para ver sus servicios.</p><PhotoGrid/><p className="hh-photo-note">Fotos de referencia</p></section></main>}
