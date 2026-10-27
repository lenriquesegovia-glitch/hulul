'use client';

/**
 * Exportación a Excel (.xlsx) del panel. exceljs se carga solo al exportar.
 */

export interface SheetSpec {
  name: string;
  /** Texto arriba de la tabla (empresa, periodo, aclaraciones). */
  title?: string[];
  columns: { key: string; header: string; width?: number; money?: boolean; text?: boolean }[];
  rows: Record<string, string | number | null | undefined>[];
  /** Columnas que se suman al final. */
  totals?: string[];
}

/** Arma el libro de Excel y devuelve sus bytes. */
export async function buildXlsx(sheets: SheetSpec[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HULUL'; wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    let r = 1;
    for (const t of s.title ?? []) { ws.getCell(r, 1).value = t; ws.getCell(r, 1).font = { bold: r === 1, size: r === 1 ? 13 : 10 }; r += 1; }
    if (s.title?.length) r += 1;
    const head = ws.getRow(r);
    s.columns.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123F43' } };
      ws.getColumn(i + 1).width = c.width ?? Math.max(10, Math.min(40, c.header.length + 4));
    });
    const first = r + 1;
    for (const row of s.rows) {
      r += 1;
      const xr = ws.getRow(r);
      s.columns.forEach((c, i) => {
        const v = row[c.key];
        const cell = xr.getCell(i + 1);
        cell.value = v === undefined || v === null ? null : c.text ? String(v) : v;
        if (c.money) cell.numFmt = '#,##0.00';
      });
    }
    if (s.totals?.length && s.rows.length) {
      r += 1;
      const tr = ws.getRow(r);
      tr.getCell(1).value = 'TOTAL'; tr.font = { bold: true };
      s.columns.forEach((c, i) => {
        if (!s.totals!.includes(c.key)) return;
        const col = ws.getColumn(i + 1).letter;
        tr.getCell(i + 1).value = { formula: `SUM(${col}${first}:${col}${r - 1})` };
        tr.getCell(i + 1).numFmt = '#,##0.00';
      });
    }
    ws.views = [{ state: 'frozen', ySplit: first - 1 }];
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadXlsx(fileName: string, sheets: SheetSpec[]) {
  const buf = await buildXlsx(sheets);
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Atajo para una sola hoja con las mismas filas y columnas que antes iban a CSV. */
export function xlsxFromRows(fileName: string, sheet: string, rows: Record<string, string | number | null | undefined>[], columns: { key: string; label: string }[], opts?: { money?: string[]; text?: string[]; title?: string[] }) {
  return downloadXlsx(fileName, [{
    name: sheet, title: opts?.title,
    columns: columns.map((c) => ({ key: c.key, header: c.label, money: opts?.money?.includes(c.key), text: opts?.text?.includes(c.key) })),
    rows, totals: opts?.money,
  }]);
}

/** Bytes → base64 (para enviar el archivo por correo desde el servidor). */
export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
