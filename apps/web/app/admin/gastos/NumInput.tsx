'use client';

import { useEffect, useState } from 'react';

/** Campo de dinero: deja escribir «12,» o «12.5» sin perder lo tecleado; entrega el número. */
export function NumInput({ value, onChange, ...rest }: { value: number | undefined; onChange: (n: number | undefined) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value === undefined || value === 0 ? '' : String(value).replace('.', ','));
  useEffect(() => {
    const cur = text === '' ? undefined : Number(text.replace(',', '.'));
    if (cur !== value && !(cur === undefined && !value)) setText(value === undefined || value === 0 ? '' : String(value).replace('.', ','));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input {...rest} className="adm-input" inputMode="decimal" value={text} onChange={(e) => {
    const t = e.target.value.replace(/[^\d.,]/g, ''); setText(t);
    const n = Number(t.replace(',', '.')); onChange(t === '' ? undefined : Number.isFinite(n) ? n : undefined);
  }} />;
}

