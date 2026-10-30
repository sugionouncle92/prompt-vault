import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  Check,
  Loader2,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { FolderItem, FOLDER_COLORS } from '../types';
import { AppSettings } from '../services/firebaseService';
import {
  hashMasterFolderPassword,
  verifyMasterFolderPassword,
  isMasterFolderPasswordConfigured,
  getEffectiveMasterFolderCredentials,
  recordFailedAttempt,
  getFolderLockoutRemainingSeconds,
  resetFailedAttempts,
} from '../utils/security';

interface FolderLockToggleModalProps {
  folder: FolderItem;
  mode: 'enable' | 'disable';
  securitySettings?: AppSettings['security'];
  onClose: () => void;
  onConfirmEnable: (folderId: string) => Promise<void> | void;
  onConfirmDisable: (folderId: string) => Promise<void> | void;
  onCreateMasterPasswordAndEnable: (
    folderId: string,
    passwordHash: string,
    passwordSalt: string
  ) => Promise<void> | void;
}

export const FolderLockToggleModal: React.FC<FolderLockToggleModalProps> = ({
  folder,
  mode,
  securitySettings,
  onClose,
  onConfirmEnable,
  onConfirmDisable,
  onCreateMasterPasswordAndEnable,
}) => {
  const isPasswordConfigured = isMasterFolderPasswordConfigured(securitySettings);

  // States for password creation (when enabling and no master password exists yet)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States for verification (when disabling)
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  const newPasswordRef = useRef<HTMLInputElement>(null);
  const verifyPasswordRef = useRef<HTMLInputElement>(null);

  const folderColor =
    FOLDER_COLORS.find((c) => c.value === folder.color) || FOLDER_COLORS[0];

  useEffect(() => {
    if (mode === 'enable' && !isPasswordConfigured) {
      setTimeout(() => newPasswordRef.current?.focus(), 100);
    } else if (mode === 'disable') {
      setTimeout(() => verifyPasswordRef.current?.focus(), 100);
    }
  }, [mode, isPasswordConfigured]);

  // Lockout tick countdown
  useEffect(() => {
    if (mode !== 'disable') return;
    const checkLockout = () => {
      const remaining = getFolderLockoutRemainingSeconds(folder.id);
      setLockoutRemaining(remaining);
      if (remaining > 0) {
        setErrorMessage(
          `Terlalu banyak percobaan salah (5x). Silakan tunggu ${remaining} detik.`
        );
      } else if (errorMessage?.startsWith('Terlalu banyak') && remaining === 0) {
        setErrorMessage(null);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [folder.id, mode, errorMessage]);

  // Handle Enable
  const handleEnableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null);

    if (isPasswordConfigured) {
      // Password already exists, simply enable protection on this folder
      setIsLoading(true);
      try {
        await onConfirmEnable(folder.id);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Gagal mengaktifkan kunci folder.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Must set initial Master Folder Password
      const p = newPassword.trim();
      const cp = confirmPassword.trim();

      if (!p) {
        setErrorMessage('Password tidak boleh kosong.');
        return;
      }
      if (p.length < 4) {
        setErrorMessage('Password minimal 4 karakter.');
        return;
      }
      if (p !== cp) {
        setErrorMessage('Konfirmasi password tidak cocok.');
        return;
      }

      setIsLoading(true);
      try {
        const { masterPasswordHash, masterPasswordSalt } =
          await hashMasterFolderPassword(p);
        await onCreateMasterPasswordAndEnable(
          folder.id,
          masterPasswordHash,
          masterPasswordSalt
        );
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Gagal membuat Master Folder Password.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle Disable
  const handleDisableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || lockoutRemaining > 0) return;
    setErrorMessage(null);

    const input = verifyPasswordInput.trim();
    if (!input) {
      setErrorMessage('Masukkan Master Folder Password untuk konfirmasi.');
      return;
    }

    const creds = getEffectiveMasterFolderCredentials(securitySettings);
    const hashToTest = creds.hash || folder.keyHash;
    const saltToTest = creds.salt || folder.keySalt;

    if (!hashToTest || !saltToTest) {
      // If no credentials configured, allow direct removal
      setIsLoading(true);
      try {
        await onConfirmDisable(folder.id);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Gagal menonaktifkan kunci folder.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await verifyMasterFolderPassword(
        input,
        hashToTest,
        saltToTest
      );

      if (isValid) {
        resetFailedAttempts(folder.id);
        await onConfirmDisable(folder.id);
        onClose();
      } else {
        const lockoutStatus = recordFailedAttempt(folder.id);
        if (lockoutStatus.isLockedOut) {
          setLockoutRemaining(lockoutStatus.lockoutSeconds);
          setErrorMessage(
            `Terlalu banyak percobaan salah (5x). Silakan tunggu ${lockoutStatus.lockoutSeconds} detik.`
          );
        } else {
          setErrorMessage('Password salah. Akses ditolak.');
        }
        setVerifyPasswordInput('');
        verifyPasswordRef.current?.focus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan verifikasi password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        id="folder-lock-toggle-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                mode === 'enable'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              }`}
            >
              {mode === 'enable' ? (
                <Lock className="w-5 h-5" />
              ) : (
                <Unlock className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {mode === 'enable'
                  ? 'Aktifkan Kunci Folder'
                  : 'Nonaktifkan Kunci Folder'}
              </h2>
              <p className="text-xs text-slate-400">Folder “{folder.name}”</p>
            </div>
          </div>

          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-xl transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content & Form */}
        {mode === 'enable' ? (
          <form onSubmit={handleEnableSubmit} className="p-5 sm:p-6 space-y-4">
            {/* Target Folder Pill */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div
                className={`w-8 h-8 rounded-lg ${folderColor.bg} flex items-center justify-center text-white shrink-0 shadow-sm`}
              >
                <Lock className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-200 truncate">
                  {folder.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  Folder akan dilindungi dengan Master Folder Password
                </div>
              </div>
            </div>

            {isPasswordConfigured ? (
              /* Scenario A: Password already exists */
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>
                  Master Folder Password sudah aktif di sistem PromptVault.
                </p>
                <p className="text-slate-400 text-[11px]">
                  Mengaktifkan kunci pada folder ini akan menggunakan Master Folder Password yang sama dengan folder terproteksi lainnya.
                </p>
              </div>
            ) : (
              /* Scenario B: Password not created yet -> Create initial Master Password */
              <div className="space-y-3.5">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Buat Master Folder Password Pertama Kali
                  </div>
                  <p className="text-[11px] text-amber-300/80">
                    Satu Master Folder Password ini akan digunakan untuk seluruh folder yang Anda pilih untuk dilindungi.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Password Baru (Min. 4 Karakter)
                  </label>
                  <div className="relative">
                    <input
                      ref={newPasswordRef}
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Masukkan Master Folder Password..."
                      disabled={isLoading}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi Master Folder Password..."
                      disabled={isLoading}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-1.5"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {isPasswordConfigured
                    ? 'Aktifkan Kunci Sekarang'
                    : 'Simpan Password & Aktifkan'}
                </span>
              </button>
            </div>
          </form>
        ) : (
          /* Form Disable Lock */
          <form onSubmit={handleDisableSubmit} className="p-5 sm:p-6 space-y-4">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed space-y-1">
              <p className="font-semibold text-slate-200">
                Konfirmasi Penonaktifan Kunci Folder
              </p>
              <p className="text-slate-400 text-[11px]">
                Masukkan Master Folder Password untuk membuka kunci folder ini secara permanen. Folder lain tidak akan terpengaruh.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Master Folder Password
              </label>
              <div className="relative">
                <input
                  ref={verifyPasswordRef}
                  type={showVerifyPassword ? 'text' : 'password'}
                  value={verifyPasswordInput}
                  onChange={(e) => setVerifyPasswordInput(e.target.value)}
                  placeholder="Masukkan password..."
                  disabled={isLoading || lockoutRemaining > 0}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showVerifyPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading || lockoutRemaining > 0}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Unlock className="w-3.5 h-3.5" />
                <span>Nonaktifkan Kunci</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
