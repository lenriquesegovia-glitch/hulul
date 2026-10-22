/** HULUL · Fase 3. Petróleo y superficies cálidas. */
export const brand = {
  name: 'HULUL',
  tagline: 'Soluciones para tu día',
  domain: 'hululec.com',
  colors: {
    "background": "#FAF8F3",
    "surface": "#FFFFFF",
    "surfaceWarm": "#F1EADF",
    "border": "#D5DDD9",
    "text": "#182D2E",
    "textSecondary": "#3E5553",
    "textMuted": "#536260",
    "primary": "#123F43",
    "primaryDark": "#0B2F33",
    "copper": "#685943",
    "copperSoft": "#E8DFCF",
    "success": "#206344",
    "successSoft": "#E6F2E9",
    "onPrimary": "#FFFFFF",
    "danger": "#B42318"
},
  fonts: { display: 'Manrope', body: 'Manrope' },
} as const;

export type BrandColors = typeof brand.colors;
