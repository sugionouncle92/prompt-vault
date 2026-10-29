import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  FolderInput,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Folder,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  KeyRound,
  Check,
} from 'lucide-react';
import { FolderItem, FOLDER_COLORS, PromptItem } from '../types';
import { AppSettings } from '../services/firebaseService';
import {
  verifyFolderKey,
  verifyMasterRecoveryPin,
  isMasterRecoveryPinConfigured,
  getFolderLockoutRemainingSeconds,
  recordFailedAttempt,
  resetFailedAttempts,
} from '../utils/security';

interface DeleteFolderModalProps {
  folder: FolderItem;
  folders: FolderItem[];
  prompts: PromptItem[];
  unlockedFolderIds: Set<string>;
  securitySettings?: AppSettings['security'];
  onClose: () => void;
  onConfirmRelocateAndDelete: (
    folderId: string,
    targetFolderId: string | null,
    affectedPrompts: PromptItem[]
  ) => Promise<boolean>;
  onConfirmDeleteAll: (folderId: string, affectedPrompts: PromptItem[]) => Promise<boolean>;
  onConfirmDeleteEmpty: (folderId: string) => Promise<boolean>;
}

type ModalStep = 'auth' | 'initial' | 'relocate' | 'confirm-delete-all';

export const DeleteFolderModal: React.FC<DeleteFolderModalProps> = ({
  folder,
  folders,
  prompts,
  unlockedFolderIds,
  securitySettings,
  onClose,
  onConfirmRelocateAndDelete,
  onConfirmDeleteAll,
  onConfirmDeleteEmpty,
}) => {
  // Count prompts belonging to this specific folderId
  const folderPrompts = prompts.filter((p) => p.folderId === folder.id);
  const promptCount = folderPrompts.length;

  // Check if authentication step is strictly required
  const isLocked = Boolean(folder.isLocked);
  const isAlreadyUnlockedInSession = unlockedFolderIds.has(folder.id);
  // If folder is locked, require verification (unless already verified in current session)
  const initialStep: ModalStep = isLocked && !isAlreadyUnlockedInSession ? 'auth' : 'initial';

  const [currentStep, setCurrentStep] = useState<ModalStep>(initialStep);

  // Authentication State
  const [authMode, setAuthMode] = useState<'standard' | 'recovery'>('standard');
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Relocation State
  const [selectedTargetFolderId, setSelectedTargetFolderId] = useState<string | null>(null);

  // Processing & Error State
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const authInputRef = useRef<HTMLInputElement>(null);
  const hasMasterPin = isMasterRecoveryPinConfigured(securitySettings);

  const colorConfig =
    FOLDER_COLORS.find((c) => c.value === folder.color) || FOLDER_COLORS[0];

  // Available destination folders (excluding the folder being deleted)
  const availableTargetFolders = folders.filter((f) => f.id !== folder.id);

  // Check lockout on mount and tick
  useEffect(() => {
    if (currentStep !== 'auth') return;
    const checkLockout = () => {
      const remaining = getFolderLockoutRemainingSeconds(folder.id);
      setLockoutRemaining(remaining);
      if (remaining > 0 && authMode === 'standard') {
        setAuthError(
          `Terlalu banyak percobaan salah. Silakan tunggu ${remaining} detik sebelum mencoba kembali.`
        );
      } else if (authError?.startsWith('Terlalu banyak') && remaining === 0) {
        setAuthError(null);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [folder.id, currentStep, authMode, authError]);

  useEffect(() => {
    if (currentStep === 'auth' && lockoutRemaining === 0) {
      setTimeout(() => authInputRef.current?.focus(), 100);
    }
  }, [currentStep, authMode, lockoutRemaining]);

  // Handle Authentication Submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim() || isVerifying || lockoutRemaining > 0) return;

    setIsVerifying(true);
    setAuthError(null);

    try {
      if (authMode === 'standard') {
        if (!folder.keyHash || !folder.keySalt) {
          setAuthError('Konfigurasi kunci folder rusak atau tidak ditemukan.');
          setIsVerifying(false);
          return;
        }

        const isValid = await verifyFolderKey(pinInput.trim(), folder.keyHash, folder.keySalt);
        if (isValid) {
          resetFailedAttempts(folder.id);
          setIsVerifying(false);
          setPinInput('');
          setCurrentStep('initial');
        } else {
          const lockoutStatus = recordFailedAttempt(folder.id);
          setIsVerifying(false);
          if (lockoutStatus.isLockedOut) {
            setLockoutRemaining(lockoutStatus.lockoutSeconds);
            setAuthError(
              `Terlalu banyak percobaan salah (5x). Silakan tunggu ${lockoutStatus.lockoutSeconds} detik.`
            );
          } else {
            setAuthError('Key folder salah. Silakan coba kembali atau gunakan Master Recovery PIN.');
          }
        }
      } else {
        // Recovery via Master Recovery PIN
        if (!securitySettings?.masterPinHash || !securitySettings?.masterPinSalt) {
          setAuthError('Master Recovery PIN belum dikonfigurasi di Pengaturan.');
          setIsVerifying(false);
          return;
        }

        const isValid = await verifyMasterRecoveryPin(
          pinInput.trim(),
          securitySettings.masterPinHash,
          securitySettings.masterPinSalt
        );

        setIsVerifying(false);
        if (isValid) {
          resetFailedAttempts(folder.id);
          setPinInput('');
          setCurrentStep('initial');
        } else {
          setAuthError('Master Recovery PIN salah. Silakan periksa kembali.');
        }
      }
    } catch (err) {
      console.error('Error during delete authentication:', err);
      setIsVerifying(false);
      setAuthError('Gagal memverifikasi kunci. Silakan coba lagi.');
    }
  };

  // Execution Handlers
  const handleExecuteDeleteEmpty = async () => {
    setIsProcessing(true);
    setOperationError(null);
    const success = await onConfirmDeleteEmpty(folder.id);
    if (!success) {
      setIsProcessing(false);
      setOperationError(
        'Folder gagal dihapus.\nTidak ada perubahan data yang diterapkan.\nSilakan coba kembali.'
      );
    }
  };

  const handleExecuteRelocateAndDelete = async () => {
    setIsProcessing(true);
    setOperationError(null);
    const success = await onConfirmRelocateAndDelete(
      folder.id,
      selectedTargetFolderId,
      folderPrompts
    );
    if (!success) {
      setIsProcessing(false);
      setOperationError(
        'Folder gagal dihapus.\nTidak ada perubahan data yang diterapkan.\nSilakan coba kembali.'
      );
    }
  };

  const handleExecuteDeleteAll = async () => {
    setIsProcessing(true);
    setOperationError(null);
    const success = await onConfirmDeleteAll(folder.id, folderPrompts);
    if (!success) {
      setIsProcessing(false);
      setOperationError(
        'Folder gagal dihapus.\nTidak ada perubahan data yang diterapkan.\nSilakan coba kembali.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5 text-slate-200 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        id="delete-folder-modal-container"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                currentStep === 'confirm-delete-all'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : currentStep === 'auth'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {currentStep === 'auth' ? (
                <Lock className="w-5 h-5" />
              ) : currentStep === 'confirm-delete-all' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100" id="delete-folder-modal-title">
                {currentStep === 'auth'
                  ? 'Verifikasi Keamanan Folder'
                  : currentStep === 'relocate'
                  ? 'Pindahkan Prompt'
                  : currentStep === 'confirm-delete-all'
                  ? 'Konfirmasi Hapus Folder & Isi'
                  : 'Hapus Folder?'}
              </h2>
              <p className="text-xs text-slate-400">
                {currentStep === 'auth'
                  ? 'Folder berstatus locked'
                  : `Kelola folder “${folder.name}”`}
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              id="close-delete-folder-modal-btn"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Global Error Banner */}
        {operationError && (
          <div className="bg-rose-950/60 border border-rose-500/50 rounded-2xl p-3.5 text-xs text-rose-300 space-y-1 animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Gagal Memproses Penghapusan</span>
            </div>
            <p className="whitespace-pre-line text-rose-300/90 leading-relaxed">
              {operationError}
            </p>
          </div>
        )}

        {/* STEP 1: AUTHENTICATION (FOR LOCKED FOLDERS) */}
        {currentStep === 'auth' && (
          <form onSubmit={handleAuthSubmit} className="space-y-4" id="folder-auth-form">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-xs text-amber-200 space-y-1">
              <p className="font-semibold text-amber-300">
                Folder &ldquo;{folder.name}&rdquo; diproteksi kunci keamanan.
              </p>
              <p className="text-amber-300/80 text-[11px] leading-relaxed">
                {authMode === 'standard'
                  ? 'Masukkan PIN / Key folder untuk memverifikasi kepemilikan sebelum penghapusan.'
                  : 'Masukkan Master Recovery PIN untuk memverifikasi hak akses administratif.'}
              </p>
            </div>

            {/* Auth Mode Switch */}
            {hasMasterPin && (
              <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('standard');
                    setAuthError(null);
                    setPinInput('');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors ${
                    authMode === 'standard'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  id="tab-standard-folder-pin"
                >
                  PIN Folder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('recovery');
                    setAuthError(null);
                    setPinInput('');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    authMode === 'recovery'
                      ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  id="tab-master-recovery-pin"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Master Recovery PIN
                </button>
              </div>
            )}

            {/* PIN Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                {authMode === 'standard' ? 'Masukkan Key / PIN Folder' : 'Masukkan Master Recovery PIN'}
              </label>
              <div className="relative">
                <input
                  ref={authInputRef}
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  disabled={lockoutRemaining > 0 || isVerifying}
                  placeholder={
                    authMode === 'standard'
                      ? 'Masukkan key folder...'
                      : 'Masukkan 6 digit master PIN...'
                  }
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 pr-10"
                  id="folder-auth-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  id="toggle-auth-pin-visibility"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5">
                {authError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isVerifying}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                id="cancel-folder-auth-btn"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!pinInput.trim() || isVerifying || lockoutRemaining > 0}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-1.5"
                id="verify-folder-auth-btn"
              >
                {isVerifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Verifikasi & Lanjutkan</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: INITIAL CONFIRMATION VIEW */}
        {currentStep === 'initial' && (
          <div className="space-y-5" id="delete-folder-initial-step">
            {/* Folder Highlight Box */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorConfig.bg} ${colorConfig.text} border border-slate-700/50 shadow-inner`}
                >
                  <Folder className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400">
                    {promptCount === 0 ? 'Anda yakin ingin menghapus folder:' : 'Anda akan menghapus folder:'}
                  </div>
                  <div className="text-sm font-bold text-slate-100 truncate">
                    &ldquo;{folder.name}&rdquo;
                  </div>
                </div>
              </div>

              {/* Prompt Count Status */}
              {promptCount > 0 ? (
                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-indigo-300 flex items-center justify-between">
                  <span>Isi Folder:</span>
                  <span className="font-bold text-indigo-200">
                    {promptCount} prompt
                  </span>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-400">
                  Folder ini kosong (0 prompt).
                </div>
              )}
            </div>

            {/* ACTION OPTIONS BASED ON PROMPT COUNT */}
            {promptCount === 0 ? (
              /* EMPTY FOLDER ACTION */
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                  id="cancel-delete-empty-folder-btn"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeleteEmpty}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
                  id="confirm-delete-empty-folder-btn"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Folder</span>
                </button>
              </div>
            ) : (
              /* FOLDER WITH PROMPTS ACTIONS */
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  Pilih tindakan:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Pindahkan Prompt */}
                  <button
                    type="button"
                    onClick={() => {
                      setOperationError(null);
                      setCurrentStep('relocate');
                    }}
                    disabled={isProcessing}
                    className="p-3.5 rounded-2xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 hover:border-indigo-500/60 text-left transition-all group flex flex-col justify-between space-y-2"
                    id="action-relocate-prompts-btn"
                  >
                    <div className="flex items-center justify-between">
                      <FolderInput className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                        Aman
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-200">
                        Pindahkan Prompt
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug pt-0.5">
                        Pindahkan {promptCount} prompt ke folder lain sebelum menghapus.
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Hapus Folder & Isi */}
                  <button
                    type="button"
                    onClick={() => {
                      setOperationError(null);
                      setCurrentStep('confirm-delete-all');
                    }}
                    disabled={isProcessing}
                    className="p-3.5 rounded-2xl bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 hover:border-rose-500/60 text-left transition-all group flex flex-col justify-between space-y-2"
                    id="action-delete-all-prompts-btn"
                  >
                    <div className="flex items-center justify-between">
                      <Trash2 className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-medium">
                        Permanen
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-200">
                        Hapus Folder &amp; Isi
                      </div>
                      <div className="text-[11px] text-slate-400 leading-snug pt-0.5">
                        Hapus folder beserta seluruh {promptCount} prompt di dalamnya.
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                    id="cancel-delete-folder-btn"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3A: RELOCATE PROMPTS SELECTOR */}
        {currentStep === 'relocate' && (
          <div className="space-y-4" id="delete-folder-relocate-step">
            <div className="space-y-1">
              <p className="text-xs text-slate-300">
                Pilih folder tujuan untuk memindahkan <strong>{promptCount} prompt</strong> dari folder &ldquo;{folder.name}&rdquo;:
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {/* Option: Tanpa Folder (Root) */}
              <label
                onClick={() => setSelectedTargetFolderId(null)}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedTargetFolderId === null
                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/70 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                    <Folder className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">
                      Tanpa Folder (Semua Prompt / Root)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Prompt akan tetap tersimpan tanpa terikat folder khusus.
                    </div>
                  </div>
                </div>
                {selectedTargetFolderId === null && (
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
              </label>

              {/* Other Custom Folders */}
              {availableTargetFolders.map((targetF) => {
                const isSelected = selectedTargetFolderId === targetF.id;
                const targetColor =
                  FOLDER_COLORS.find((c) => c.value === targetF.color) || FOLDER_COLORS[0];
                const countInTarget = prompts.filter((p) => p.folderId === targetF.id).length;

                return (
                  <label
                    key={targetF.id}
                    onClick={() => setSelectedTargetFolderId(targetF.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/70 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`w-7 h-7 rounded-lg ${targetColor.bg} ${targetColor.text} flex items-center justify-center border border-slate-700/50 shrink-0`}
                      >
                        <Folder className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {targetF.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {countInTarget} prompt saat ini
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                    )}
                  </label>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setOperationError(null);
                  setCurrentStep('initial');
                }}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                id="back-to-delete-options-btn"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteRelocateAndDelete}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                id="confirm-relocate-and-delete-btn"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <FolderInput className="w-3.5 h-3.5" />
                <span>Pindahkan &amp; Hapus Folder</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3B: SECOND PERMANENT CONFIRMATION VIEW */}
        {currentStep === 'confirm-delete-all' && (
          <div className="space-y-4" id="delete-folder-permanent-confirm-step">
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 text-xs text-rose-200 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Peringatan Penghapusan Permanen</span>
              </div>
              <p className="leading-relaxed text-rose-200/90">
                Tindakan ini akan menghapus folder &ldquo;<strong>{folder.name}</strong>&rdquo; dan seluruh <strong>{promptCount} prompt</strong> di dalamnya.
              </p>
              <div className="p-2.5 bg-rose-950/80 rounded-xl border border-rose-500/30 text-[11px] font-semibold text-rose-300">
                ⚠️ Tindakan ini tidak dapat dibatalkan. Seluruh data prompt terkait akan dihapus permanen dari Firebase.
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setOperationError(null);
                  setCurrentStep('initial');
                }}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                id="cancel-permanent-delete-all-btn"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Batal</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteDeleteAll}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
                id="confirm-permanent-delete-all-btn"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
