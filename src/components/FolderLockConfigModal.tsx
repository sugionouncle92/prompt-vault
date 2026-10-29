import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  X,
  ShieldAlert,
  Check,
  AlertCircle,
  Key,
} from 'lucide-react';
import { FolderItem, FOLDER_COLORS } from '../types';
import { AppSettings } from '../services/firebaseService';
import {
  hashFolderKey,
  verifyFolderKey,
  verifyMasterRecoveryPin,
  isMasterRecoveryPinConfigured,
} from '../utils/security';

export type LockConfigMode = 'set' | 'change' | 'remove';

interface FolderLockConfigModalProps {
  folder: FolderItem;
  initialMode?: LockConfigMode;
  mode?: LockConfigMode;
  securitySettings?: AppSettings['security'];
  onClose: () => void;
  onSaveConfig?: (updatedFolder: Partial<FolderItem>) => Promise<void> | void;
  onSaveLockConfig?: (updatedFolder: Partial<FolderItem>) => Promise<void> | void;
  onLockStatusChanged?: (folderId: string, isLocked: boolean) => void;
}

export const FolderLockConfigModal: React.FC<FolderLockConfigModalProps> = ({
  folder,
  initialMode,
  mode: propMode,
  securitySettings,
  onClose,
  onSaveConfig,
  onSaveLockConfig,
  onLockStatusChanged,
}) => {
  const saveHandler = onSaveLockConfig || onSaveConfig;
  const startingMode = propMode || initialMode || (folder.isLocked ? 'change' : 'set');
  const [mode, setMode] = useState<LockConfigMode>(startingMode);

  // Form Fields
  const [currentKey, setCurrentKey] = useState('');
  const [newKey, setNewKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');

  // Visibility toggles
  const [showCurrentKey, setShowCurrentKey] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [showConfirmKey, setShowConfirmKey] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const folderColor =
    FOLDER_COLORS.find((c) => c.value === folder.color) || FOLDER_COLORS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // MODE 1: SET NEW LOCK
    if (mode === 'set') {
      if (!newKey.trim()) {
        setErrorMessage('Key folder tidak boleh kosong.');
        return;
      }
      if (newKey.length < 3) {
        setErrorMessage('Key minimal 3 karakter untuk keamanan yang baik.');
        return;
      }
      if (newKey !== confirmKey) {
        setErrorMessage('Konfirmasi key tidak cocok.');
        return;
      }

      setIsLoading(true);
      try {
        const { keyHash, keySalt } = await hashFolderKey(newKey.trim());
        if (saveHandler) {
          await saveHandler({
            isLocked: true,
            keyHash,
            keySalt,
            lockType: 'key',
          });
        }
        if (onLockStatusChanged) onLockStatusChanged(folder.id, true);
        setSuccessMessage('Kunci folder berhasil diaktifkan!');
        setTimeout(() => onClose(), 900);
      } catch (err: any) {
        console.error('Failed to set lock:', err);
        setErrorMessage('Gagal mengaktifkan kunci folder.');
      } finally {
        setIsLoading(false);
      }
    }

    // MODE 2: CHANGE EXISTING KEY
    else if (mode === 'change') {
      if (!currentKey.trim()) {
        setErrorMessage('Masukkan key lama Anda.');
        return;
      }
      if (!newKey.trim()) {
        setErrorMessage('Masukkan key baru.');
        return;
      }
      if (newKey.length < 3) {
        setErrorMessage('Key baru minimal 3 karakter.');
        return;
      }
      if (newKey !== confirmKey) {
        setErrorMessage('Konfirmasi key baru tidak cocok.');
        return;
      }

      setIsLoading(true);
      try {
        if (!folder.keyHash || !folder.keySalt) {
          throw new Error('Data kunci folder tidak valid.');
        }

        let isCurrentValid = false;
        if (folder.keyHash && folder.keySalt) {
          isCurrentValid = await verifyFolderKey(
            currentKey.trim(),
            folder.keyHash,
            folder.keySalt
          );
        }

        // Fallback: Check if user input matches Master Recovery PIN
        if (
          !isCurrentValid &&
          isMasterRecoveryPinConfigured(securitySettings) &&
          securitySettings?.masterPinHash &&
          securitySettings?.masterPinSalt
        ) {
          isCurrentValid = await verifyMasterRecoveryPin(
            currentKey.trim(),
            securitySettings.masterPinHash,
            securitySettings.masterPinSalt
          );
        }

        if (!isCurrentValid) {
          setErrorMessage('Key lama salah (atau Master Recovery PIN tidak cocok).');
          setIsLoading(false);
          return;
        }

        const { keyHash, keySalt } = await hashFolderKey(newKey.trim());
        if (saveHandler) {
          await saveHandler({
            isLocked: true,
            keyHash,
            keySalt,
            lockType: 'key',
          });
        }
        setSuccessMessage('Key folder berhasil diubah!');
        setTimeout(() => onClose(), 900);
      } catch (err: any) {
        console.error('Failed to change key:', err);
        setErrorMessage('Gagal mengubah key folder.');
      } finally {
        setIsLoading(false);
      }
    }

    // MODE 3: REMOVE LOCK
    else if (mode === 'remove') {
      if (!currentKey.trim()) {
        setErrorMessage('Masukkan key saat ini untuk menghapus kunci.');
        return;
      }

      setIsLoading(true);
      try {
        if (!folder.keyHash || !folder.keySalt) {
          // If already corrupted or empty, allow direct removal
          if (saveHandler) {
            await saveHandler({
              isLocked: false,
              keyHash: undefined,
              keySalt: undefined,
              lockType: undefined,
            });
          }
          if (onLockStatusChanged) onLockStatusChanged(folder.id, false);
          onClose();
          return;
        }

        let isCurrentValid = false;
        if (folder.keyHash && folder.keySalt) {
          isCurrentValid = await verifyFolderKey(
            currentKey.trim(),
            folder.keyHash,
            folder.keySalt
          );
        }

        // Fallback: Check if user input matches Master Recovery PIN
        if (
          !isCurrentValid &&
          isMasterRecoveryPinConfigured(securitySettings) &&
          securitySettings?.masterPinHash &&
          securitySettings?.masterPinSalt
        ) {
          isCurrentValid = await verifyMasterRecoveryPin(
            currentKey.trim(),
            securitySettings.masterPinHash,
            securitySettings.masterPinSalt
          );
        }

        if (!isCurrentValid) {
          setErrorMessage('Key saat ini salah (atau Master Recovery PIN tidak cocok).');
          setIsLoading(false);
          return;
        }

        if (saveHandler) {
          await saveHandler({
            isLocked: false,
            keyHash: undefined,
            keySalt: undefined,
            lockType: undefined,
          });
        }
        if (onLockStatusChanged) onLockStatusChanged(folder.id, false);
        setSuccessMessage('Kunci folder berhasil dihapus!');
        setTimeout(() => onClose(), 900);
      } catch (err: any) {
        console.error('Failed to remove lock:', err);
        setErrorMessage('Gagal menghapus kunci folder.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              {mode === 'remove' ? (
                <Unlock className="w-4 h-4 text-rose-400" />
              ) : (
                <Lock className="w-4 h-4 text-indigo-400" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {mode === 'set' && 'Kunci Folder'}
                {mode === 'change' && 'Ubah Key Folder'}
                {mode === 'remove' && 'Hapus Kunci Folder'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'set' && 'Lindungi folder dengan password / key'}
                {mode === 'change' && 'Perbarui password pengaman folder'}
                {mode === 'remove' && 'Buka proteksi dan jadikan folder publik'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-xl transition-colors"
            title="Tutup"
            id="close-lock-config-modal-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch if folder is already locked */}
        {folder.isLocked && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('change');
                setErrorMessage(null);
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                mode === 'change'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Ubah Key</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('remove');
                setErrorMessage(null);
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                mode === 'remove'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Hapus Kunci</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Target Folder info pill */}
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className={`w-7 h-7 rounded-lg ${folderColor.bg} flex items-center justify-center text-white shrink-0`}>
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-200 truncate">{folder.name}</div>
              <div className="text-[11px] text-slate-500">
                {folder.isLocked ? 'Status: Terkunci (PBKDF2 Hashed)' : 'Status: Normal / Tidak Terkunci'}
              </div>
            </div>
          </div>

          {/* Current Key (Required for 'change' and 'remove') */}
          {(mode === 'change' || mode === 'remove') && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>
                  {mode === 'remove' ? 'Masukkan Key Saat Ini' : 'Key Lama'}{' '}
                  <span className="text-rose-400">*</span>
                </span>
                {isMasterRecoveryPinConfigured(securitySettings) && (
                  <span className="text-[10px] text-rose-400 font-normal">
                    (atau gunakan Master Recovery PIN)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showCurrentKey ? 'text' : 'password'}
                  required
                  value={currentKey}
                  onChange={(e) => setCurrentKey(e.target.value)}
                  placeholder={
                    isMasterRecoveryPinConfigured(securitySettings)
                      ? 'Key folder saat ini atau Master PIN...'
                      : 'Key saat ini...'
                  }
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl pl-3.5 pr-10 py-2.5 outline-none font-mono"
                  id="current-key-input"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentKey(!showCurrentKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  {showCurrentKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* New Key & Confirm Key (For 'set' and 'change') */}
          {(mode === 'set' || mode === 'change') && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {mode === 'change' ? 'Key Baru' : 'Buat Key Folder'} <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewKey ? 'text' : 'password'}
                    required
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Buat key rahasia..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl pl-3.5 pr-10 py-2.5 outline-none font-mono"
                    id="new-key-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                  >
                    {showNewKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Konfirmasi Key <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmKey ? 'text' : 'password'}
                    required
                    value={confirmKey}
                    onChange={(e) => setConfirmKey(e.target.value)}
                    placeholder="Ulangi key..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs rounded-xl pl-3.5 pr-10 py-2.5 outline-none font-mono"
                    id="confirm-key-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmKey(!showConfirmKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirmKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Security Note */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              {mode === 'remove'
                ? 'Setelah kunci dihapus, semua prompt di dalam folder ini akan dapat diakses secara publik.'
                : 'Key dienkripsi aman dengan algoritma PBKDF2-SHA256 (100.000 iterasi). Plain text tidak pernah disimpan di database.'}
            </span>
          </div>

          {/* Error / Success Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl transition-all"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className={`px-5 py-2 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                mode === 'remove'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
              id="submit-lock-config-btn"
            >
              {isLoading ? (
                <span>Memproses...</span>
              ) : mode === 'set' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Aktifkan Kunci</span>
                </>
              ) : mode === 'change' ? (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Simpan Key Baru</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Hapus Kunci Folder</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
