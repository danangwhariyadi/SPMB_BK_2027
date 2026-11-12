import ExcelJS from 'exceljs';

export async function exportExcel(
  sheetName: string,
  header: string[],
  rows: Array<Array<string | number | null>>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.columns = header.map(h => ({ header, width: Math.max(14, Math.min(40, h.length + 6)) }));
  const headRow = ws.getRow(1);
  headRow.font = { bold: true };
  headRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  headRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
