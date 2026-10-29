import React, { useState } from 'react';
import { X, SlidersHorizontal, Copy, Check } from 'lucide-react';
import { PromptItem } from '../types';
import { copyToClipboard } from '../utils/storage';

interface VariableFillerModalProps {
  prompt: PromptItem | null;
  onClose: () => void;
  onTrackUsage?: (promptId: string) => void;
}

export const VariableFillerModal: React.FC<VariableFillerModalProps> = ({
  prompt,
  onClose,
  onTrackUsage,
}) => {
  if (!prompt) return null;

  const vars = prompt.variables || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const getRenderedText = () => {
    let text = prompt.promptText;
    Object.entries(values).forEach(([k, v]) => {
      const strV = String(v || '');
      if (strV.trim()) {
        text = text
          .replace(new RegExp(`\\[${k}\\]`, 'gi'), strV)
          .replace(new RegExp(`\\{${k}\\}`, 'gi'), strV)
          .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), strV);
      }
    });
    return text;
  };

  const handleCopy = async () => {
    const text = getRenderedText();
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      onTrackUsage?.(prompt.id);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">Pengisi Variabel Cepat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs text-slate-400">
            Isi nilai parameter untuk prompt <strong className="text-slate-200">"{prompt.title}"</strong>:
          </p>

          <div className="space-y-3">
            {vars.map((vKey) => (
              <div key={vKey} className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">[{vKey}]</label>
                <input
                  type="text"
                  value={values[vKey] || ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [vKey]: e.target.value }))
                  }
                  placeholder={`Nilai untuk ${vKey}...`}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-100 text-xs rounded-xl px-3 py-2 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Hasil Prompt Rendered
            </span>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text max-h-48 overflow-y-auto custom-scrollbar">
              {getRenderedText()}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
            >
              Tutup
            </button>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 text-xs font-bold text-slate-950 rounded-xl shadow-lg flex items-center gap-1.5 transition-all ${
                copied ? 'bg-emerald-500 text-white' : 'bg-amber-400 hover:bg-amber-300'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Prompt Hasil'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
