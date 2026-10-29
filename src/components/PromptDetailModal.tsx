import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Star,
  Edit3,
  History,
  SlidersHorizontal,
  Bot,
  Folder as FolderIcon,
  Tag,
  Maximize2,
  Trash2,
  Plus,
  RotateCcw,
  Sparkles,
  Share2,
} from 'lucide-react';
import { FOLDER_COLORS, FolderItem, PromptItem, PromptVersion } from '../types';
import { copyToClipboard } from '../utils/storage';

interface PromptDetailModalProps {
  prompt: PromptItem | null;
  folders: FolderItem[];
  onClose: () => void;
  onEditPrompt: (prompt: PromptItem) => void;
  onToggleFavorite: (id: string) => void;
  onRestoreVersion: (promptId: string, version: PromptVersion) => void;
  onUpdateImages: (promptId: string, newImages: string[]) => void;
  onViewImageLightbox: (imageUrl: string) => void;
  onTrackUsage?: (promptId: string) => void;
}

export const PromptDetailModal: React.FC<PromptDetailModalProps> = ({
  prompt,
  folders,
  onClose,
  onEditPrompt,
  onToggleFavorite,
  onRestoreVersion,
  onUpdateImages,
  onViewImageLightbox,
  onTrackUsage,
}) => {
  if (!prompt) return null;

  const [activeTab, setActiveTab] = useState<'prompt' | 'variables' | 'history' | 'test'>('prompt');
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedFilled, setCopiedFilled] = useState(false);

  // Dynamic variable values map
  const detectedVars = prompt.variables || [];
  const [varValues, setVarValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    detectedVars.forEach((v) => {
      initial[v] = '';
    });
    return initial;
  });

  // Test prompt with Gemini AI state
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const folder = folders.find((f) => f.id === prompt.folderId);
  const folderColor = folder
    ? FOLDER_COLORS.find((c) => c.value === folder.color)
    : null;

  // Calculate filled prompt text
  const getRenderedFilledPrompt = () => {
    let text = prompt.promptText;
    Object.entries(varValues).forEach(([key, val]) => {
      const strVal = String(val || '');
      if (strVal.trim()) {
        text = text
          .replace(new RegExp(`\\[${key}\\]`, 'gi'), strVal)
          .replace(new RegExp(`\\{${key}\\}`, 'gi'), strVal)
          .replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), strVal);
      }
    });
    return text;
  };

  const handleCopyRaw = async () => {
    const ok = await copyToClipboard(prompt.promptText);
    if (ok) {
      setCopiedRaw(true);
      onTrackUsage?.(prompt.id);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const handleCopyFilled = async () => {
    const rendered = getRenderedFilledPrompt();
    const ok = await copyToClipboard(rendered);
    if (ok) {
      setCopiedFilled(true);
      onTrackUsage?.(prompt.id);
      setTimeout(() => setCopiedFilled(false), 2000);
    }
  };

  // Run test via Gemini endpoint
  const handleRunTest = async () => {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/gemini/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: prompt.promptText,
          variables: varValues,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengeksekusi prompt');
      setTestResult(data.output);
    } catch (err: any) {
      setTestError(err.message || 'Terjadi kesalahan saat memproses prompt');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              {prompt.targetAI}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-100 truncate">
                {prompt.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>Kategori: {prompt.category}</span>
                {folder && folderColor && (
                  <span className="flex items-center gap-1 font-medium text-amber-400">
                    • <FolderIcon className="w-3 h-3" /> {folder.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggleFavorite(prompt.id)}
              className="p-2 text-slate-400 hover:text-amber-400 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
              title="Favorit"
            >
              <Star
                className={`w-4 h-4 ${
                  prompt.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                }`}
              />
            </button>

            <button
              onClick={() => {
                onClose();
                onEditPrompt(prompt);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'prompt'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Teks Prompt & Screenshot</span>
          </button>

          {detectedVars.length > 0 && (
            <button
              onClick={() => setActiveTab('variables')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'variables'
                  ? 'border-indigo-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Isi Variabel ({detectedVars.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Versi ({prompt.versionHistory?.length || 1})</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'test'
                ? 'border-indigo-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>Uji dengan Gemini AI</span>
          </button>
        </div>

        {/* Modal Tab Contents */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* TAB 1: Prompt & Screenshots */}
          {activeTab === 'prompt' && (
            <div className="space-y-6">
              {/* Screenshot & Images Gallery */}
              {prompt.images && prompt.images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <span>Screenshot & Gambar Referensi</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                      {prompt.images.length}
                    </span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {prompt.images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => onViewImageLightbox(img)}
                        className="group relative h-40 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-500/60 transition-all cursor-zoom-in shadow-md flex items-center justify-center p-2"
                        title="Klik untuk memperbesar gambar utuh"
                      >
                        <img
                          src={img}
                          alt={`Reference ${idx + 1}`}
                          className="max-w-full max-h-full w-auto h-auto object-contain object-center group-hover:scale-105 transition-transform duration-300 rounded-lg"
                        />
                        <div className="absolute top-2 right-2 p-1.5 bg-slate-900/80 rounded-lg border border-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description notes if any */}
              {prompt.description && (
                <div className="bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-400 block mb-1">Catatan Deskripsi:</span>
                  {prompt.description}
                </div>
              )}

              {/* Prompt Text Output Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Isi Prompt AI
                  </h4>

                  <button
                    onClick={handleCopyRaw}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      copiedRaw
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    }`}
                  >
                    {copiedRaw ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRaw ? 'Tersalin ke Clipboard!' : 'Salin Prompt Teks'}</span>
                  </button>
                </div>

                <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 leading-relaxed overflow-x-auto whitespace-pre-wrap select-text shadow-inner">
                  {prompt.promptText}
                </div>
              </div>

              {/* Tags */}
              {prompt.tags && prompt.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  {prompt.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Dynamic Variables */}
          {activeTab === 'variables' && (
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-xs text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" /> Pengisi Variabel Dinamis
                </p>
                <p className="text-amber-300/80">
                  Isi kolom nilai variabel di bawah ini untuk menghasilkan prompt akhir secara instan!
                </p>
              </div>

              {/* Variable Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {detectedVars.map((vKey) => (
                  <div key={vKey} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <span>[{vKey}]</span>
                    </label>
                    <input
                      type="text"
                      value={varValues[vKey] || ''}
                      onChange={(e) =>
                        setVarValues((prev) => ({ ...prev, [vKey]: e.target.value }))
                      }
                      placeholder={`Masukkan nilai untuk ${vKey}...`}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Preview Rendered Result */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Hasil Prompt Terganti (Rendered Output)
                  </h4>
                  <button
                    onClick={handleCopyFilled}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      copiedFilled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    {copiedFilled ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedFilled ? 'Hasil Tersalin!' : 'Salin Hasil Pengisian'}
                    </span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                  {getRenderedFilledPrompt()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Revision & Version History */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Setiap kali prompt diperbarui, versi sebelumnya disimpan secara otomatis. Anda dapat memulihkan versi sebelumnya kapan saja.
              </p>

              <div className="space-y-3">
                {(prompt.versionHistory || []).map((ver) => (
                  <div
                    key={ver.id || ver.version}
                    className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Versi v{ver.version}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(ver.updatedAt).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <button
                        onClick={() => onRestoreVersion(prompt.id, ver)}
                        className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Pulihkan v{ver.version}</span>
                      </button>
                    </div>

                    {ver.changeNote && (
                      <p className="text-xs text-amber-300/80 italic">
                        Catatan revisi: "{ver.changeNote}"
                      </p>
                    )}

                    <div className="bg-slate-900 p-3 rounded-xl text-xs font-mono text-slate-400 line-clamp-3">
                      {ver.promptText}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Run / Test with Gemini AI */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 p-4 rounded-2xl space-y-2 text-xs text-purple-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-2 text-white">
                    <Sparkles className="w-4 h-4 text-amber-300" /> Eksekusi Prompt Langsung dengan Gemini AI
                  </span>
                  <button
                    onClick={handleRunTest}
                    disabled={isTesting}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4" />
                        <span>Jalankan Sekarang</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-purple-300/80">
                  Uji performa dan keluaran prompt ini secara real-time.
                </p>
              </div>

              {testError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                  {testError}
                </div>
              )}

              {testResult && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Hasil Keluaran Gemini AI
                  </h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text max-h-96 overflow-y-auto custom-scrollbar">
                    {testResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
