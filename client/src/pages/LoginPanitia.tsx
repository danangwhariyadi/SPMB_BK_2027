import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';

export default function LoginPanitia() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
      toast('success', 'Login berhasil. Mengalihkan ke dashboard…');
      navigate('/panel');
    } catch (err: any) {
      toast('error', err.message || 'Login gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8 text-center">
        <img src="/logobk.png" alt="Logo SMK Bhina Karya" className="w-20 h-20 mx-auto mb-4" />
        <h1 className="text-xl font-extrabold text-primary-800 dark:text-primary-300 mb-1">Login Panitia</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">SPMB SMK Bhina Karya Karanganyar TA. 2027/2028</p>
        <form onSubmit={submit} className="space-y-4 text-left">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} required autoFocus autoComplete="username" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
        </form>
      </div>
    </div>
  );
}
