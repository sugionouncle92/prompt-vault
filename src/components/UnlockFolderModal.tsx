import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  KeyRound,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Unlock,
  Key,
  Settings as SettingsIcon,
  HelpCircle,
} from 'lucide-react';
import { FolderItem, FOLDER_COLORS } from '../types';
import { AppSettings } from '../services/firebaseService';
import {
  verifyFolderKey,
  verifyMasterRecoveryPin,
  isMasterRecoveryPinConfigured,
  getFolderLockoutRemainingSeconds,
  recordFailedAttempt,
  resetFailedAttempts,
} from '../utils/security';

interface UnlockFolderModalProps {
  folder: FolderItem;
  securitySettings?: AppSettings['security'];
  onClose: () => void;
  onUnlockSuccess: (folderId: string) => void;
  onResetLock?: (folderId: string) => Promise<void> | void;
  onOpenSettings?: () => void;
}

export const UnlockFolderModal: React.FC<UnlockFolderModalProps> = ({
  folder,
  securitySettings,
  onClose,
  onUnlockSuccess,
  onResetLock,
  onOpenSettings,
}) => {
  const [unlockMode, setUnlockMode] = useState<'standard' | 'recovery'>('standard');
  const [keyInput, setKeyInput] = useState('');
  const [masterPinInput, setMasterPinInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  
  // Recovery action choice: 'unlock' (just unlock session) or 'reset' (remove lock completely)
  const [recoveryAction, setRecoveryAction] = useState<'unlock' | 'reset'>('unlock');

  const inputRef = useRef<HTMLInputElement>(null);
  const masterPinRef = useRef<HTMLInputElement>(null);

  const folderColor =
    FOLDER_COLORS.find((c) => c.value === folder.color) || FOLDER_COLORS[0];

  const hasMasterPin = isMasterRecoveryPinConfigured(securitySettings);

  // Check lockout on mount and tick every second if active
  useEffect(() => {
    const checkLockout = () => {
      const remaining = getFolderLockoutRemainingSeconds(folder.id);
      setLockoutRemaining(remaining);
      if (remaining > 0 && unlockMode === 'standard') {
        setErrorMessage(
          `Terlalu banyak percobaan salah. Silakan tunggu ${remaining} detik sebelum mencoba kembali.`
        );
      } else if (errorMessage?.startsWith('Terlalu banyak') && remaining === 0) {
        setErrorMessage(null);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [folder.id, errorMessage, unlockMode]);

  useEffect(() => {
    if (unlockMode === 'standard' && lockoutRemaining === 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (unlockMode === 'recovery') {
      setTimeout(() => masterPinRef.current?.focus(), 100);
    }
  }, [unlockMode, lockoutRemaining]);

  // Standard unlock with folder key
  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || isVerifying || lockoutRemaining > 0) return;

    if (!folder.keyHash || !folder.keySalt) {
      setErrorMessage('Konfigurasi kunci folder rusak atau tidak ditemukan.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const isValid = await verifyFolderKey(keyInput.trim(), folder.keyHash, folder.keySalt);

      if (isValid) {
        resetFailedAttempts(folder.id);
        onUnlockSuccess(folder.id);
        onClose();
      } else {
        const lockoutStatus = recordFailedAttempt(folder.id);
        if (lockoutStatus.isLockedOut) {
          setLockoutRemaining(lockoutStatus.lockoutSeconds);
          setErrorMessage(
            `Terlalu banyak percobaan salah (5x). Silakan tunggu ${lockoutStatus.lockoutSeconds} detik.`
          );
        } else {
          setErrorMessage('Key salah. Silakan coba kembali atau gunakan Master Recovery PIN.');
        }
        setKeyInput('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Key verification error:', err);
      setErrorMessage('Terjadi kesalahan sistem saat memvalidasi key.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Recovery unlock with Master Recovery PIN
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPinInput.trim() || isVerifying) return;

    if (!hasMasterPin || !securitySettings?.masterPinHash || !securitySettings?.masterPinSalt) {
      setErrorMessage('Master Recovery PIN belum diatur.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const isMasterValid = await verifyMasterRecoveryPin(
        masterPinInput.trim(),
        securitySettings.masterPinHash,
        securitySettings.masterPinSalt
      );

      if (isMasterValid) {
        // Reset any lockout for this folder
        resetFailedAttempts(folder.id);

        if (recoveryAction === 'reset' && onResetLock) {
          // Permanently reset/remove password on this folder
          await onResetLock(folder.id);
          onClose();
        } else {
          // Unlock just for this session
          onUnlockSuccess(folder.id);
          onClose();
        }
      } else {
        setErrorMessage('Master Recovery PIN salah! Silakan periksa kembali PIN utama Anda.');
        setMasterPinInput('');
        masterPinRef.current?.focus();
      }
    } catch (err) {
      console.error('Master PIN verification error:', err);
      setErrorMessage('Gagal memverifikasi Master Recovery PIN.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isLockedOut = lockoutRemaining > 0 && unlockMode === 'standard';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border ${
                unlockMode === 'recovery'
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
              }`}
            >
              {unlockMode === 'recovery' ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {unlockMode === 'recovery' ? 'Master Recovery PIN' : 'Buka Kunci Folder'}
              </h2>
              <p className="text-xs text-slate-400">
                {unlockMode === 'recovery'
                  ? 'Pemulihan Kunci dengan PIN Utama'
                  : 'Proteksi Privasi & Konten'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-xl transition-colors"
            title="Tutup"
            id="close-unlock-modal-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 border-b border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setUnlockMode('standard');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl transition-all ${
              unlockMode === 'standard'
                ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Key Folder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setUnlockMode('recovery');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl transition-all ${
              unlockMode === 'recovery'
                ? 'bg-rose-950/60 text-rose-200 shadow-sm border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Master Recovery PIN</span>
          </button>
        </div>

        {/* Modal Body */}
        {unlockMode === 'standard' ? (
          /* STANDARD MODE: KEY FOLDER */
          <form onSubmit={handleStandardSubmit} className="p-6 space-y-5">
            {/* Target Folder Pill */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className={`w-7 h-7 rounded-lg ${folderColor.bg} flex items-center justify-center text-white shrink-0`}>
                <Lock className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-200 truncate">{folder.name}</div>
                <div className="text-[11px] text-slate-500">Status: Terkunci (Perlu Key Folder)</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Masukkan Key Folder
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('recovery');
                    setErrorMessage(null);
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-normal hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Lupa Password?</span>
                </button>
              </label>

              {/* Input with Eye toggle */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Masukkan Key folder..."
                  disabled={isLockedOut || isVerifying}
                  autoComplete="off"
                  className={`w-full bg-slate-950 border text-slate-100 text-sm rounded-xl pl-3.5 pr-11 py-3 outline-none transition-all font-mono ${
                    isLockedOut
                      ? 'border-rose-500/40 opacity-60 cursor-not-allowed bg-rose-950/10'
                      : 'border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                  }`}
                  id="unlock-key-input"
                />

                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  disabled={isLockedOut}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  title={showKey ? 'Sembunyikan Key' : 'Tampilkan Key'}
                  id="toggle-key-visibility-btn"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Lockout or Error Alert */}
            {errorMessage && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-shake ${
                  isLockedOut
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {isLockedOut ? (
                  <Clock className="w-4 h-4 shrink-0 text-rose-400 mt-0.5 animate-pulse" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">
                  <span className="font-semibold block">{errorMessage}</span>
                  {isLockedOut && (
                    <span className="text-[11px] opacity-80 mt-0.5 block">
                      Atau gunakan tab <strong>Master Recovery PIN</strong> untuk membuka langsung tanpa menunggu.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setUnlockMode('recovery');
                  setErrorMessage(null);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 font-medium"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Gunakan Master PIN</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all"
                  id="cancel-unlock-btn"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={!keyInput.trim() || isVerifying || isLockedOut}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                    !keyInput.trim() || isVerifying || isLockedOut
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 active:scale-95'
                  }`}
                  id="submit-unlock-btn"
                >
                  {isVerifying ? (
                    <span>Memverifikasi...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Buka Folder</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* RECOVERY MODE: MASTER RECOVERY PIN */
          <form onSubmit={handleRecoverySubmit} className="p-6 space-y-5">
            {/* Info Banner */}
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-300">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Master Recovery PIN</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                PIN utama cadangan ini dapat digunakan untuk membuka atau mereset proteksi folder jika Anda lupa password folder.
              </p>
            </div>

            {!hasMasterPin ? (
              /* Master PIN is NOT configured yet */
              <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-2xl space-y-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-200">Master Recovery PIN Belum Diatur</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Anda belum mengonfigurasi Master Recovery PIN di aplikasi. Atur Master PIN sekarang melalui menu Pengaturan agar selalu memiliki cadangan akses.
                  </p>
                </div>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 mx-auto shadow-md"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Buka Pengaturan & Atur PIN</span>
                  </button>
                )}
              </div>
            ) : (
              /* Master PIN is configured */
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-rose-400" />
                      Masukkan Master Recovery PIN
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      ref={masterPinRef}
                      type={showMasterPin ? 'text' : 'password'}
                      value={masterPinInput}
                      onChange={(e) => setMasterPinInput(e.target.value)}
                      placeholder="Masukkan Master Recovery PIN Anda..."
                      disabled={isVerifying}
                      autoComplete="off"
                      className="w-full bg-slate-950 border border-rose-500/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-slate-100 text-sm rounded-xl pl-3.5 pr-11 py-3 outline-none transition-all font-mono"
                      id="master-recovery-pin-input"
                    />

                    <button
                      type="button"
                      onClick={() => setShowMasterPin(!showMasterPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                      title={showMasterPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                    >
                      {showMasterPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Recovery Action Chooser */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Pilih Tindakan Pemulihan:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryAction('unlock')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${
                        recoveryAction === 'unlock'
                          ? 'bg-rose-950/50 border-rose-500 text-rose-200 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Buka Sesi Ini</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-normal">
                        Buka sementara tanpa mengubah password folder
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecoveryAction('reset')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex flex-col gap-1 ${
                        recoveryAction === 'reset'
                          ? 'bg-rose-950/50 border-rose-500 text-rose-200 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reset Kunci Folder</span>
                      </div>
                      <span className="text-[10px] opacity-75 font-normal">
                        Hapus password folder & jadikan folder biasa
                      </span>
                    </button>
                  </div>
                </div>

                {/* Error Alert */}
                {errorMessage && (
                  <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span className="font-semibold leading-relaxed">{errorMessage}</span>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setUnlockMode('standard');
                  setErrorMessage(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Kembali ke Key Folder</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all"
                >
                  Batal
                </button>

                {hasMasterPin && (
                  <button
                    type="submit"
                    disabled={!masterPinInput.trim() || isVerifying}
                    className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                      !masterPinInput.trim() || isVerifying
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 active:scale-95'
                    }`}
                  >
                    {isVerifying ? (
                      <span>Memproses...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>{recoveryAction === 'reset' ? 'Reset Kunci' : 'Buka Folder'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
