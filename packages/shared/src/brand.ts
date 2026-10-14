/** Identidad visual de HULUL, tomada del logotipo (crema, vino tinto y cobre). */
export const brand = {
  name: 'HULUL',
  tagline: 'Servicios del hogar',
  domain: 'hululapp.com',
  colors: {
    background: '#FAF7F2',
    surface: '#FFFFFF',
    surfaceWarm: '#F6EDE6',
    border: '#E7DFD5',
    text: '#1C1A1A',
    textSecondary: '#3F3A37',
    textMuted: '#6B6560',
    primary: '#7A1E2C',
    primaryDark: '#5C1622',
    copper: '#9A5B34',
    copperSoft: '#F3E6DC',
    success: '#1F7A4A',
    successSoft: '#E3F2E8',
    onPrimary: '#FFFFFF',
  },
  fonts: {
    display: 'Montserrat',
    body: 'Manrope',
  },
} as const;

export type BrandColors = typeof brand.colors;
