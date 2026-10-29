import React, { useState } from 'react';
import { X, Folder, FolderPlus, Palette, Lock, Eye, EyeOff } from 'lucide-react';
import { FOLDER_COLORS, FolderItem } from '../types';
import { hashFolderKey } from '../utils/security';

interface FolderModalProps {
  initialFolder?: FolderItem | null;
  onClose: () => void;
  onSave: (folderData: Partial<FolderItem>) => void;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  initialFolder,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialFolder);

  const [name, setName] = useState(initialFolder?.name || '');
  const [color, setColor] = useState(initialFolder?.color || FOLDER_COLORS[0].value);
  const [description, setDescription] = useState(initialFolder?.description || '');
  
  // New folder lock options
  const [enableLock, setEnableLock] = useState(false);
  const [lockKey, setLockKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (!isEditing && enableLock) {
      if (!lockKey.trim() || lockKey.length < 3) {
        setErrorMsg('Key pengaman folder minimal 3 karakter.');
        return;
      }

      const { keyHash, keySalt } = await hashFolderKey(lockKey.trim());
      onSave({
        name: name.trim(),
        color,
        description: description.trim(),
        isLocked: true,
        keyHash,
        keySalt,
        lockType: 'key',
      });
      return;
    }

    onSave({
      name: name.trim(),
      color,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-400" />
            <span>{isEditing ? 'Edit Folder' : 'Buat Folder Baru'}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Nama Folder <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: UI/UX & Landing Page..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 outline-none"
              id="folder-name-input"
            />
          </div>

          {/* Color Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Warna Folder</span>
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              {FOLDER_COLORS.map((c) => {
                const isSelected = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center transition-all ${
                      isSelected ? 'ring-4 ring-white/30 scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={c.name}
                  >
                    {isSelected && <Folder className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Deskripsi (Opsional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan tujuan folder..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 outline-none"
            />
          </div>

          {/* Optional Lock for new folder */}
          {!isEditing && (
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableLock}
                  onChange={(e) => {
                    setEnableLock(e.target.checked);
                    setErrorMsg(null);
                  }}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Kunci folder ini dengan Key (Proteksi Konten Dewasa/Sensitif)
                </span>
              </label>

              {enableLock && (
                <div className="p-3 bg-slate-950/70 border border-amber-500/20 rounded-xl space-y-2 animate-fade-in">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Buat Key Folder <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={lockKey}
                      onChange={(e) => setLockKey(e.target.value)}
                      placeholder="Masukkan key rahasia..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 text-slate-100 text-xs rounded-lg pl-3 pr-9 py-2 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Key akan dienkripsi dengan algoritma hash PBKDF2. Isi prompt & thumbnail akan tersembunyi sampai key dimasukkan.
                  </p>
                </div>
              )}

              {errorMsg && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                  {errorMsg}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30"
              id="save-folder-btn"
            >
              {isEditing ? 'Simpan Folder' : 'Buat Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
