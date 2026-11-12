import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4 = { width: 595.28, height: 841.89 };

export interface ReceiptData {
  receipt_no: string;
  tanggal: string;
  nama: string;
  registration_number: string;
  program_keahlian: string;
  gelombang: string;
  items: Array<{ nama: string; nominal: number }>;
  total: number;
  metode: string;
  receiver: string;
  school_name: string;
  school_address: string;
}

export async function generateReceipt(data: ReceiptData, logoPng?: Buffer | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.width, A4.height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const t = (s: string, x: number, y: number, size = 10, f = font) =>
    page.drawText(s, { x, y, size, font: f, color: rgb(0, 0, 0) });
  const tc = (s: string, y: number, size = 10, f = font) => {
    const w = f.widthOfTextAtSize(s, size);
    t(s, (A4.width - w) / 2, y, size, f);
  };
  const money = (n: number) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

  if (logoPng) {
    try {
      const img = await doc.embedPng(logoPng);
      page.drawImage(img, { x: A4.width / 2 - 25, y: A4.height - 70, width: 50, height: 50 });
    } catch { /* ignore */ }
  }
  tc(data.school_name, A4.height - 90, 14, bold);
  tc(data.school_address, A4.height - 104, 9);
  tc('BUKTI PEMBAYARAN SPMB', A4.height - 126, 12, bold);
  tc(`No. Bukti: ${data.receipt_no}`, A4.height - 140, 9);

  let y = A4.height - 170;
  t(`Tanggal`, 60, y); t(`: ${data.tanggal}`, 160, y); y -= 15;
  t(`Nama`, 60, y); t(`: ${data.nama}`, 160, y); y -= 15;
  t(`No. Pendaftaran`, 60, y); t(`: ${data.registration_number}`, 160, y); y -= 15;
  t(`Program Keahlian`, 60, y); t(`: ${data.program_keahlian}`, 160, y); y -= 15;
  t(`Gelombang`, 60, y); t(`: ${data.gelombang}`, 160, y); y -= 20;

  page.drawRectangle({ x: 60, y: y - 4, width: 475, height: 18, color: rgb(0.9, 0.93, 1) });
  t('Rincian Biaya', 66, y, 10, bold);
  t('Nominal', 440, y, 10, bold);
  y -= 20;
  for (const it of data.items) {
    t(it.nama, 70, y);
    t(money(it.nominal), 535 - font.widthOfTextAtSize(money(it.nominal), 10), y);
    y -= 16;
  }
  page.drawLine({ start: { x: 60, y: y - 2 }, end: { x: 535, y: y - 2 }, thickness: 0.8 });
  y -= 16;
  t('TOTAL', 70, y, 11, bold);
  t(money(data.total), 535 - bold.widthOfTextAtSize(money(data.total), 11), y, 11, bold);
  y -= 25;
  t(`Metode: ${data.metode}`, 70, y); y -= 15;
  t(`Penerima: ${data.receiver}`, 70, y); y -= 50;

  t('Pembayar,', 70, y);
  t('Bendahara Panitia,', 370, y);
  page.drawLine({ start: { x: 70, y: y - 40 }, end: { x: 190, y: y - 40 }, thickness: 0.7 });
  page.drawLine({ start: { x: 370, y: y - 40 }, end: { x: 490, y: y - 40 }, thickness: 0.7 });

  return doc.save();
}
