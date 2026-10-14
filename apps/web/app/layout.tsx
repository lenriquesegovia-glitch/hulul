import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Hulul | Multiservicios Profesionales a Domicilio en Ecuador',
    template: '%s | Hulul',
  },
  description:
    'Reserva técnicos de aire acondicionado, plomeros, electricistas, limpieza, belleza y más a domicilio en Guayaquil, Samborondón y Daule. Precio por hora visible, profesionales verificados y pago protegido.',
  applicationName: 'HULUL',
  openGraph: {
    type: 'website',
    locale: 'es_EC',
    siteName: 'HULUL',
  },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap"
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
