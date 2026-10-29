import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageLightboxModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  imageUrl,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `screenshot-promptvault-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/95 backdrop-blur-md animate-fade-in cursor-zoom-out"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center justify-center cursor-default"
      >
        {/* Top Floating Controls */}
        <div className="w-full flex items-center justify-between pb-3 px-1">
          <span className="text-xs text-slate-400 font-medium">
            Full Image Preview
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-lg"
              title="Unduh Gambar"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Unduh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-colors shadow-lg"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Display Container with Object Contain */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-2 w-full max-h-[82vh] flex items-center justify-center">
          <img
            src={imageUrl}
            alt="Screenshot Referensi"
            className="max-h-[78vh] max-w-full w-auto h-auto object-contain object-center rounded-xl select-none"
          />
        </div>
      </div>
    </div>
  );
};
