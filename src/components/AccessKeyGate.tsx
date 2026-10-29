import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  HelpCircle,
  Key,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
} from 'lucide-react';
import { AppSecuritySettings, AppSettings } from '../services/firebaseService';
import {
  verifyVaultAccessKey,
  verifyMasterRecoveryPin,
  hashVaultAccessKey,
  getFolderLockoutRemainingSeconds,
  recordFailedAttempt,
  resetFailedAttempts,
  isMasterRecoveryPinConfigured,
  setSessionVaultUnlocked,
} from '../utils/security';

interface AccessKeyGateProps {
  securitySettings?: AppSecuritySettings;
  appSettings: AppSettings;
  onUnlockSuccess: () => void;
  onUpdateSecuritySettings: (updatedSecurity: AppSecuritySettings) => Promise<void>;
}

export const AccessKeyGate: React.FC<AccessKeyGateProps> = ({
  securitySettings,
  appSettings,
  onUnlockSuccess,
  onUpdateSecuritySettings,
}) => {
  const [gateMode, setGateMode] = useState<'access_key' | 'recovery_pin' | 'reset_key'>('access_key');
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [masterPinInput, setMasterPinInput] = useState('');
  const [newAccessKeyInput, setNewAccessKeyInput] = useState('');
  const [confirmAccessKeyInput, setConfirmAccessKeyInput] = useState('');
  const [newKeyHintInput, setNewKeyHintInput] = useState('');
  
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [showHintBox, setShowHintBox] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const keyInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const newKeyInputRef = useRef<HTMLInputElement>(null);

  const hasMasterPin = isMasterRecoveryPinConfigured(securitySettings);
  const hasHint = Boolean(securitySettings?.accessKeyHint?.trim());

  // Check lockout on mount and interval
  useEffect(() => {
    const updateLockout = () => {
      const remaining = getFolderLockoutRemainingSeconds('__app_access_gate__');
      setLockoutSeconds(remaining);
      if (remaining > 0 && gateMode === 'access_key') {
        setErrorMessage(
          `Terlalu banyak percobaan salah. Silakan tunggu ${remaining} detik sebelum mencoba kembali.`
        );
      } else if (errorMessage?.startsWith('Terlalu banyak') && remaining === 0) {
        setErrorMessage(null);
      }
    };

    updateLockout();
    const interval = setInterval(updateLockout, 1000);
    return () => clearInterval(interval);
  }, [errorMessage, gateMode]);

  // Autofocus based on mode
  useEffect(() => {
    if (gateMode === 'access_key' && lockoutSeconds === 0) {
      setTimeout(() => keyInputRef.current?.focus(), 150);
    } else if (gateMode === 'recovery_pin') {
      setTimeout(() => pinInputRef.current?.focus(), 150);
    } else if (gateMode === 'reset_key') {
      setTimeout(() => newKeyInputRef.current?.focus(), 150);
    }
  }, [gateMode, lockoutSeconds]);

  // Handle Access Key Submit
  const handleAccessKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKeyInput.trim() || isSubmitting || lockoutSeconds > 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const isValid = await verifyVaultAccessKey(
        accessKeyInput.trim(),
        securitySettings?.vaultAccessKeyHash,
        securitySettings?.vaultAccessKeySalt
      );

      if (isValid) {
        resetFailedAttempts('__app_access_gate__');
        setSessionVaultUnlocked(true);
        setSuccessMessage('Kunci Akses valid! Membuka PromptVault...');
        setTimeout(() => {
          onUnlockSuccess();
        }, 400);
      } else {
        const lockout = recordFailedAttempt('__app_access_gate__');
        if (lockout.isLockedOut) {
          setErrorMessage(
            `Kunci Akses salah 5 kali! Akses terkunci selama ${lockout.lockoutSeconds} detik demi keamanan.`
          );
        } else {
          setErrorMessage(
            `Kunci Akses tidak cocok. Sisa kesempatan: ${lockout.attemptsLeft} kali.`
          );
        }
      }
    } catch (err) {
      console.error('Error during access key verification:', err);
      setErrorMessage('Terjadi kesalahan saat memverifikasi kunci akses.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Recovery PIN Verification
  const handleRecoveryPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPinInput.trim() || isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const isPinValid = await verifyMasterRecoveryPin(
        masterPinInput.trim(),
        securitySettings?.masterPinHash,
        securitySettings?.masterPinSalt
      );

      if (isPinValid) {
        resetFailedAttempts('__app_access_gate__');
        setSuccessMessage('Master Recovery PIN terverifikasi!');
        // Transition to reset key or instant unlock choice
        setTimeout(() => {
          setGateMode('reset_key');
        }, 500);
      } else {
        setErrorMessage('Master Recovery PIN yang Anda masukkan salah.');
      }
    } catch (err) {
      console.error('Error verifying recovery pin:', err);
      setErrorMessage('Gagal memverifikasi Master Recovery PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct unlock via master PIN bypass
  const handleDirectUnlockViaPin = async () => {
    if (!masterPinInput.trim() || isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const isPinValid = await verifyMasterRecoveryPin(
        masterPinInput.trim(),
        securitySettings?.masterPinHash,
        securitySettings?.masterPinSalt
      );

      if (isPinValid) {
        resetFailedAttempts('__app_access_gate__');
        setSessionVaultUnlocked(true);
        setSuccessMessage('Akses diberikan via Master Recovery PIN. Membuka Vault...');
        setTimeout(() => {
          onUnlockSuccess();
        }, 500);
      } else {
        setErrorMessage('Master Recovery PIN salah.');
      }
    } catch (err) {
      console.error('Error direct unlock:', err);
      setErrorMessage('Gagal memverifikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reset & Overwrite Access Key in Cloud Database
  const handleResetAccessKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccessKeyInput.trim() || isSubmitting) return;

    if (newAccessKeyInput.trim().length < 4) {
      setErrorMessage('Kunci Akses baru minimal 4 karakter.');
      return;
    }

    if (newAccessKeyInput.trim() !== confirmAccessKeyInput.trim()) {
      setErrorMessage('Konfirmasi Kunci Akses baru tidak cocok.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { accessKeyHash, accessKeySalt } = await hashVaultAccessKey(newAccessKeyInput.trim());
      
      const updatedSec: AppSecuritySettings = {
        ...securitySettings,
        isVaultAccessKeyEnabled: true,
        vaultAccessKeyHash: accessKeyHash,
        vaultAccessKeySalt: accessKeySalt,
        accessKeyHint: newKeyHintInput.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };

      await onUpdateSecuritySettings(updatedSec);
      setSessionVaultUnlocked(true);
      setSuccessMessage('Kunci Akses baru berhasil disimpan ke Cloud Database! Membuka Vault...');

      setTimeout(() => {
        onUnlockSuccess();
      }, 700);
    } catch (err) {
      console.error('Error resetting access key:', err);
      setErrorMessage('Gagal menyimpan Kunci Akses baru ke database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl overflow-y-auto">
      {/* Background visual ambiance */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15),transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-indigo-500/30 rounded-3xl shadow-2xl shadow-indigo-950/50 overflow-hidden flex flex-col p-6 sm:p-8 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-xl shadow-indigo-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              {gateMode === 'access_key' ? (
                <Lock className="w-8 h-8 text-indigo-400 animate-pulse" />
              ) : gateMode === 'recovery_pin' ? (
                <ShieldAlert className="w-8 h-8 text-amber-400 animate-bounce" />
              ) : (
                <KeyRound className="w-8 h-8 text-emerald-400" />
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
              {gateMode === 'access_key' && 'PromptVault Access Gate'}
              {gateMode === 'recovery_pin' && 'Pemulihan Master PIN'}
              {gateMode === 'reset_key' && 'Konfigurasi Kunci Akses Baru'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {gateMode === 'access_key' && 'Aplikasi terproteksi dengan enkripsi hashing kriptografi SHA-256.'}
              {gateMode === 'recovery_pin' && 'Masukkan Master Recovery PIN darurat untuk membuka atau mereset kunci.'}
              {gateMode === 'reset_key' && 'Masukkan Kunci Akses baru untuk menggantikan kunci lama di Cloud Firestore.'}
            </p>
          </div>

          {/* Encryption Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[11px] font-medium text-indigo-300">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>PBKDF2 SHA-256 Cryptographic Security</span>
          </div>
        </div>

        {/* MODE 1: ACCESS KEY UNLOCK */}
        {gateMode === 'access_key' && (
          <form onSubmit={handleAccessKeySubmit} className="space-y-4" id="access-key-gate-form">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Kunci Akses Vault:</span>
                {hasHint && (
                  <button
                    type="button"
                    onClick={() => setShowHintBox(!showHintBox)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{showHintBox ? 'Sembunyikan Petunjuk' : 'Lihat Petunjuk'}</span>
                  </button>
                )}
              </label>

              <div className="relative">
                <input
                  ref={keyInputRef}
                  type={showAccessKey ? 'text' : 'password'}
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  placeholder="Masukkan Kunci Akses..."
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  className="w-full bg-slate-950/90 border border-slate-700 focus:border-indigo-500 text-slate-100 text-sm rounded-xl pl-4 pr-11 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono tracking-wider transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500"
                  id="vault-access-key-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessKey(!showAccessKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  title={showAccessKey ? 'Sembunyikan Kunci' : 'Tampilkan Kunci'}
                >
                  {showAccessKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            {/* Hint Box if revealed */}
            {showHintBox && hasHint && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-indigo-300 block">Petunjuk Kunci (Hint):</span>
                  <p className="text-slate-300 mt-0.5">{securitySettings?.accessKeyHint}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!accessKeyInput.trim() || isSubmitting || lockoutSeconds > 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
              id="submit-access-key-btn"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Kunci...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Buka Akses Vault</span>
                </>
              )}
            </button>

            {/* Recovery Option */}
            {hasMasterPin && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setGateMode('recovery_pin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-slate-400 hover:text-amber-300 transition-colors flex items-center justify-center gap-1.5 mx-auto"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lupa Kunci Akses? Buka dengan Master Recovery PIN</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* MODE 2: RECOVERY PIN */}
        {gateMode === 'recovery_pin' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-2xl text-xs text-amber-200/90 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">Mode Pemulihan Darurat</span>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Masukkan Master Recovery PIN yang telah Anda konfigurasi sebelumnya.
                </p>
              </div>
            </div>

            <form onSubmit={handleRecoveryPinSubmit} className="space-y-4" id="recovery-pin-form">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Master Recovery PIN:
                </label>
                <div className="relative">
                  <input
                    ref={pinInputRef}
                    type={showMasterPin ? 'text' : 'password'}
                    value={masterPinInput}
                    onChange={(e) => setMasterPinInput(e.target.value)}
                    placeholder="Masukkan Master PIN..."
                    disabled={isSubmitting}
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-amber-500 text-slate-100 text-sm rounded-xl pl-4 pr-11 py-3 outline-none focus:ring-2 focus:ring-amber-500/20 font-mono tracking-wider transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500"
                    id="master-recovery-pin-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPin(!showMasterPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    {showMasterPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDirectUnlockViaPin}
                  disabled={!masterPinInput.trim() || isSubmitting}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Buka Sesi Saja</span>
                </button>

                <button
                  type="submit"
                  disabled={!masterPinInput.trim() || isSubmitting}
                  className="py-2.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset Kunci Akses</span>
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setGateMode('access_key');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Kembali ke Layar Kunci Akses
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE 3: RESET ACCESS KEY */}
        {gateMode === 'reset_key' && (
          <form onSubmit={handleResetAccessKeySubmit} className="space-y-4" id="reset-access-key-form">
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200/90 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-300 block">Otorisasi PIN Berhasil</span>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Masukkan Kunci Akses baru. Data lama di Cloud Firestore akan langsung ditimpa secara aman.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Kunci Akses Baru (Min 4 karakter):
              </label>
              <div className="relative">
                <input
                  ref={newKeyInputRef}
                  type={showNewKey ? 'text' : 'password'}
                  value={newAccessKeyInput}
                  onChange={(e) => setNewAccessKeyInput(e.target.value)}
                  placeholder="Kunci baru..."
                  disabled={isSubmitting}
                  className="w-full bg-slate-950/90 border border-slate-700 focus:border-emerald-500 text-slate-100 text-sm rounded-xl pl-4 pr-11 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono tracking-wider transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewKey(!showNewKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                >
                  {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Konfirmasi Kunci Akses Baru:
              </label>
              <input
                type={showNewKey ? 'text' : 'password'}
                value={confirmAccessKeyInput}
                onChange={(e) => setConfirmAccessKeyInput(e.target.value)}
                placeholder="Ulangi kunci baru..."
                disabled={isSubmitting}
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-emerald-500 text-slate-100 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono tracking-wider transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Petunjuk Kunci / Hint (Opsional):</span>
                <span className="text-[10px] text-slate-500">Membantu mengingat</span>
              </label>
              <input
                type="text"
                value={newKeyHintInput}
                onChange={(e) => setNewKeyHintInput(e.target.value)}
                placeholder="Contoh: Tanggal penting / nama hewan..."
                disabled={isSubmitting}
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-indigo-500 text-slate-100 text-xs rounded-xl px-4 py-2.5 outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!newAccessKeyInput.trim() || isSubmitting}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              id="save-new-access-key-btn"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Cloud Firestore...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Simpan Kunci & Masuk Vault</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setGateMode('access_key');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Batal & Kembali
              </button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3 text-indigo-400" />
            <span>PromptVault Cloud Security System • Firestore Synchronized</span>
          </p>
        </div>
      </div>
    </div>
  );
};
