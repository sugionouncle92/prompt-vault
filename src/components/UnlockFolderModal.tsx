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
  ArrowLeft,
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
  hashMasterFolderPassword,
  getEffectiveMasterFolderCredentials,
} from '../utils/security';

interface UnlockFolderModalProps {
  folder: FolderItem;
  securitySettings?: AppSettings['security'];
  onClose: () => void;
  onUnlockSuccess: (folderId: string) => void;
  onResetLock?: (folderId: string) => Promise<void> | void;
  onSaveLockConfig?: (updatedFields: Partial<FolderItem>) => Promise<void> | void;
  onUpdateFolderKey?: (folderId: string, keyHash: string, keySalt: string) => Promise<void> | void;
  onUpdateMasterFolderPassword?: (passwordHash: string, passwordSalt: string) => Promise<void> | void;
  onOpenSettings?: () => void;
}

type ModalMode = 'standard' | 'master_pin' | 'new_key';

export const UnlockFolderModal: React.FC<UnlockFolderModalProps> = ({
  folder,
  securitySettings,
  onClose,
  onUnlockSuccess,
  onResetLock,
  onSaveLockConfig,
  onUpdateFolderKey,
  onUpdateMasterFolderPassword,
  onOpenSettings,
}) => {
  const [mode, setMode] = useState<ModalMode>('standard');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Standard unlock state
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Master Recovery PIN state
  const hasMasterPin = isMasterRecoveryPinConfigured(securitySettings);
  const [masterPinInput, setMasterPinInput] = useState('');
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // New Master Folder Password state (Step 2 after recovery verification)
  const [newKeyInput, setNewKeyInput] = useState('');
  const [confirmKeyInput, setConfirmKeyInput] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [showConfirmKey, setShowConfirmKey] = useState(false);
  const [isSavingNewKey, setIsSavingNewKey] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const masterPinRef = useRef<HTMLInputElement>(null);
  const newKeyRef = useRef<HTMLInputElement>(null);

  const folderColor =
    FOLDER_COLORS.find((c) => c.value === folder.color) || FOLDER_COLORS[0];

  // Lockout tick countdown
  useEffect(() => {
    const checkLockout = () => {
      const remaining = getFolderLockoutRemainingSeconds(folder.id);
      setLockoutRemaining(remaining);
      if (remaining > 0 && mode === 'standard') {
        setErrorMessage(
          `Terlalu banyak percobaan salah (5x). Silakan tunggu ${remaining} detik sebelum mencoba kembali.`
        );
      } else if (errorMessage?.startsWith('Terlalu banyak') && remaining === 0) {
        setErrorMessage(null);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [folder.id, errorMessage, mode]);

  // Focus management
  useEffect(() => {
    if (mode === 'standard' && lockoutRemaining === 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (mode === 'master_pin') {
      setTimeout(() => masterPinRef.current?.focus(), 100);
    } else if (mode === 'new_key') {
      setTimeout(() => newKeyRef.current?.focus(), 100);
    }
  }, [mode, lockoutRemaining]);

  // 1. Standard key submit
  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || isVerifying || lockoutRemaining > 0) return;

    const creds = getEffectiveMasterFolderCredentials(securitySettings);
    const hashToTest = creds.hash || folder.keyHash;
    const saltToTest = creds.salt || folder.keySalt;

    if (!hashToTest || !saltToTest) {
      setErrorMessage('Master Folder Password belum dikonfigurasi di aplikasi.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const isValid = await verifyFolderKey(keyInput.trim(), hashToTest, saltToTest);

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
          setErrorMessage('Password salah. Silakan coba lagi atau gunakan Master Recovery PIN.');
        }
        setKeyInput('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Key verification error:', err);
      setErrorMessage('Terjadi kesalahan saat memverifikasi Master Folder Password.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 2. Verify Master Recovery PIN -> Proceed to Step 2 (Create New Master Password)
  const handleVerifyMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPinInput.trim() || isVerifyingPin) return;

    if (!hasMasterPin || !securitySettings?.masterPinHash || !securitySettings?.masterPinSalt) {
      setErrorMessage('Master Recovery PIN belum diatur di aplikasi.');
      return;
    }

    setIsVerifyingPin(true);
    setErrorMessage(null);

    try {
      const isMasterValid = await verifyMasterRecoveryPin(
        masterPinInput.trim(),
        securitySettings.masterPinHash,
        securitySettings.masterPinSalt
      );

      if (isMasterValid) {
        resetFailedAttempts(folder.id);
        setErrorMessage(null);
        setMode('new_key');
      } else {
        setErrorMessage('Master Recovery PIN salah! Silakan periksa kembali PIN pemulihan Anda.');
        setMasterPinInput('');
        masterPinRef.current?.focus();
      }
    } catch (err: any) {
      console.error('Master PIN error:', err);
      setErrorMessage(err.message || 'Gagal memverifikasi Master Recovery PIN.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // 3. Submit New Master Folder Password (Step 2)
  const handleSaveNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingNewKey) return;

    const key = newKeyInput.trim();
    const confirm = confirmKeyInput.trim();

    if (!key) {
      setErrorMessage('Master Password baru tidak boleh kosong.');
      return;
    }

    if (key.length < 4) {
      setErrorMessage('Master Folder Password baru minimal 4 karakter.');
      return;
    }

    if (key !== confirm) {
      setErrorMessage('Konfirmasi password tidak cocok. Pastikan keduanya sama persis.');
      return;
    }

    setIsSavingNewKey(true);
    setErrorMessage(null);

    try {
      const { masterPasswordHash, masterPasswordSalt } = await hashMasterFolderPassword(key);

      if (onUpdateMasterFolderPassword) {
        await onUpdateMasterFolderPassword(masterPasswordHash, masterPasswordSalt);
      }
      if (onUpdateFolderKey) {
        await onUpdateFolderKey(folder.id, masterPasswordHash, masterPasswordSalt);
      } else if (onSaveLockConfig) {
        await onSaveLockConfig({
          isLocked: true,
          keyHash: masterPasswordHash,
          keySalt: masterPasswordSalt,
          lockType: 'key',
        });
      }

      resetFailedAttempts(folder.id);
      onUnlockSuccess(folder.id);
      onClose();
    } catch (err: any) {
      console.error('Save new key error:', err);
      setErrorMessage(err.message || 'Gagal menyimpan Master Folder Password baru.');
    } finally {
      setIsSavingNewKey(false);
    }
  };

  // Optional: Remove Lock Completely
  const handleRemoveLockCompletely = async () => {
    if (!onResetLock || isSavingNewKey) return;
    setIsSavingNewKey(true);
    try {
      await onResetLock(folder.id);
      resetFailedAttempts(folder.id);
      onUnlockSuccess(folder.id);
      onClose();
    } catch (err: any) {
      console.error('Reset lock error:', err);
      setErrorMessage(err.message || 'Gagal menghapus proteksi folder.');
    } finally {
      setIsSavingNewKey(false);
    }
  };

  const isLockedOut = lockoutRemaining > 0 && mode === 'standard';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border ${
                mode === 'new_key'
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : mode === 'master_pin'
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
              }`}
            >
              {mode === 'new_key' ? (
                <KeyRound className="w-4 h-4" />
              ) : mode === 'master_pin' ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {mode === 'new_key' && 'Buat Master Password Baru'}
                {mode === 'master_pin' && 'Pemulihan via Master PIN'}
                {mode === 'standard' && 'Buka Kunci Folder'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'new_key' && `Folder: ${folder.name} — Data aman`}
                {mode === 'master_pin' && 'Verifikasi PIN pemulihan darurat'}
                {mode === 'standard' && 'Proteksi Privasi & Konten'}
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

        {/* ======================================================== */}
        {/* VIEW 1: STANDARD UNLOCK */}
        {/* ======================================================== */}
        {mode === 'standard' && (
          <form onSubmit={handleStandardSubmit} className="p-6 space-y-5">
            {/* Target Folder Pill */}
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className={`w-8 h-8 rounded-lg ${folderColor.bg} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                <Lock className="w-4 h-4 text-rose-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-200 truncate">{folder.name}</div>
                <div className="text-[11px] text-slate-500">Folder Dilindungi Master Password</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Masukkan Master Folder Password
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('master_pin');
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-1"
                  id="forgot-key-btn"
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
                  placeholder="Masukkan master password folder..."
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
                    <span className="text-[11px] opacity-80 mt-1 block">
                      Atau gunakan fitur <strong>Lupa Password?</strong> untuk memulihkan akses menggunakan Master Recovery PIN tanpa menunggu.
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
                  setErrorMessage(null);
                  setMode('master_pin');
                }}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 font-medium"
              >
                <Key className="w-3.5 h-3.5" />
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
        )}

        {/* ======================================================== */}
        {/* VIEW 2: MASTER RECOVERY PIN VERIFICATION */}
        {/* ======================================================== */}
        {mode === 'master_pin' && (
          <form onSubmit={handleVerifyMasterPin} className="p-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Verifikasi Master Recovery PIN</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Masukkan Master Recovery PIN darurat Anda untuk memulihkan akses dan membuat Master Folder Password baru.
              </p>
            </div>

            {hasMasterPin ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Masukkan Master Recovery PIN:
                </label>

                <div className="relative">
                  <input
                    ref={masterPinRef}
                    type={showMasterPin ? 'text' : 'password'}
                    value={masterPinInput}
                    onChange={(e) => setMasterPinInput(e.target.value)}
                    placeholder="Masukkan Master PIN Anda..."
                    disabled={isVerifyingPin}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-amber-500/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 text-sm rounded-xl pl-3.5 pr-11 py-3 outline-none font-mono"
                    id="master-pin-input"
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
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <p className="text-slate-300">
                  Master Recovery PIN belum dikonfigurasi di aplikasi ini.
                </p>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5 font-medium hover:underline text-xs"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Buka Pengaturan untuk atur Master Recovery PIN</span>
                  </button>
                )}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('standard');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Input Password</span>
              </button>

              <button
                type="submit"
                disabled={!hasMasterPin || !masterPinInput.trim() || isVerifyingPin}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                  !hasMasterPin || !masterPinInput.trim() || isVerifyingPin
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 active:scale-95'
                }`}
                id="submit-verify-master-pin-btn"
              >
                {isVerifyingPin ? (
                  <span>Memvalidasi...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verifikasi PIN</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: STEP 2 - BUAT MASTER FOLDER PASSWORD BARU */}
        {/* ======================================================== */}
        {mode === 'new_key' && (
          <form onSubmit={handleSaveNewKey} className="p-6 space-y-4">
            {/* Verification Success Pill */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verifikasi Identitas Berhasil!</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Terverifikasi melalui <strong className="text-emerald-300">Master Recovery PIN</strong>.
                Silakan buat Master Folder Password baru untuk membuka folder{' '}
                <strong className="text-slate-100">"{folder.name}"</strong>. Semua data prompt tersimpan aman.
              </p>
            </div>

            <div className="space-y-3">
              {/* Field 1: New Key */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Master Folder Password Baru (min 4 karakter):
                </label>
                <div className="relative">
                  <input
                    ref={newKeyRef}
                    type={showNewKey ? 'text' : 'password'}
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    placeholder="Masukkan Master Password baru..."
                    disabled={isSavingNewKey}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-emerald-500/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-100 text-sm rounded-xl pl-3.5 pr-11 py-2.5 outline-none font-mono"
                    id="new-access-key-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 2: Confirm New Key */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Konfirmasi Master Folder Password Baru:
                </label>
                <div className="relative">
                  <input
                    type={showConfirmKey ? 'text' : 'password'}
                    value={confirmKeyInput}
                    onChange={(e) => setConfirmKeyInput(e.target.value)}
                    placeholder="Ulangi Master Password baru..."
                    disabled={isSavingNewKey}
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-emerald-500/40 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-100 text-sm rounded-xl pl-3.5 pr-11 py-2.5 outline-none font-mono"
                    id="confirm-new-access-key-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmKey(!showConfirmKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    {showConfirmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {onResetLock && (
                <button
                  type="button"
                  onClick={handleRemoveLockCompletely}
                  disabled={isSavingNewKey}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                  title="Hilangkan kunci folder ini sehingga menjadi folder publik biasa"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Hapus Kunci Saja</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={!newKeyInput.trim() || !confirmKeyInput.trim() || isSavingNewKey}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                    !newKeyInput.trim() || !confirmKeyInput.trim() || isSavingNewKey
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-95'
                  }`}
                  id="save-new-key-btn"
                >
                  {isSavingNewKey ? (
                    <span>Menyimpan ke Cloud...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Simpan & Buka Folder</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
