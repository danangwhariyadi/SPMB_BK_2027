import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; message: string; }

const ToastCtx = createContext<{ toast: (type: ToastType, message: string) => void }>({ toast: () => {} });

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed z-[100] bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg flex items-start gap-2 animate-[fadeIn_.2s_ease] ${
            t.type === 'success' ? 'bg-emerald-600 text-white' :
            t.type === 'error' ? 'bg-accent-500 text-white' :
            'bg-primary-700 text-white'}`}>
            <span>{t.type === 'success' ? '✔' : t.type === 'error' ? '✖' : 'ℹ'}</span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('spmb_theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('spmb_theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}
