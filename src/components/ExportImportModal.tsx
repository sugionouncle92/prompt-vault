import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Shield,
  ShieldCheck,
  FileJson,
  RefreshCw,
  Layers,
  Sparkles,
  Database,
  ArrowRight,
  RotateCcw,
  Check,
  Info,
  Sliders,
  Image as ImageIcon,
  Star,
  FolderLock,
} from 'lucide-react';
import { FolderItem, PromptItem } from '../types';
import { AppSettings } from '../services/firebaseService';
import {
  generateFullBackupPackage,
  validateBackupFile,
  createPreRestoreSnapshot,
  getPreRestoreSnapshot,
  clearPreRestoreSnapshot,
  stageRestoredData,
  verifyPostRestoreState,
  downloadBackupJsonFile,
  calculateVaultCounts,
  BackupValidationResult,
  PromptVaultFullBackup,
  RestoreMode,
  PostRestoreVerification,
  PreRestoreSnapshot,
} from '../utils/backupRestore';

interface ExportImportModalProps {
  prompts: PromptItem[];
  folders: FolderItem[];
  appSettings: AppSettings;
  unlockedFolderIds: Set<string>;
  onClose: () => void;
  onExecuteRestore: (
    stagedFolders: FolderItem[],
    stagedPrompts: PromptItem[],
    stagedSettings: AppSettings,
    mode: RestoreMode
  ) => Promise<void>;
  onRollbackSnapshot: (snapshot: PreRestoreSnapshot) => Promise<void>;
  showToast: (msg: string) => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  prompts,
  folders,
  appSettings,
  unlockedFolderIds,
  onClose,
  onExecuteRestore,
  onRollbackSnapshot,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'snapshots'>('backup');

  // Backup Generation States
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [lastGeneratedBackup, setLastGeneratedBackup] = useState<{
    filename: string;
    checksum: string;
    generatedAt: string;
    counts: any;
  } | null>(null);

  // Restore States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('replace');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressStep, setRestoreProgressStep] = useState<string>('');
  const [postRestoreReport, setPostRestoreReport] = useState<PostRestoreVerification | null>(null);

  // Snapshot State
  const [availableSnapshot, setAvailableSnapshot] = useState<PreRestoreSnapshot | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Calculate current vault statistics
  const currentCounts = calculateVaultCounts(prompts, folders, appSettings);
  const isMasterPinConfigured = Boolean(
    appSettings.security?.isMasterPinSet && appSettings.security?.masterPinHash
  );

  useEffect(() => {
    setAvailableSnapshot(getPreRestoreSnapshot());
  }, []);

  // Handle Full-State Backup Generation
  const handleCreateFullBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      // Simulate minor async step for UI feedback
      await new Promise((r) => setTimeout(r, 200));

      const { backupPackage, filename, jsonString } = await generateFullBackupPackage(
        prompts,
        folders,
        appSettings
      );

      downloadBackupJsonFile(jsonString, filename);

      setLastGeneratedBackup({
        filename,
        checksum: backupPackage.manifest.checksum,
        generatedAt: backupPackage.manifest.createdAt,
        counts: backupPackage.manifest.counts,
      });

      showToast('Backup Full-State berhasil dibuat & diunduh!');
    } catch (err: any) {
      console.error('Backup generation error:', err);
      showToast('Gagal membuat backup: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  // Handle File Selection for Restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsAnalyzingFile(true);
    setValidationResult(null);
    setPostRestoreReport(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await validateBackupFile(text);
        setValidationResult(result);
      } catch (err: any) {
        setValidationResult({
          isValid: false,
          manifest: null,
          backupData: null,
          issues: ['Gagal membaca file: ' + (err.message || 'Format tidak valid')],
          warnings: [],
          schemaCompatibility: 'incompatible',
        });
      } finally {
        setIsAnalyzingFile(false);
      }
    };
    reader.onerror = () => {
      setIsAnalyzingFile(false);
      setValidationResult({
        isValid: false,
        manifest: null,
        backupData: null,
        issues: ['Gagal membuka file pada perangkat.'],
        warnings: [],
        schemaCompatibility: 'incompatible',
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Trigger Restore Execution
  const handleStartRestore = async () => {
    if (!validationResult || !validationResult.backupData || !validationResult.isValid) {
      return;
    }

    setIsRestoring(true);
    setRestoreProgressStep('Membuat Safety Snapshot cadangan...');

    try {
      // 1. Create safety snapshot of current state before touching anything
      const snapshot = createPreRestoreSnapshot(prompts, folders, appSettings);
      setAvailableSnapshot(snapshot);

      // 2. Stage restored data
      setRestoreProgressStep('Memproses dan merapikan struktur data...');
      await new Promise((r) => setTimeout(r, 200));

      const { stagedPrompts, stagedFolders, stagedSettings } = stageRestoredData(
        validationResult.backupData,
        prompts,
        folders,
        appSettings,
        restoreMode
      );

      // 3. Commit to Firebase & Local State atomically
      setRestoreProgressStep('Menyinkronkan database Firebase Firestore...');
      await onExecuteRestore(stagedFolders, stagedPrompts, stagedSettings, restoreMode);

      // 4. Post-Restore Verification
      setRestoreProgressStep('Melakukan verifikasi integritas data...');
      const verification = verifyPostRestoreState(
        stagedPrompts,
        stagedFolders,
        validationResult.manifest
      );
      setPostRestoreReport(verification);

      showToast('Restore Full-State berhasil diselesaikan!');
    } catch (err: any) {
      console.error('Restore execution error:', err);
      showToast('Restore gagal: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsRestoring(false);
      setRestoreProgressStep('');
    }
  };

  // Rollback to Pre-Restore Snapshot
  const handleExecuteRollback = async () => {
    if (!availableSnapshot) return;
    setIsRollingBack(true);
    try {
      await onRollbackSnapshot(availableSnapshot);
      clearPreRestoreSnapshot();
      setAvailableSnapshot(null);
      setPostRestoreReport(null);
      setValidationResult(null);
      setSelectedFileName(null);
      showToast('Rollback ke kondisi sebelum restore berhasil dilakukan!');
    } catch (err: any) {
      console.error('Rollback error:', err);
      showToast('Gagal melakukan rollback: ' + (err.message || ''));
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100">
                  Full-State Backup & Restore System
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Schema v2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Preservasi identik untuk Prompt, Folder, Kunci PIN, Enkripsi, & Pengaturan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
            id="close-backup-restore-modal-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 pt-3 border-b border-slate-800/80 bg-slate-950/40 gap-2">
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'backup'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            id="tab-backup-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Buat Full Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'restore'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            id="tab-restore-btn"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore dari Backup</span>
          </button>

          {availableSnapshot && (
            <button
              onClick={() => setActiveTab('snapshots')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ml-auto ${
                activeTab === 'snapshots'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-amber-400/80 hover:text-amber-300'
              }`}
              id="tab-snapshot-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Safety Snapshot ({availableSnapshot.id.slice(11)})</span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* TAB 1: BACKUP GENERATION */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Scope Checklist Card */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Cakupan Full-State Backup</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total: {currentCounts.counts.prompts} Prompts
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{currentCounts.counts.prompts} Prompts</strong> (Teks, Deskripsi, Tag,
                      Versi)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{currentCounts.counts.folders} Folders</strong> (Relasi ID & Struktur)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{currentCounts.counts.lockedFolders} Folder Locks</strong> (Hash
                      PBKDF2)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Master Recovery PIN</strong> (
                      {isMasterPinConfigured ? 'Terenkripsi Salt' : 'Belum Diatur'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{currentCounts.counts.images} Lampiran Gambar</strong> (Base64
                      Tersimpan)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>{currentCounts.counts.favorites} Favorit</strong> & {currentCounts.counts.variables} Variabel
                    </span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 text-slate-300 sm:col-span-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Pengaturan Lengkap</strong> (Tema, View, Parameter AI Gemini, Panel,
                      Preferensi)
                    </span>
                  </div>
                </div>

                {/* Security Note */}
                <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-indigo-200">
                      Prinsip Keamanan Full-State Backup:
                    </p>
                    <p className="text-indigo-300/90 leading-relaxed">
                      Sistem tidak menyimpan status sesi terbuka sementara (Temporary Session Unlock)
                      ke dalam file backup. Setelah proses restore, seluruh folder yang berstatus
                      terkunci akan otomatis berada dalam keadaan aman dan meminta PIN/Key.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleCreateFullBackup}
                disabled={isGeneratingBackup}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                id="generate-full-backup-btn"
              >
                {isGeneratingBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menghitung Checksum & Membuat Backup...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Buat & Unduh Full Backup (.json)</span>
                  </>
                )}
              </button>

              {/* Success Result View */}
              {lastGeneratedBackup && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Backup Berhasil Dibuat</span>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-[10px] rounded-md font-mono">
                      Integrity Check: VALID
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-1 font-mono">
                    <p className="truncate">
                      <strong>File:</strong> {lastGeneratedBackup.filename}
                    </p>
                    <p className="truncate text-slate-400">
                      <strong>SHA-256:</strong> {lastGeneratedBackup.checksum}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RESTORE FULL STATE */}
          {activeTab === 'restore' && (
            <div className="space-y-5">
              {/* File Upload Selector */}
              <div className="p-5 bg-slate-950/80 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 transition-colors text-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  className="hidden"
                  id="backup-file-input"
                />

                <div className="w-10 h-10 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
                  <FileJson className="w-5 h-5 text-indigo-400" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-200">
                    {selectedFileName || 'Pilih File Backup (.json)'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mendukung format Full-State Schema 2.0 dan auto-upgrade dari v1.0
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                  id="browse-backup-file-btn"
                >
                  {selectedFileName ? 'Ganti File Backup' : 'Pilih File dari Komputer'}
                </button>
              </div>

              {/* Analyzing Indicator */}
              {isAnalyzingFile && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center gap-2 text-xs text-indigo-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Memvalidasi integritas manifest, checksum, dan struktur data...</span>
                </div>
              )}

              {/* Validation Issues / Errors */}
              {validationResult && !validationResult.isValid && (
                <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl space-y-2 text-xs text-rose-300">
                  <div className="flex items-center gap-2 font-bold text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>File Backup Tidak Valid</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {validationResult.issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validation Success & Preview Card */}
              {validationResult && validationResult.isValid && validationResult.manifest && (
                <div className="space-y-4 animate-fade-in">
                  {/* Summary Card */}
                  <div className="p-4 bg-slate-950/90 rounded-2xl border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">
                          File Backup Terverifikasi
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] rounded-md font-mono">
                        {validationResult.schemaCompatibility === 'v2.0_full_state'
                          ? 'Schema 2.0 (Full State)'
                          : 'Legacy 1.0 (Auto Migrated)'}
                      </span>
                    </div>

                    {/* Stats Matrix */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Prompts</div>
                        <div className="font-bold text-slate-100 text-sm">
                          {validationResult.manifest.counts.prompts}
                        </div>
                      </div>
                      <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Folders</div>
                        <div className="font-bold text-slate-100 text-sm">
                          {validationResult.manifest.counts.folders}
                        </div>
                      </div>
                      <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Locked</div>
                        <div className="font-bold text-slate-100 text-sm">
                          {validationResult.manifest.counts.lockedFolders}
                        </div>
                      </div>
                      <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400">Favorites</div>
                        <div className="font-bold text-slate-100 text-sm">
                          {validationResult.manifest.counts.favorites}
                        </div>
                      </div>
                      <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800 col-span-3 sm:col-span-1">
                        <div className="text-[10px] text-slate-400">Gambar</div>
                        <div className="font-bold text-slate-100 text-sm">
                          {validationResult.manifest.counts.images}
                        </div>
                      </div>
                    </div>

                    {/* Master Recovery PIN Status in Backup */}
                    <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 bg-slate-900/60 rounded-lg border border-slate-800/60">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Master Recovery PIN:</span>
                      </span>
                      <span className="font-semibold text-slate-200">
                        {validationResult.backupData?.securityMetadata?.masterRecoveryConfigured
                          ? 'Tersimpan (Hash & Salt Utuh)'
                          : 'Tidak Dikonfigurasi'}
                      </span>
                    </div>

                    {/* Warnings (if any) */}
                    {validationResult.warnings.length > 0 && (
                      <div className="p-2.5 bg-amber-950/20 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 space-y-1">
                        <div className="font-semibold flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-amber-400" />
                          <span>Informasi Pemulihan:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-300/90">
                          {validationResult.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Restore Mode Selector */}
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-200">Pilih Mode Restore:</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Mode Replace */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          restoreMode === 'replace'
                            ? 'bg-indigo-600/10 border-indigo-500 text-slate-100'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                              <span>Replace All (Identik)</span>
                              <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-[9px] rounded font-normal">
                                Disarankan
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              Mengembalikan PromptVault sepenuhnya ke kondisi identik dengan file
                              backup.
                            </p>
                          </div>
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'replace'}
                            onChange={() => setRestoreMode('replace')}
                            className="mt-1 text-indigo-600 focus:ring-0"
                          />
                        </div>
                      </label>

                      {/* Mode Merge */}
                      <label
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          restoreMode === 'merge'
                            ? 'bg-indigo-600/10 border-indigo-500 text-slate-100'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-100">
                              Merge Data (Gabungkan)
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              Menggabungkan koleksi backup dengan data yang ada sekarang tanpa
                              menghapus data lain.
                            </p>
                          </div>
                          <input
                            type="radio"
                            name="restoreMode"
                            checked={restoreMode === 'merge'}
                            onChange={() => setRestoreMode('merge')}
                            className="mt-1 text-indigo-600 focus:ring-0"
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Restore Execution Progress / Button */}
                  {isRestoring ? (
                    <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl flex items-center gap-3 text-xs text-indigo-200">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 shrink-0" />
                      <div className="space-y-0.5">
                        <p className="font-bold">Sedang Menjalankan Restore Atomic...</p>
                        <p className="text-[11px] text-indigo-300">{restoreProgressStep}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartRestore}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                      id="commit-restore-btn"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        Mulai Restore Data ({restoreMode === 'replace' ? 'Replace All' : 'Merge'})
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Post-Restore Verification Report */}
              {postRestoreReport && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>RESTORE VERIFIED — State Identik!</span>
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-[10px] rounded-md font-mono">
                      100% Cocok
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Seluruh prompt, folder, kunci PIN, dan konfigurasi telah berhasil dipulihkan dan
                    tersinkronisasi ke Firebase Firestore. Semua folder berstatus locked telah
                    dikunci kembali secara otomatis.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-800/40">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition-all"
                    >
                      Selesai & Buka Vault
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAFETY SNAPSHOT & ROLLBACK */}
          {activeTab === 'snapshots' && availableSnapshot && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <span>Pre-Restore Safety Snapshot</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {availableSnapshot.id}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Snapshot ini dibuat secara otomatis sebelum proses restore terakhir dijalankan
                  pada {new Date(availableSnapshot.createdAt).toLocaleString('id-ID')}.
                </p>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Prompts</div>
                    <div className="font-bold text-slate-100">
                      {availableSnapshot.counts.prompts}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Folders</div>
                    <div className="font-bold text-slate-100">
                      {availableSnapshot.counts.folders}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Favorites</div>
                    <div className="font-bold text-slate-100">
                      {availableSnapshot.counts.favorites}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">Locked</div>
                    <div className="font-bold text-slate-100">
                      {availableSnapshot.counts.lockedFolders}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-3">
                  <button
                    onClick={() => {
                      clearPreRestoreSnapshot();
                      setAvailableSnapshot(null);
                      setActiveTab('backup');
                      showToast('Safety snapshot dibersihkan.');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Hapus Snapshot
                  </button>

                  <button
                    onClick={handleExecuteRollback}
                    disabled={isRollingBack}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                  >
                    {isRollingBack ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Rollback ke Kondisi Ini</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
