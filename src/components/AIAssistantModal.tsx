import React, { useState } from 'react';
import { Sparkles, X, Bot, Copy, Check, ArrowRight, Save } from 'lucide-react';
import { PromptItem, TARGET_AI_OPTIONS } from '../types';

interface AIAssistantModalProps {
  onClose: () => void;
  onSaveNewPrompt: (promptData: Partial<PromptItem>) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  onClose,
  onSaveNewPrompt,
}) => {
  const [draftPrompt, setDraftPrompt] = useState('');
  const [targetAI, setTargetAI] = useState(TARGET_AI_OPTIONS[0]);
  const [goal, setGoal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    optimizedPrompt: string;
    title: string;
    category: string;
    tags: string[];
    variables: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    if (!draftPrompt.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gemini/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: draftPrompt,
          targetAI,
          goal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengoptimasi prompt');

      setResult({
        optimizedPrompt: data.optimizedPrompt || draftPrompt,
        title: data.title || draftPrompt.slice(0, 30),
        category: data.category || 'Umum',
        tags: data.tags || ['optimized'],
        variables: data.variables || [],
      });
    } catch (err: any) {
      console.error('Optimization error:', err);
      setError(err.message || 'Gagal terhubung ke AI Assistant');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToVault = () => {
    if (!result) return;
    onSaveNewPrompt({
      title: result.title,
      promptText: result.optimizedPrompt,
      targetAI,
      category: result.category,
      tags: result.tags,
      variables: result.variables,
      images: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <span>AI Prompt Engineer Assistant (Gemini)</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {!result ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Masukkan ide awal atau prompt mentah Anda. AI akan menyempurnakannya dengan struktur peran, instruksi detail, batasan, dan variabel dinamis!
              </p>

              {/* Draft Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Prompt Mentah / Ide Awal <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  placeholder="Contoh: Tolong buatkan prompt untuk merevisi kode React yang lambat..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 text-slate-100 text-xs rounded-xl p-3 outline-none"
                  id="ai-assistant-input"
                />
              </div>

              {/* Grid: Target AI & Goal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target AI</label>
                  <select
                    value={targetAI}
                    onChange={(e) => setTargetAI(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none"
                  >
                    {TARGET_AI_OPTIONS.map((ai) => (
                      <option key={ai} value={ai}>
                        {ai}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Tujuan Khusus (Opsional)</label>
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Contoh: Hasil terstruktur dengan poin-poin..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                  {error}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOptimize}
                  disabled={isLoading || !draftPrompt.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 text-xs transition-all disabled:opacity-50"
                  id="run-ai-optimizer-btn"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Mengoptimasi dengan AI Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Optimalkan Prompt Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Result Screen */
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300 font-medium flex items-center justify-between">
                <span>✨ Prompt Berhasil Dioptimasi!</span>
                <button
                  onClick={() => setResult(null)}
                  className="text-xs underline hover:text-white"
                >
                  Coba Lagi
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">Judul Rekomendasi AI:</span>
                <p className="text-sm font-bold text-slate-100">{result.title}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400">Hasil Prompt Terstruktur:</span>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 leading-relaxed max-h-60 overflow-y-auto custom-scrollbar select-text">
                  {result.optimizedPrompt}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  onClick={handleSaveToVault}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                  id="save-ai-prompt-btn"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan ke Vault Saya</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
