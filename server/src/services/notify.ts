import { config } from '../config';

export const notifyStatus = () => ({
  whatsapp: Boolean(config.notify.whatsappApiUrl && config.notify.whatsappToken),
  email: Boolean(config.notify.smtpHost && config.notify.smtpUser),
});

/**
 * Kirim WhatsApp via provider resmi (API WhatsApp Business / penyedia resmi).
 * Tidak melakukan apa-apa bila belum dikonfigurasi — tidak ada simulasi.
 */
export async function sendWhatsApp(phone: string, message: string): Promise<{ sent: boolean; error?: string }> {
  if (!config.notify.whatsappApiUrl) return { sent: false, error: 'WhatsApp belum dikonfigurasi (WA_API_URL).'};
  try {
    const res = await fetch(config.notify.whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.notify.whatsappToken ? { Authorization: `Bearer ${config.notify.whatsappToken}` } : {}),
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } }),
    });
    return res.ok ? { sent: true } : { sent: false, error: `WA API HTTP ${res.status}` };
  } catch (e: any) {
    return { sent: false, error: e.message };
  }
}

/**
 * Kirim email via SMTP. Implementasi HTTP-API minimal; SMTP penuh
 * dapat diaktifkan dengan mengisi SMTP_HOST/USER/PASS dan provider API.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<{ sent: boolean; error?: string }> {
  if (!config.notify.smtpHost) return { sent: false, error: 'Email belum dikonfigurasi (SMTP_HOST).' };
  try {
    const res = await fetch(config.notify.smtpHost, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.notify.emailFrom, to, subject, text: body }),
    });
    return res.ok ? { sent: true } : { sent: false, error: `SMTP API HTTP ${res.status}` };
  } catch (e: any) {
    return { sent: false, error: e.message };
  }
}

export const templates = {
  pendaftaranBerhasil: (nama: string, no: string, pin: string, gelombang: string) =>
    `SPMB SMK Bhina Karya Karanganyar TA. 2027/2028\n\nPendaftaran atas nama ${nama} BERHASIL.\nNo. Pendaftaran: ${no}\nPIN rahasia: ${pin}\nGelombang: ${gelombang}\n\nSimpan PIN ini untuk cek/ubah pendaftaran di website.`,
  dokumenPerluPerbaikan: (nama: string, catatan: string) =>
    `SPMB SMK Bhina Karya Karanganyar\nDokumen pendaftaran ${nama} perlu diperbaiki.\nCatatan: ${catatan}`,
  dokumenLengkap: (nama: string) =>
    `SPMB SMK Bhina Karya Karanganyar\nDokumen pendaftaran ${nama} telah dinyatakan LENGKAP.`,
  jadwalWawancara: (nama: string, jadwal: string) =>
    `SPMB SMK Bhina Karya Karanganyar\nJadwal wawancara ${nama}: ${jadwal}`,
  hasilAkhir: (nama: string, status: string) =>
    `SPMB SMK Bhina Karya Karanganyar\nStatus akhir pendaftaran ${nama}: ${status}`,
};
