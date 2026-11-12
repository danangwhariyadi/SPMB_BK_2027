import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import Info from './pages/Info';
import Jadwal from './pages/Jadwal';
import Program from './pages/Program';
import Persyaratan from './pages/Persyaratan';
import Daftar from './pages/Daftar';
import CekPendaftaran from './pages/CekPendaftaran';
import LoginPanitia from './pages/LoginPanitia';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import InputPendaftaran from './admin/InputPendaftaran';
import DataPendaftar from './admin/DataPendaftar';
import RekapPendaftar from './admin/RekapPendaftar';
import DetailPendaftar from './admin/DetailPendaftar';
import Pembayaran from './admin/Pembayaran';
import Kesehatan from './admin/Kesehatan';
import Wawancara from './admin/Wawancara';
import Verifikasi from './admin/Verifikasi';
import Dokumen from './admin/Dokumen';
import Laporan from './admin/Laporan';
import Pengguna from './admin/Pengguna';
import Pengaturan from './admin/Pengaturan';
import AuditLog from './admin/AuditLog';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/informasi" element={<Info />} />
              <Route path="/jadwal" element={<Jadwal />} />
              <Route path="/program" element={<Program />} />
              <Route path="/persyaratan" element={<Persyaratan />} />
              <Route path="/daftar" element={<Daftar />} />
              <Route path="/cek" element={<CekPendaftaran />} />
              <Route path="/login" element={<LoginPanitia />} />
            </Route>
            <Route path="/panel" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="pendaftaran/input" element={<InputPendaftaran />} />
              <Route path="pendaftaran/data" element={<DataPendaftar />} />
              <Route path="pendaftaran/rekap" element={<RekapPendaftar />} />
              <Route path="pendaftaran/:id" element={<DetailPendaftar />} />
              <Route path="pembayaran" element={<Pembayaran />} />
              <Route path="kesehatan" element={<Kesehatan />} />
              <Route path="wawancara" element={<Wawancara />} />
              <Route path="verifikasi" element={<Verifikasi />} />
              <Route path="dokumen" element={<Dokumen />} />
              <Route path="laporan" element={<Laporan />} />
              <Route path="pengguna" element={<Pengguna />} />
              <Route path="pengaturan" element={<Pengaturan />} />
              <Route path="audit" element={<AuditLog />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
