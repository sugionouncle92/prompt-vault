import React from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface PWAUpdateToastProps {
  onDismiss: () => void;
}

export const PWAUpdateToast: React.FC<PWAUpdateToastProps> = ({ onDismiss }) => {
  const { hasUpdate, applyUpdate } = usePWA();

  if (!hasUpdate) return null;

  return (
    <div
      className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] bg-slate-900/95 border border-indigo-500/50 backdrop-blur-xl p-4 rounded-2xl shadow-2xl shadow-indigo-950/60 flex items-center justify-between gap-3 text-slate-100 animate-slide-up"
      id="pwa-update-toast"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
            Versi Baru Tersedia!
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            Pembaruan aplikasi siap dimuat.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={applyUpdate}
          className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all active:scale-95"
          title="Perbarui Sekarang"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Perbarui</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          title="Nanti"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
