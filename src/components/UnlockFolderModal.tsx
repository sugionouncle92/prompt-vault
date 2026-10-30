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
  Mail,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Check,
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
  hashFolderKey,
  hashMasterFolderPassword,
  verifyMasterFolderPassword,
  getEffectiveMasterFolderCredentials,
} from '../utils/security';
import {
  requestEmailOtp,
  verifyEmailOtp,
  maskEmail,
} from '../utils/emailOtp';

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

type ModalMode = 'standard' | 'recovery_choice' | 'email_otp' | 'master_pin' | 'new_key';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Standard unlock state
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Email OTP Recovery state
  const recoveryEmailConfig = securitySettings?.recoveryEmail;
  const isEmailVerified =
    recoveryEmailConfig?.status === 'verified' && Boolean(recoveryEmailConfig?.email?.trim());
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentOnce, setOtpSentOnce] = useState(false);
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState<string | null>(null);

  // Master Recovery PIN state
  const hasMasterPin = isMasterRecoveryPinConfigured(securitySettings);
  const [masterPinInput, setMasterPinInput] = useState('');
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // New Access Key state (Step 2 after recovery verification)
  const [verifiedMethod, setVerifiedMethod] = useState<'email_otp' | 'master_pin'>('email_otp');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [confirmKeyInput, setConfirmKeyInput] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [showConfirmKey, setShowConfirmKey] = useState(false);
  const [isSavingNewKey, setIsSavingNewKey] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);
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

  // OTP cooldown countdown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Focus management
  useEffect(() => {
    if (mode === 'standard' && lockoutRemaining === 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else if (mode === 'email_otp' && otpSentOnce) {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } else if (mode === 'master_pin') {
      setTimeout(() => masterPinRef.current?.focus(), 100);
    } else if (mode === 'new_key') {
      setTimeout(() => newKeyRef.current?.focus(), 100);
    }
  }, [mode, lockoutRemaining, otpSentOnce]);

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
          setErrorMessage('Password salah. Silakan coba lagi atau gunakan pemulihan.');
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

  // 2. Dispatch Email OTP
  const handleSendEmailOtp = async () => {
    if (!recoveryEmailConfig?.email || isSendingOtp || otpCooldown > 0) return;

    setIsSendingOtp(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSimulatedOtpNotice(null);

    try {
      const res = await requestEmailOtp(
        recoveryEmailConfig.email,
        'reset_master_password',
        folder.id
      );

      if (res.success) {
        setOtpSentOnce(true);
        setOtpCooldown(res.resendAfterSeconds || 60);
        setSuccessMessage('Kode OTP 6 digit berhasil dikirim ke email pemulihan Anda.');
        if (res.simulatedOtp) {
          setSimulatedOtpNotice(`[Mode Simulasi: Kode OTP Anda adalah ${res.simulatedOtp}]`);
        }
      } else {
        setErrorMessage(res.error || 'Gagal mengirim kode OTP. Silakan coba lagi.');
        if (res.resendAfterSeconds) {
          setOtpCooldown(res.resendAfterSeconds);
        }
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat mengirim kode OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 3. Verify Email OTP -> Proceed to Step 2 (Create New Access Key)
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim() || isVerifyingOtp || !recoveryEmailConfig?.email) return;

    if (otpInput.trim().length !== 6) {
      setErrorMessage('Kode OTP harus berupa 6 digit angka.');
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      const res = await verifyEmailOtp(
        recoveryEmailConfig.email,
        otpInput.trim(),
        'reset_master_password'
      );

      if (res.success) {
        resetFailedAttempts(folder.id);
        setSuccessMessage(null);
        setErrorMessage(null);
        setVerifiedMethod('email_otp');
        setMode('new_key');
      } else {
        setErrorMessage(res.error || 'Kode OTP salah atau telah kedaluwarsa.');
        setOtpInput('');
        otpInputRef.current?.focus();
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setErrorMessage(err.message || 'Gagal memverifikasi kode OTP.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 4. Verify Master Recovery PIN -> Proceed to Step 2 (Create New Access Key)
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
        setSuccessMessage(null);
        setErrorMessage(null);
        setVerifiedMethod('master_pin');
        setMode('new_key');
      } else {
        setErrorMessage('Master Recovery PIN salah! Silakan periksa kembali PIN utama Anda.');
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

  // 5. Submit New Access Key (Step 2)
  const handleSaveNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingNewKey) return;

    const key = newKeyInput.trim();
    const confirm = confirmKeyInput.trim();

    if (!key) {
      setErrorMessage('Access Key baru tidak boleh kosong.');
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
                  : mode === 'email_otp'
                  ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                  : mode === 'master_pin'
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  : mode === 'recovery_choice'
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                  : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
              }`}
            >
              {mode === 'new_key' ? (
                <KeyRound className="w-4 h-4" />
              ) : mode === 'email_otp' ? (
                <Mail className="w-4 h-4" />
              ) : mode === 'master_pin' ? (
                <ShieldAlert className="w-4 h-4" />
              ) : mode === 'recovery_choice' ? (
                <HelpCircle className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {mode === 'new_key' && 'Buat Access Key Baru'}
                {mode === 'email_otp' && 'Pemulihan via Email OTP'}
                {mode === 'master_pin' && 'Pemulihan via Master PIN'}
                {mode === 'recovery_choice' && 'Pemulihan Access Key'}
                {mode === 'standard' && 'Buka Kunci Folder'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'new_key' && `Folder: ${folder.name} — Data aman`}
                {mode === 'email_otp' && 'Verifikasi kode OTP 6 digit'}
                {mode === 'master_pin' && 'Verifikasi PIN pemulihan darurat'}
                {mode === 'recovery_choice' && 'Pilih metode pemulihan mandiri'}
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
                    setMode('recovery_choice');
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium hover:underline flex items-center gap-1"
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
                      Atau gunakan fitur <strong>Lupa Kunci Akses?</strong> untuk memulihkan akses tanpa menunggu.
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
                  setMode('recovery_choice');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-medium"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Opsi Pemulihan</span>
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
        {/* VIEW 2: RECOVERY METHOD SELECTION */}
        {/* ======================================================== */}
        {mode === 'recovery_choice' && (
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200">Pilih Metode Pemulihan</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pilih salah satu metode berikut untuk memverifikasi identitas Anda dan membuat Access Key baru:
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* OPSI 1: EMAIL OTP */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isEmailVerified
                    ? 'bg-slate-950/70 border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-950/20'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-90'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isEmailVerified
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200">1. Pulihkan via Email OTP</span>
                      {isEmailVerified ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                          Terverifikasi
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Belum Aktif
                        </span>
                      )}
                    </div>

                    {isEmailVerified ? (
                      <>
                        <p className="text-[11px] text-slate-400">
                          Kirim kode 6 digit ke{' '}
                          <span className="font-mono text-blue-300 font-semibold">
                            {maskEmail(recoveryEmailConfig?.email || '')}
                          </span>
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage(null);
                              setMode('email_otp');
                              if (!otpSentOnce) {
                                handleSendEmailOtp();
                              }
                            }}
                            className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                            id="choose-email-otp-btn"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Gunakan Email OTP</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] text-amber-300/90 leading-relaxed bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20">
                          Email pemulihan belum tersedia. Silakan gunakan Master Recovery PIN atau daftarkan email pemulihan melalui Pengaturan Keamanan.
                        </p>
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSettings();
                            }}
                            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium hover:underline"
                          >
                            <SettingsIcon className="w-3 h-3" />
                            <span>Buka Pengaturan untuk daftarkan email</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* OPSI 2: MASTER RECOVERY PIN */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  hasMasterPin
                    ? 'bg-slate-950/70 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-950/20'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-90'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      hasMasterPin
                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200">2. Pulihkan via Master Recovery PIN</span>
                      {hasMasterPin ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                          PIN Siap
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Belum Diatur
                        </span>
                      )}
                    </div>

                    {hasMasterPin ? (
                      <>
                        <p className="text-[11px] text-slate-400">
                          Gunakan PIN keamanan utama Anda untuk verifikasi identitas dan atur Access Key baru.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMessage(null);
                              setMode('master_pin');
                            }}
                            className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                            id="choose-master-pin-btn"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Gunakan Master Recovery PIN</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          Master Recovery PIN belum dikonfigurasi di aplikasi ini.
                        </p>
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenSettings();
                            }}
                            className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium hover:underline"
                          >
                            <SettingsIcon className="w-3 h-3" />
                            <span>Atur Master PIN di Pengaturan</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setMode('standard');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Input Kunci</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: EMAIL OTP VERIFICATION */}
        {/* ======================================================== */}
        {mode === 'email_otp' && (
          <form onSubmit={handleVerifyEmailOtp} className="p-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-blue-300">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Verifikasi Email Terdaftar</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Kode verifikasi 6 digit dikirimkan ke:{' '}
                <strong className="font-mono text-blue-300">{maskEmail(recoveryEmailConfig?.email || '')}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Masukkan Kode OTP 6 Digit:</span>
                <span className="text-[10px] text-slate-500">Berlaku 5 menit</span>
              </label>

              <input
                ref={otpInputRef}
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                disabled={isVerifyingOtp}
                className="w-full bg-slate-950 border border-blue-500/40 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-100 text-center tracking-[0.4em] font-mono text-xl py-3 rounded-xl outline-none"
                autoComplete="one-time-code"
                id="email-otp-input"
              />
            </div>

            {/* Resend Cooldown UI */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-slate-400">Tidak menerima kode?</span>
              {otpCooldown > 0 ? (
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>Kirim ulang ({otpCooldown}s)</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendEmailOtp}
                  disabled={isSendingOtp}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                  <span>{isSendingOtp ? 'Mengirim...' : 'Kirim Ulang Kode OTP'}</span>
                </button>
              )}
            </div>

            {/* Simulated OTP notice if in dev mode */}
            {simulatedOtpNotice && (
              <div className="p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-[11px] font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{simulatedOtpNotice}</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setMode('recovery_choice');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ganti Metode</span>
              </button>

              <button
                type="submit"
                disabled={otpInput.trim().length !== 6 || isVerifyingOtp}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                  otpInput.trim().length !== 6 || isVerifyingOtp
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95'
                }`}
                id="submit-verify-otp-btn"
              >
                {isVerifyingOtp ? (
                  <span>Memvalidasi...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verifikasi Kode OTP</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: MASTER RECOVERY PIN VERIFICATION */}
        {/* ======================================================== */}
        {mode === 'master_pin' && (
          <form onSubmit={handleVerifyMasterPin} className="p-6 space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Verifikasi Master Recovery PIN</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Masukkan PIN darurat yang telah Anda konfigurasikan di menu Keamanan.
              </p>
            </div>

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
                  setMode('recovery_choice');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ganti Metode</span>
              </button>

              <button
                type="submit"
                disabled={!masterPinInput.trim() || isVerifyingPin}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                  !masterPinInput.trim() || isVerifyingPin
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
        {/* VIEW 5: STEP 2 - BUAT ACCESS KEY BARU */}
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
                Terverifikasi melalui{' '}
                <strong className="text-emerald-300">
                  {verifiedMethod === 'email_otp' ? 'Email OTP' : 'Master Recovery PIN'}
                </strong>
                . Silakan tentukan Access Key baru untuk folder{' '}
                <strong className="text-slate-100">"{folder.name}"</strong>. Semua data prompt tersimpan aman.
              </p>
            </div>

            <div className="space-y-3">
              {/* Field 1: New Key */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Access Key Baru (min 4 karakter):
                </label>
                <div className="relative">
                  <input
                    ref={newKeyRef}
                    type={showNewKey ? 'text' : 'password'}
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    placeholder="Masukkan Access Key baru..."
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
                  Konfirmasi Access Key Baru:
                </label>
                <div className="relative">
                  <input
                    type={showConfirmKey ? 'text' : 'password'}
                    value={confirmKeyInput}
                    onChange={(e) => setConfirmKeyInput(e.target.value)}
                    placeholder="Ulangi Access Key baru..."
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
