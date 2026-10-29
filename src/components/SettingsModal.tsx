import React, { useState } from 'react';
import {
  X,
  Sliders,
  Moon,
  Sun,
  Layout,
  Cpu,
  UploadCloud,
  Printer,
  Database,
  Check,
  RefreshCw,
  Palette,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Key,
  KeyRound,
  Trash2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  Zap,
} from 'lucide-react';
import { AppSettings, saveSettingsToFirebase } from '../services/firebaseService';
import { usePWA } from '../hooks/usePWA';
import {
  hashMasterRecoveryPin,
  verifyMasterRecoveryPin,
  isMasterRecoveryPinConfigured,
  hashVaultAccessKey,
  verifyVaultAccessKey,
  isVaultAccessKeyConfigured,
  setSessionVaultUnlocked,
} from '../utils/security';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  isFirebaseConnected: boolean;
  onRetryFirebase: () => void;
  onLockAllFolders?: () => void;
  onLockAppVaultNow?: () => void;
  lockedFoldersCount?: number;
  unlockedFoldersCount?: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  isFirebaseConnected,
  onRetryFirebase,
  onLockAllFolders,
  onLockAppVaultNow,
  lockedFoldersCount = 0,
  unlockedFoldersCount = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'gallery' | 'ai' | 'upload' | 'security' | 'preferences' | 'pwa'>('security');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lockAllNotice, setLockAllNotice] = useState(false);
  const {
    isInstallable,
    isStandalone,
    isIOS,
    isAndroid,
    platform,
    isInIframe,
    diagnostics,
    installPWA,
    refreshDiagnostics,
  } = usePWA();
  const [pwaInstallMessage, setPwaInstallMessage] = useState<string | null>(null);
  const [isTestingPWADiag, setIsTestingPWADiag] = useState(false);

  // App Vault Access Key Editor States
  const [isEditingAccessKey, setIsEditingAccessKey] = useState(false);
  const [accessKeyMode, setAccessKeyMode] = useState<'set' | 'change' | 'remove'>('set');
  const [currentAccessKeyInput, setCurrentAccessKeyInput] = useState('');
  const [newAccessKeyInput, setNewAccessKeyInput] = useState('');
  const [confirmAccessKeyInput, setConfirmAccessKeyInput] = useState('');
  const [accessKeyHintInput, setAccessKeyHintInput] = useState(settings.security?.accessKeyHint || '');
  const [showAccessKeyFields, setShowAccessKeyFields] = useState(false);
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);
  const [accessKeySuccess, setAccessKeySuccess] = useState<string | null>(null);
  const [isSavingAccessKey, setIsSavingAccessKey] = useState(false);

  const isVaultKeyActive = isVaultAccessKeyConfigured(settings.security);

  // Master Recovery PIN Editor States
  const [isEditingMasterPin, setIsEditingMasterPin] = useState(false);
  const [masterPinMode, setMasterPinMode] = useState<'set' | 'change' | 'remove'>('set');
  const [currentMasterPinInput, setCurrentMasterPinInput] = useState('');
  const [newMasterPinInput, setNewMasterPinInput] = useState('');
  const [confirmMasterPinInput, setConfirmMasterPinInput] = useState('');
  const [showMasterPinFields, setShowMasterPinFields] = useState(false);
  const [masterPinError, setMasterPinError] = useState<string | null>(null);
  const [masterPinSuccess, setMasterPinSuccess] = useState<string | null>(null);
  const [isSavingMasterPin, setIsSavingMasterPin] = useState(false);

  const isMasterPinActive = isMasterRecoveryPinConfigured(settings.security);

  // Vault Access Key Actions
  const handleStartAccessKeyEdit = (mode: 'set' | 'change' | 'remove') => {
    setAccessKeyMode(mode);
    setCurrentAccessKeyInput('');
    setNewAccessKeyInput('');
    setConfirmAccessKeyInput('');
    setAccessKeyHintInput(settings.security?.accessKeyHint || '');
    setAccessKeyError(null);
    setAccessKeySuccess(null);
    setIsEditingAccessKey(true);
  };

  const handleCancelAccessKeyEdit = () => {
    setIsEditingAccessKey(false);
    setCurrentAccessKeyInput('');
    setNewAccessKeyInput('');
    setConfirmAccessKeyInput('');
    setAccessKeyError(null);
    setAccessKeySuccess(null);
  };

  const handleSaveAccessKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessKeyError(null);
    setAccessKeySuccess(null);

    // MODE: SET NEW ACCESS KEY
    if (accessKeyMode === 'set') {
      if (!newAccessKeyInput.trim()) {
        setAccessKeyError('Kunci Akses tidak boleh kosong.');
        return;
      }
      if (newAccessKeyInput.trim().length < 4) {
        setAccessKeyError('Kunci Akses minimal 4 karakter untuk standar keamanan SHA-256.');
        return;
      }
      if (newAccessKeyInput.trim() !== confirmAccessKeyInput.trim()) {
        setAccessKeyError('Konfirmasi Kunci Akses tidak cocok.');
        return;
      }

      setIsSavingAccessKey(true);
      try {
        const { accessKeyHash, accessKeySalt } = await hashVaultAccessKey(newAccessKeyInput.trim());
        const updatedSettings: AppSettings = {
          ...settings,
          security: {
            ...settings.security,
            isVaultAccessKeyEnabled: true,
            vaultAccessKeyHash: accessKeyHash,
            vaultAccessKeySalt: accessKeySalt,
            accessKeyHint: accessKeyHintInput.trim() || undefined,
            updatedAt: new Date().toISOString(),
          },
        };
        onUpdateSettings(updatedSettings);
        triggerAutoSave(updatedSettings);
        setSessionVaultUnlocked(true);
        setAccessKeySuccess('Kunci Akses berhasil diaktifkan & disimpan ke Cloud Firestore!');
        setTimeout(() => {
          setIsEditingAccessKey(false);
        }, 1200);
      } catch (err) {
        console.error('Failed to set access key:', err);
        setAccessKeyError('Gagal menyimpan Kunci Akses.');
      } finally {
        setIsSavingAccessKey(false);
      }
    }

    // MODE: CHANGE EXISTING ACCESS KEY
    else if (accessKeyMode === 'change') {
      if (!currentAccessKeyInput.trim()) {
        setAccessKeyError('Masukkan Kunci Akses saat ini.');
        return;
      }
      if (!newAccessKeyInput.trim()) {
        setAccessKeyError('Masukkan Kunci Akses baru.');
        return;
      }
      if (newAccessKeyInput.trim().length < 4) {
        setAccessKeyError('Kunci Akses baru minimal 4 karakter.');
        return;
      }
      if (newAccessKeyInput.trim() !== confirmAccessKeyInput.trim()) {
        setAccessKeyError('Konfirmasi Kunci Akses baru tidak cocok.');
        return;
      }

      setIsSavingAccessKey(true);
      try {
        const isValid = await verifyVaultAccessKey(
          currentAccessKeyInput.trim(),
          settings.security?.vaultAccessKeyHash,
          settings.security?.vaultAccessKeySalt
        );

        if (!isValid) {
          setAccessKeyError('Kunci Akses saat ini tidak cocok.');
          setIsSavingAccessKey(false);
          return;
        }

        const { accessKeyHash, accessKeySalt } = await hashVaultAccessKey(newAccessKeyInput.trim());
        const updatedSettings: AppSettings = {
          ...settings,
          security: {
            ...settings.security,
            isVaultAccessKeyEnabled: true,
            vaultAccessKeyHash: accessKeyHash,
            vaultAccessKeySalt: accessKeySalt,
            accessKeyHint: accessKeyHintInput.trim() || undefined,
            updatedAt: new Date().toISOString(),
          },
        };
        onUpdateSettings(updatedSettings);
        triggerAutoSave(updatedSettings);
        setSessionVaultUnlocked(true);
        setAccessKeySuccess('Kunci Akses berhasil diperbarui di Cloud Database!');
        setTimeout(() => {
          setIsEditingAccessKey(false);
        }, 1200);
      } catch (err) {
        console.error('Failed to change access key:', err);
        setAccessKeyError('Gagal memperbarui Kunci Akses.');
      } finally {
        setIsSavingAccessKey(false);
      }
    }

    // MODE: REMOVE ACCESS KEY
    else if (accessKeyMode === 'remove') {
      if (!currentAccessKeyInput.trim()) {
        setAccessKeyError('Masukkan Kunci Akses saat ini untuk konfirmasi penonaktifan.');
        return;
      }

      setIsSavingAccessKey(true);
      try {
        const isValid = await verifyVaultAccessKey(
          currentAccessKeyInput.trim(),
          settings.security?.vaultAccessKeyHash,
          settings.security?.vaultAccessKeySalt
        );

        if (!isValid) {
          setAccessKeyError('Kunci Akses saat ini tidak cocok.');
          setIsSavingAccessKey(false);
          return;
        }

        const updatedSettings: AppSettings = {
          ...settings,
          security: {
            ...settings.security,
            isVaultAccessKeyEnabled: false,
            vaultAccessKeyHash: '',
            vaultAccessKeySalt: '',
            accessKeyHint: '',
            updatedAt: new Date().toISOString(),
          },
        };
        onUpdateSettings(updatedSettings);
        triggerAutoSave(updatedSettings);
        setSessionVaultUnlocked(true);
        setAccessKeySuccess('Proteksi Kunci Akses Vault berhasil dinonaktifkan.');
        setTimeout(() => {
          setIsEditingAccessKey(false);
        }, 1200);
      } catch (err) {
        console.error('Failed to remove access key:', err);
        setAccessKeyError('Gagal menonaktifkan Kunci Akses.');
      } finally {
        setIsSavingAccessKey(false);
      }
    }
  };

  const handleStartMasterPinEdit = (mode: 'set' | 'change' | 'remove') => {
    setMasterPinMode(mode);
    setCurrentMasterPinInput('');
    setNewMasterPinInput('');
    setConfirmMasterPinInput('');
    setMasterPinError(null);
    setMasterPinSuccess(null);
    setIsEditingMasterPin(true);
  };

  const handleCancelMasterPinEdit = () => {
    setIsEditingMasterPin(false);
    setCurrentMasterPinInput('');
    setNewMasterPinInput('');
    setConfirmMasterPinInput('');
    setMasterPinError(null);
    setMasterPinSuccess(null);
  };

  const handleSaveMasterPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMasterPinError(null);
    setMasterPinSuccess(null);

    // MODE: SET NEW PIN
    if (masterPinMode === 'set') {
      if (!newMasterPinInput.trim()) {
        setMasterPinError('Master Recovery PIN tidak boleh kosong.');
        return;
      }
      if (newMasterPinInput.trim().length < 4) {
        setMasterPinError('Master Recovery PIN minimal 4 karakter/digit untuk keamanan.');
        return;
      }
      if (newMasterPinInput.trim() !== confirmMasterPinInput.trim()) {
        setMasterPinError('Konfirmasi Master Recovery PIN tidak cocok.');
        return;
      }

      setIsSavingMasterPin(true);
      try {
        const { masterPinHash, masterPinSalt } = await hashMasterRecoveryPin(newMasterPinInput.trim());
        const updatedSettings: AppSettings = {
          ...settings,
          security: {
            ...settings.security,
            masterPinHash,
            masterPinSalt,
            isMasterPinSet: true,
            updatedAt: new Date().toISOString(),
          },
        };
        onUpdateSettings(updatedSettings);
        triggerAutoSave(updatedSettings);
        setMasterPinSuccess('Master Recovery PIN berhasil diaktifkan & disimpan ke Firebase!');
        setTimeout(() => {
          setIsEditingMasterPin(false);
        }, 1200);
      } catch (err) {
        console.error('Failed to set master pin:', err);
        setMasterPinError('Gagal menyimpan Master Recovery PIN.');
      } finally {
        setIsSavingMasterPin(false);
      }
    }

    // MODE: CHANGE EXISTING PIN
    else if (masterPinMode === 'change') {
      if (!currentMasterPinInput.trim()) {
        setMasterPinError('Masukkan Master PIN saat ini.');
        return;
      }
      if (!newMasterPinInput.trim()) {
        setMasterPinError('Masukkan Master PIN baru.');
        return;
      }
      if (newMasterPinInput.trim().length < 4) {
        setMasterPinError('Master PIN baru minimal 4 karakter/digit.');
        return;
      }
      if (newMasterPinInput.trim() !== confirmMasterPinInput.trim()) {
        setMasterPinError('Konfirmasi Master PIN baru tidak cocok.');
        return;
      }

      setIsSavingMasterPin(true);
      try {
        const isCurrentValid = await verifyMasterRecoveryPin(
          currentMasterPinInput.trim(),
          settings.security?.masterPinHash,
          settings.security?.masterPinSalt
        );

        if (!isCurrentValid) {
          setMasterPinError('Master Recovery PIN saat ini salah.');
          setIsSavingMasterPin(false);
          return;
        }

        const { masterPinHash, masterPinSalt } = await hashMasterRecoveryPin(newMasterPinInput.trim());
        const updatedSettings: AppSettings = {
          ...settings,
          security: {
            ...settings.security,
            masterPinHash,
            masterPinSalt,
            isMasterPinSet: true,
            updatedAt: new Date().toISOString(),
          },
        };
        onUpdateSettings(updatedSettings);
        triggerAutoSave(updatedSettings);
        setMasterPinSuccess('Master Recovery PIN berhasil diperbarui di Firebase!');
        setTimeout(() => {
          setIsEditingMasterPin(false);
        }, 1200);
      } catch (err) {
        console.error('Failed to change master pin:', err);
        setMasterPinError('Gagal memperbarui Master Recovery PIN.');
      } finally {
        setIsSavingMasterPin(false);
      }
    }

    // MODE: REMOVE PIN
    else if (masterPinMode === 'remove') {
      if (!currentMasterPinInput.trim()) {
        setMasterPinError('Masukkan Master PIN saat ini untuk konfirmasi penghapusan.');
        return;
      }

      setIsSavingMasterPin(true);
      try {
        const isCurrentValid = await verifyMasterRecoveryPin(
          currentMasterPinInput.trim(),
          settings.security?.masterPinHash,
          settings.security?.masterPinSalt
        );

        if (!isCurrentValid) {
          setMasterPinError('Master PIN saat ini salah.');
          setIsSavingMasterPin(false);
          return;
        }

        const updatedSettings: AppSettings = {
          ...settings,
          security: {
            masterPinHash: '',
            masterPinSalt: '',
            isMasterPinSet: false,
            updatedAt: new Date().toISOString(),
          },
        };
        onUpdateSettings(updatedSettings);
        triggerAutoSave(updatedSettings);
        setMasterPinSuccess('Master Recovery PIN berhasil dinonaktifkan.');
        setTimeout(() => {
          setIsEditingMasterPin(false);
        }, 1200);
      } catch (err) {
        console.error('Failed to remove master pin:', err);
        setMasterPinError('Gagal menghapus Master Recovery PIN.');
      } finally {
        setIsSavingMasterPin(false);
      }
    }
  };

  // Helper to handle partial updates and auto-sync to Firebase
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);
    triggerAutoSave(updated);
  };

  const updateNestedSetting = <K extends keyof AppSettings>(
    category: K,
    subKey: string,
    value: any
  ) => {
    const currentCategoryObj = (settings[category] as Record<string, any>) || {};
    const updatedCategoryObj = { ...currentCategoryObj, [subKey]: value };
    const updatedSettings = { ...settings, [category]: updatedCategoryObj };
    onUpdateSettings(updatedSettings);
    triggerAutoSave(updatedSettings);
  };

  const triggerAutoSave = (updated: AppSettings) => {
    setSaveStatus('saving');
    saveSettingsToFirebase(updated)
      .then(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      })
      .catch(() => setSaveStatus('idle'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <SettingsIcon className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Pengaturan Aplikasi & Firebase
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Auto-Sync Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Semua perubahan otomatis tersimpan di Firebase Cloud Firestore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync status pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
              {saveStatus === 'saving' && (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  <span className="text-amber-400">Menyimpan...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Tersimpan ke Firebase</span>
                </>
              )}
              {saveStatus === 'idle' && (
                <>
                  <Database className={`w-3 h-3 ${isFirebaseConnected ? 'text-emerald-400' : 'text-red-400'}`} />
                  <span>{isFirebaseConnected ? 'Firebase Terhubung' : 'Terputus'}</span>
                </>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              id="close-settings-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'theme'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Tema & Tampilan</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>Galeri & Layout</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'ai'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Pengaturan AI</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload, Crop & Ekspor</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            id="settings-security-tab-btn"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Keamanan & Kunci Akses</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'preferences'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Preferensi & Database</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'pwa'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            id="settings-pwa-tab-btn"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>PWA & Android App</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 text-sm">
          
          {/* TAB 1: TEMA & TAMPILAN */}
          {activeTab === 'theme' && (
            <div className="space-y-6">
              {/* Theme selector */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-100 uppercase tracking-wider block">
                    Mode Tema Tampilan
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Aktif: <strong className="text-indigo-400">{settings.theme === 'light' ? 'Tema Terang' : 'Tema Gelap'}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateSetting('theme', 'dark')}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      settings.theme !== 'light'
                        ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 ring-2 ring-indigo-500/20 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">🌙 Tema Gelap</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">Default</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Latar gelap pekat nyaman untuk mata saat bekerja di ruangan redup.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSetting('theme', 'light')}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      settings.theme === 'light'
                        ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 ring-2 ring-indigo-500/20 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">☀️ Tema Terang</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">Baru</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        Latar putih-slate bersih dan profesional untuk visibilitas siang hari.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Layout Density Radio buttons */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Kepadatan Tata Letak (Layout Density)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['comfortable', 'compact', 'spacious'] as const).map((density) => (
                    <label
                      key={density}
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                        settings.preferences.compactDensity === density
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="layoutDensity"
                        checked={settings.preferences.compactDensity === density}
                        onChange={() => updateNestedSetting('preferences', 'compactDensity', density)}
                        className="accent-indigo-500"
                      />
                      <span className="capitalize">{density}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Font scale slider */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Skala Ukuran Teks (Font Scale)
                  </label>
                  <span className="text-xs font-mono text-indigo-400 font-semibold">
                    {settings.preferences.fontScale}%
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={130}
                  step={5}
                  value={settings.preferences.fontScale}
                  onChange={(e) => updateNestedSetting('preferences', 'fontScale', Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Color Picker */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-400" />
                    <span>Warna Aksen Utama</span>
                  </label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GALERI & LAYOUT */}
          {activeTab === 'gallery' && (
            <div className="space-y-6">
              {/* Grid Columns Slider */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Jumlah Kolom Grid Galeri
                  </label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">
                    {settings.gallerySettings.gridColumns} Kolom
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={settings.gallerySettings.gridColumns}
                  onChange={(e) => updateNestedSetting('gallerySettings', 'gridColumns', Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Card Style Dropdown */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Gaya Kartu Prompt (Card Style)
                </label>
                <select
                  value={settings.gallerySettings.cardStyle}
                  onChange={(e) => updateNestedSetting('gallerySettings', 'cardStyle', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                >
                  <option value="bordered">Modern Bordered</option>
                  <option value="glass">Glassmorphism Dark</option>
                  <option value="flat">Minimalist Flat</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Elemen Visual Kartu
                </label>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Tampilkan Preview Gambar Lampiran</span>
                  <input
                    type="checkbox"
                    checked={settings.preferences.showImagePreviews}
                    onChange={(e) => updateNestedSetting('preferences', 'showImagePreviews', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Tampilkan Tag Badge di Grid</span>
                  <input
                    type="checkbox"
                    checked={settings.preferences.showTagsInGrid}
                    onChange={(e) => updateNestedSetting('preferences', 'showTagsInGrid', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Tampilkan Penolong Variabel Dynamic</span>
                  <input
                    type="checkbox"
                    checked={settings.preferences.showVariableHelper}
                    onChange={(e) => updateNestedSetting('preferences', 'showVariableHelper', e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Panel Sizes Sliders */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-4">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Ukuran & Posisi Panel
                </label>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Lebar Sidebar (px)</span>
                    <span className="font-mono text-indigo-400">{settings.panelSizes.sidebarWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={220}
                    max={360}
                    step={10}
                    value={settings.panelSizes.sidebarWidth}
                    onChange={(e) => updateNestedSetting('panelSizes', 'sidebarWidth', Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PENGATURAN AI */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {/* Default Model */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Model AI Default (Gemini)
                </label>
                <select
                  value={settings.aiSettings.model}
                  onChange={(e) => updateNestedSetting('aiSettings', 'model', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Super Fast & Responsive)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                </select>
              </div>

              {/* Temperature */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Temperature Kreativitas AI
                  </label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">
                    {settings.aiSettings.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.1}
                  value={settings.aiSettings.temperature}
                  onChange={(e) => updateNestedSetting('aiSettings', 'temperature', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Max Tokens */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Maksimum Output Tokens
                </label>
                <input
                  type="number"
                  min={256}
                  max={8192}
                  step={256}
                  value={settings.aiSettings.maxTokens}
                  onChange={(e) => updateNestedSetting('aiSettings', 'maxTokens', parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                />
              </div>

              {/* System Prompt */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  System Instructions (Context AI)
                </label>
                <textarea
                  rows={3}
                  value={settings.aiSettings.systemPrompt}
                  onChange={(e) => updateNestedSetting('aiSettings', 'systemPrompt', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none resize-none"
                />
              </div>

              {/* Auto Optimize Toggle */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Otomatis Optimasi Prompt</span>
                  <span className="text-[11px] text-slate-400">Gunakan kecerdasan Gemini untuk menyempurnakan prompt</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.aiSettings.autoOptimize}
                  onChange={(e) => updateNestedSetting('aiSettings', 'autoOptimize', e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: UPLOAD, CROP & EKSPOR */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Max Upload File Size */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Batas Ukuran Maksimal Upload Lampiran (MB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.preferences.uploadMaxSizeMB}
                  onChange={(e) => updateNestedSetting('preferences', 'uploadMaxSizeMB', Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                />
              </div>

              {/* Crop Aspect Ratio */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Preset Aspek Rasio Crop Gambar
                </label>
                <select
                  value={settings.preferences.cropAspect}
                  onChange={(e) => updateNestedSetting('preferences', 'cropAspect', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                >
                  <option value="free">Bebas (Freeform)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="4:3">4:3 (Standard)</option>
                </select>
              </div>

              {/* Export Format Radio */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Format Ekspor Default
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['json', 'csv', 'markdown'] as const).map((fmt) => (
                    <label
                      key={fmt}
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                        settings.preferences.exportFormat === fmt
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={settings.preferences.exportFormat === fmt}
                        onChange={() => updateNestedSetting('preferences', 'exportFormat', fmt)}
                        className="accent-indigo-500"
                      />
                      <span className="uppercase">{fmt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Print Header Toggle */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    Cetak Header Dokumen saat Print
                  </span>
                  <span className="text-[11px] text-slate-400">Sertakan tanggal dan watermark PromptVault saat cetak</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.preferences.printHeader}
                  onChange={(e) => updateNestedSetting('preferences', 'printHeader', e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 5: KEAMANAN & KUNCI AKSES */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in" id="settings-security-tab-content">
              
              {/* SECTION 1: ACCESS KEY GATE (KUNCI AKSES UTAMA VAULT) */}
              <div className="p-5 bg-gradient-to-b from-indigo-950/40 to-slate-950/80 border border-indigo-500/30 rounded-2xl space-y-4 shadow-lg shadow-indigo-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <span>Access Key Gate (Kunci Akses Vault)</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Perlindungan akses aplikasi saat dibuka/dimuat ulang dengan enkripsi hashing PBKDF2 SHA-256 (bukan plaintext).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        isVaultKeyActive
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isVaultKeyActive ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Aktif (Hashing Kriptografi PBKDF2 SHA-256)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Tidak Aktif</span>
                        </>
                      )}
                    </span>

                    {!isEditingAccessKey && (
                      <>
                        {isVaultKeyActive ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartAccessKeyEdit('change')}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                              id="btn-change-access-key"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Ganti Kunci Akses</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartAccessKeyEdit('remove')}
                              className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                              title="Nonaktifkan Kunci Akses"
                              id="btn-remove-access-key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartAccessKeyEdit('set')}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                            id="btn-set-access-key"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Atur Kunci Akses Baru</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Petunjuk / Hint jika ada */}
                {isVaultKeyActive && settings.security?.accessKeyHint && !isEditingAccessKey && (
                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-indigo-300">Petunjuk Kunci (Hint): </span>
                      <span className="text-slate-300">{settings.security.accessKeyHint}</span>
                    </div>
                  </div>
                )}

                {/* Inline Form to Set / Change / Remove Vault Access Key */}
                {isEditingAccessKey && (
                  <form
                    onSubmit={handleSaveAccessKeySubmit}
                    className="p-4 bg-slate-950/95 border border-indigo-500/40 rounded-2xl space-y-3.5 animate-fade-in"
                    id="form-edit-vault-access-key"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        {accessKeyMode === 'set' && 'Konfigurasi Kunci Akses Baru'}
                        {accessKeyMode === 'change' && 'Ganti Kunci Akses Vault'}
                        {accessKeyMode === 'remove' && 'Nonaktifkan Kunci Akses Vault'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAccessKeyFields(!showAccessKeyFields)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                        >
                          {showAccessKeyFields ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Sembunyikan</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-slate-300" />
                              <span>Tampilkan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelAccessKeyEdit}
                          className="text-slate-400 hover:text-white text-xs px-1.5 py-1"
                        >
                          Batal
                        </button>
                      </div>
                    </div>

                    {/* Current Access Key field for change or remove */}
                    {(accessKeyMode === 'change' || accessKeyMode === 'remove') && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          Kunci Akses Saat Ini:
                        </label>
                        <input
                          type={showAccessKeyFields ? 'text' : 'password'}
                          value={currentAccessKeyInput}
                          onChange={(e) => setCurrentAccessKeyInput(e.target.value)}
                          placeholder="Masukkan Kunci Akses lama..."
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-mono"
                          autoComplete="off"
                        />
                      </div>
                    )}

                    {/* New Access Key fields for set or change */}
                    {(accessKeyMode === 'set' || accessKeyMode === 'change') && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-300 block">
                              {accessKeyMode === 'change' ? 'Kunci Akses Baru:' : 'Kunci Akses (min 4 karakter):'}
                            </label>
                            <input
                              type={showAccessKeyFields ? 'text' : 'password'}
                              value={newAccessKeyInput}
                              onChange={(e) => setNewAccessKeyInput(e.target.value)}
                              placeholder="Kunci baru..."
                              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-mono"
                              autoComplete="off"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-300 block">
                              Konfirmasi Kunci Akses Baru:
                            </label>
                            <input
                              type={showAccessKeyFields ? 'text' : 'password'}
                              value={confirmAccessKeyInput}
                              onChange={(e) => setConfirmAccessKeyInput(e.target.value)}
                              placeholder="Ulangi kunci baru..."
                              className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-mono"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>Petunjuk Kunci / Hint (Opsional):</span>
                            <span className="text-[10px] text-slate-500">Membantu mengingat jika lupa</span>
                          </label>
                          <input
                            type="text"
                            value={accessKeyHintInput}
                            onChange={(e) => setAccessKeyHintInput(e.target.value)}
                            placeholder="Contoh: Nama proyek rahasia / kombinasi favorit..."
                            className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
                          />
                        </div>
                      </>
                    )}

                    {accessKeyMode === 'remove' && (
                      <p className="text-[11px] text-amber-300/90 leading-relaxed bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/30">
                        Peringatan: Setelah dinonaktifkan, aplikasi dapat dibuka langsung tanpa meminta kunci akses pada saat dibuka atau dimuat ulang.
                      </p>
                    )}

                    {accessKeyError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>{accessKeyError}</span>
                      </div>
                    )}

                    {accessKeySuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>{accessKeySuccess}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={handleCancelAccessKeyEdit}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingAccessKey}
                        className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                          accessKeyMode === 'remove'
                            ? 'bg-rose-600 hover:bg-rose-500'
                            : 'bg-indigo-600 hover:bg-indigo-500'
                        }`}
                      >
                        {isSavingAccessKey ? (
                          <span>Menyimpan ke Database...</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {accessKeyMode === 'set' && 'Simpan & Aktifkan Kunci Akses'}
                              {accessKeyMode === 'change' && 'Perbarui Kunci Akses'}
                              {accessKeyMode === 'remove' && 'Konfirmasi Nonaktifkan'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECTION 2: MASTER RECOVERY PIN */}
              <div className="p-5 bg-gradient-to-b from-amber-950/30 to-slate-950/80 border border-amber-500/30 rounded-2xl space-y-4 shadow-lg shadow-amber-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <span>Master Recovery PIN (PIN Pemulihan Darurat)</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        PIN darurat untuk memulihkan dan mereset Access Key atau membuka folder jika Anda lupa kunci.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        isMasterPinActive
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isMasterPinActive ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Aktif (Tersimpan di Cloud)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Belum Diatur</span>
                        </>
                      )}
                    </span>

                    {!isEditingMasterPin && (
                      <>
                        {isMasterPinActive ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartMasterPinEdit('change')}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                              id="btn-change-master-pin"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Ganti Recovery PIN</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartMasterPinEdit('remove')}
                              className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                              title="Hapus Master PIN"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartMasterPinEdit('set')}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                            id="btn-set-master-pin"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Atur Master PIN Baru</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Form to Set / Change / Remove Master PIN */}
                {isEditingMasterPin && (
                  <form
                    onSubmit={handleSaveMasterPinSubmit}
                    className="p-4 bg-slate-950/95 border border-amber-500/40 rounded-2xl space-y-3.5 animate-fade-in"
                    id="form-edit-master-recovery-pin"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        {masterPinMode === 'set' && 'Konfigurasi Master Recovery PIN Baru'}
                        {masterPinMode === 'change' && 'Ganti Master Recovery PIN'}
                        {masterPinMode === 'remove' && 'Hapus Master Recovery PIN'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowMasterPinFields(!showMasterPinFields)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                        >
                          {showMasterPinFields ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                              <span>Sembunyikan</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-slate-300" />
                              <span>Tampilkan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleCancelMasterPinEdit}
                          className="text-slate-400 hover:text-white text-xs px-1.5 py-1"
                        >
                          Batal
                        </button>
                      </div>
                    </div>

                    {/* Current Master PIN field for change or remove */}
                    {(masterPinMode === 'change' || masterPinMode === 'remove') && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          Master Recovery PIN Saat Ini:
                        </label>
                        <input
                          type={showMasterPinFields ? 'text' : 'password'}
                          value={currentMasterPinInput}
                          onChange={(e) => setCurrentMasterPinInput(e.target.value)}
                          placeholder="Masukkan Master PIN lama..."
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 font-mono"
                          autoComplete="off"
                        />
                      </div>
                    )}

                    {/* New Master PIN fields for set or change */}
                    {(masterPinMode === 'set' || masterPinMode === 'change') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 block">
                            {masterPinMode === 'change' ? 'Master PIN Baru:' : 'Master PIN (min 4 karakter):'}
                          </label>
                          <input
                            type={showMasterPinFields ? 'text' : 'password'}
                            value={newMasterPinInput}
                            onChange={(e) => setNewMasterPinInput(e.target.value)}
                            placeholder="PIN baru..."
                            className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 font-mono"
                            autoComplete="off"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 block">
                            Konfirmasi Master PIN Baru:
                          </label>
                          <input
                            type={showMasterPinFields ? 'text' : 'password'}
                            value={confirmMasterPinInput}
                            onChange={(e) => setConfirmMasterPinInput(e.target.value)}
                            placeholder="Ulangi PIN baru..."
                            className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 font-mono"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    )}

                    {masterPinMode === 'remove' && (
                      <p className="text-[11px] text-amber-300/90 leading-relaxed bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/30">
                        Peringatan: Setelah dihapus, pemulihan darurat tidak tersedia jika Anda lupa Kunci Akses utama.
                      </p>
                    )}

                    {masterPinError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>{masterPinError}</span>
                      </div>
                    )}

                    {masterPinSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>{masterPinSuccess}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={handleCancelMasterPinEdit}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingMasterPin}
                        className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                          masterPinMode === 'remove'
                            ? 'bg-rose-600 hover:bg-rose-500'
                            : 'bg-amber-600 hover:bg-amber-500'
                        }`}
                      >
                        {isSavingMasterPin ? (
                          <span>Menyimpan ke Cloud...</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {masterPinMode === 'set' && 'Simpan Master Recovery PIN'}
                              {masterPinMode === 'change' && 'Perbarui Master PIN'}
                              {masterPinMode === 'remove' && 'Konfirmasi Hapus'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECTION 3: KUNCI CEPAT & MANAJEMEN SESI */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">Kunci Cepat & Manajemen Sesi</h4>
                    <p className="text-xs text-slate-400">
                      Kunci aplikasi secara instan atau konfigurasi durasi auto-lock saat tidak aktif.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kunci Vault Sekarang */}
                  <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Kunci Layar PromptVault Sekarang</span>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Langsung mengakhiri sesi aktif dan menampilkan Access Key Gate.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onLockAppVaultNow) {
                          onLockAppVaultNow();
                        } else {
                          setSessionVaultUnlocked(false);
                          window.location.reload();
                        }
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                      id="btn-quick-lock-vault-settings"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Kunci Layar Sekarang (Lock Vault)</span>
                    </button>
                  </div>

                  {/* Kunci Semua Folder */}
                  <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Kunci Semua Folder Terproteksi</span>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {lockedFoldersCount} folder terproteksi ({unlockedFoldersCount} terbuka di sesi ini).
                      </p>
                    </div>
                    {onLockAllFolders && (
                      <button
                        type="button"
                        onClick={() => {
                          onLockAllFolders();
                          setLockAllNotice(true);
                          setTimeout(() => setLockAllNotice(false), 2500);
                        }}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                        id="btn-quick-lock-folders-settings"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Kunci Semua Folder Sesi Ini</span>
                      </button>
                    )}
                  </div>
                </div>

                {lockAllNotice && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Semua folder terproteksi telah berhasil dikunci kembali pada sesi ini!</span>
                  </div>
                )}

                {/* Auto Lock Duration Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Durasi Kunci Otomatis (Auto-Lock Session):
                  </label>
                  <select
                    value={settings.preferences.autoLockDuration || '5min'}
                    onChange={(e) =>
                      updateNestedSetting('preferences', 'autoLockDuration', e.target.value)
                    }
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none focus:border-indigo-500"
                  >
                    <option value="refresh">Saat Halaman Direfresh / Dimuat Ulang</option>
                    <option value="1min">Setelah 1 Menit Tidak Aktif</option>
                    <option value="5min">Setelah 5 Menit Tidak Aktif (Direkomendasikan)</option>
                    <option value="15min">Setelah 15 Menit Tidak Aktif</option>
                    <option value="30min">Setelah 30 Menit Tidak Aktif</option>
                    <option value="unload">Saat Tab / Browser Ditutup</option>
                  </select>
                </div>
              </div>

              {/* SECTION 4: CRYPTOGRAPHIC SPECS */}
              <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-xs space-y-2 text-slate-400">
                <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Arsitektur Kriptografi SHA-256 (Zero Plaintext Policy)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Semua kunci akses dan recovery PIN diproses menggunakan algoritma <strong>PBKDF2 SHA-256</strong> dengan 100.000 iterasi dan 16-byte kriptografi acak (Salt). Password plaintext tidak pernah disimpan di Cloud Firestore maupun local storage.
                </p>
              </div>

            </div>
          )}

          {/* TAB 6: PREFERENSI & DATABASE */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              
              {/* Firebase Status */}
              <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Status Koneksi Firebase Firestore</h4>
                      <p className="text-[11px] text-slate-400">Dokumen Path: app/settings/current/main</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      isFirebaseConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}
                  >
                    {isFirebaseConnected ? 'Terhubung Realtime' : 'Terputus'}
                  </span>
                </div>

                {!isFirebaseConnected && (
                  <button
                    onClick={onRetryFirebase}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Hubungkan Ulang ke Firebase</span>
                  </button>
                )}
              </div>

              {/* Default AI platform dropdown */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Target AI Platform Default
                </label>
                <select
                  value={settings.preferences.defaultTargetAI}
                  onChange={(e) => updateNestedSetting('preferences', 'defaultTargetAI', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                >
                  <option value="ChatGPT">ChatGPT</option>
                  <option value="Claude">Claude</option>
                  <option value="Midjourney">Midjourney</option>
                  <option value="DALL-E 3">DALL-E 3</option>
                  <option value="Gemini">Gemini</option>
                  <option value="Stable Diffusion">Stable Diffusion</option>
                </select>
              </div>

              {/* Default Category Text Input */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Kategori Default Prompt Baru
                </label>
                <input
                  type="text"
                  value={settings.preferences.defaultCategory}
                  onChange={(e) => updateNestedSetting('preferences', 'defaultCategory', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none"
                  placeholder="Misal: Umum, Coding, UI Design..."
                />
              </div>

              {/* Confirm Delete Toggle */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Tampilkan Konfirmasi Hapus</span>
                  <span className="text-[11px] text-slate-400">Minta konfirmasi dialog sebelum menghapus prompt atau folder</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.preferences.confirmBeforeDelete}
                  onChange={(e) => updateNestedSetting('preferences', 'confirmBeforeDelete', e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Auto copy on select */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Salin Otomatis Teks Prompt saat Diklik</span>
                  <span className="text-[11px] text-slate-400">Otomatis menyalin isi prompt ke clipboard saat kartu dibuka</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.preferences.autoCopyOnSelect}
                  onChange={(e) => updateNestedSetting('preferences', 'autoCopyOnSelect', e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 7: PWA & ANDROID INSTALLATION */}
          {activeTab === 'pwa' && (
            <div className="space-y-6">
              {/* App Status Banner */}
              <div className="p-5 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/50 border border-indigo-500/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src="/icons/icon-192.png"
                      alt="PromptVault App Icon"
                      className="w-12 h-12 rounded-2xl object-contain shadow-lg shadow-indigo-600/30 shrink-0"
                    />
                    <div>
                      <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        PromptVault Native PWA
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                          isStandalone
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : isInIframe
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        }`}>
                          {isStandalone ? 'Installed • Standalone' : isInIframe ? 'Preview iFrame Mode' : 'Browser Mode'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Platform: <span className="text-indigo-300 font-semibold capitalize">{platform}</span> • Service Worker: {diagnostics.swState === 'active' ? 'Aktif v2.1' : diagnostics.swState}
                      </p>
                    </div>
                  </div>

                  {!isStandalone && (
                    <button
                      onClick={async () => {
                        setPwaInstallMessage(null);
                        const res = await installPWA();
                        if (res.outcome === 'accepted') {
                          setPwaInstallMessage('PromptVault berhasil diinstal ke perangkat Anda!');
                        } else if (res.outcome === 'dismissed') {
                          setPwaInstallMessage('Pemasangan dibatalkan oleh pengguna.');
                        } else if (res.outcome === 'iframe_blocked') {
                          setPwaInstallMessage('Browser membatasi install prompt di dalam frame preview. Buka di tab mandiri browser untuk memasang.');
                        } else if (res.outcome === 'unsupported') {
                          setPwaInstallMessage('Browser belum menyediakan prompt otomatis. Gunakan menu browser (⋮) > Tambahkan ke Layar Utama.');
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
                      id="settings-install-pwa-btn"
                    >
                      <Download className="w-4 h-4" />
                      <span>Instal Sekarang</span>
                    </button>
                  )}
                </div>

                {/* iFrame Notice if inside preview */}
                {isInIframe && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-3">
                    <span className="text-[11px] leading-relaxed">
                      Sedang dijalankan di dalam preview iframe AI Studio. Browser Chromium hanya mendukung pemanggilan install prompt di level top-window (tab mandiri).
                    </span>
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold shrink-0"
                    >
                      Buka Tab Baru ↗
                    </button>
                  </div>
                )}

                {/* Feedback message */}
                {pwaInstallMessage && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-center gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-[11px]">{pwaInstallMessage}</span>
                  </div>
                )}

                {/* Verified Real Diagnostics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[11px] block">Status Cache Offline</span>
                    <span className={`font-semibold flex items-center gap-1.5 ${
                      diagnostics.cacheStatus === 'cached' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      <Check className="w-3.5 h-3.5" />
                      {diagnostics.cacheStatus === 'cached'
                        ? `Tersimpan (${diagnostics.cachedAssetsCount} aset)`
                        : 'Memeriksa Cache...'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[11px] block">Manifest Web App</span>
                    <span className={`font-semibold flex items-center gap-1.5 ${
                      diagnostics.manifestStatus === 'valid' ? 'text-emerald-400' : 'text-indigo-400'
                    }`}>
                      <Zap className="w-3.5 h-3.5" />
                      {diagnostics.manifestStatus === 'valid' ? 'Valid & Terverifikasi' : diagnostics.manifestStatus}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[11px] block">Keamanan Kunci</span>
                    <span className="text-purple-400 font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      PBKDF2 SHA-256 (Salted)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <span>HTTPS Secure: {diagnostics.isSecureContext ? 'Ya' : 'Tidak'} • Prompt Browser: {diagnostics.isPromptAvailable ? 'Siap' : 'Menunggu Interaksi'}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsTestingPWADiag(true);
                      await refreshDiagnostics();
                      setIsTestingPWADiag(false);
                    }}
                    disabled={isTestingPWADiag}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingPWADiag ? 'animate-spin' : ''}`} />
                    <span>Uji Ulang Diagnostik</span>
                  </button>
                </div>
              </div>

              {/* Native Android APK Direct Download */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-100">Android Release APK (Standalone)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      v2.0 • 6.8 MB
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Unduh file APK resmi PromptVault untuk dipasang langsung di perangkat Android.
                  </p>
                </div>
                <a
                  href="./PromptVault-v2.0-release.apk"
                  download="PromptVault-v2.0-release.apk"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh APK Release</span>
                </a>
              </div>

              {/* Install Guide / Instructions */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Panduan Pemasangan di Berbagai Perangkat
                </h5>
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
                    <strong className="text-indigo-300 font-semibold block">📱 Android (Chrome / Edge / Samsung Internet):</strong>
                    <p className="text-slate-400 text-[11px]">
                      Klik tombol <strong>"Instal Sekarang"</strong> di atas atau pilih menu titik tiga (⋮) pada browser &gt; <em>"Tambahkan ke Layar Utama" / "Instal Aplikasi"</em>.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
                    <strong className="text-pink-300 font-semibold block">🍏 iOS iPhone / iPad (Safari):</strong>
                    <p className="text-slate-400 text-[11px]">
                      Buka di Safari, ketuk tombol <strong>Bagikan (Share)</strong> <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-indigo-400" /> di bagian bawah, lalu pilih <strong>"Tambah ke Layar Utama"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-indigo-400" />.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl space-y-1">
                    <strong className="text-purple-300 font-semibold block">💻 Komputer Desktop / Laptop (Chrome / Edge):</strong>
                    <p className="text-slate-400 text-[11px]">
                      Klik ikon install pada address bar browser di kanan atas atau klik tombol <em>"Instal Sekarang"</em>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Path Dokumen: <code className="text-indigo-400 font-mono">app/settings/current/main</code>
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
