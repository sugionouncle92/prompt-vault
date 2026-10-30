import React, { useState, useEffect } from 'react';
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
  Trash2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  Zap,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  Mail,
  KeyRound,
  Loader2,
  Info,
  Clock,
  Folder,
} from 'lucide-react';
import { AppSettings, saveSettingsToFirebase, AppSecuritySettings, RecoveryEmailConfig } from '../services/firebaseService';
import { FolderItem, FOLDER_COLORS } from '../types';
import appLogo from '../assets/logo-192.png';
import { usePWA } from '../hooks/usePWA';
import {
  hashMasterFolderPassword,
  verifyMasterFolderPassword,
  isMasterFolderPasswordConfigured,
  hashMasterRecoveryPin,
  verifyMasterRecoveryPin,
  isMasterRecoveryPinConfigured,
  getEffectiveMasterFolderCredentials,
} from '../utils/security';
import {
  requestEmailOtp,
  verifyEmailOtp,
  maskEmail,
} from '../utils/emailOtp';

interface SettingsModalProps {
  settings: AppSettings;
  folders?: FolderItem[];
  unlockedFolderIds?: Set<string>;
  onLockAllFolders?: () => void;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  isFirebaseConnected: boolean;
  onRetryFirebase: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  folders = [],
  unlockedFolderIds = new Set(),
  onLockAllFolders,
  onUpdateSettings,
  onClose,
  isFirebaseConnected,
  onRetryFirebase,
}) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'gallery' | 'ai' | 'upload' | 'security' | 'preferences' | 'pwa'>('theme');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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

  // --- Master Folder Password State ---
  const isMasterPasswordSet = isMasterFolderPasswordConfigured(settings.security);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPasswordInput, setOldPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // --- Master Recovery PIN State ---
  const isPinSet = isMasterRecoveryPinConfigured(settings.security);
  const [showPinForm, setShowPinForm] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // --- Recovery Email State ---
  const recoveryEmailConfig = settings.security?.recoveryEmail;
  const emailStatus: 'unregistered' | 'pending' | 'verified' =
    recoveryEmailConfig?.status || (recoveryEmailConfig?.email ? 'verified' : 'unregistered');
  const [emailInput, setEmailInput] = useState(recoveryEmailConfig?.email || '');
  const [showChangeEmailForm, setShowChangeEmailForm] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState<string | null>(null);
  const [emailOtpSuccess, setEmailOtpSuccess] = useState<string | null>(null);
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState<string | null>(null);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Helper to update security settings
  const updateSecuritySetting = (patch: Partial<AppSecuritySettings>) => {
    const updatedSecurity: AppSecuritySettings = {
      ...(settings.security || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const updatedSettings: AppSettings = {
      ...settings,
      security: updatedSecurity,
    };
    onUpdateSettings(updatedSettings);
    triggerAutoSave(updatedSettings);
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
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[90vh]">
        
        {/* 1. Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
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

        {/* 2. Navigation Tabs */}
        <div className="shrink-0 w-full bg-slate-950/80 border-b border-slate-800 relative z-20">
          <nav
            className="flex items-center px-4 sm:px-6 gap-2 overflow-x-auto overflow-y-hidden min-h-[52px]"
            aria-label="Settings Navigation"
          >
            <button
              type="button"
              onClick={() => setActiveTab('theme')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'theme'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Sun className="w-4 h-4 shrink-0" />
              <span>Tema & Tampilan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'gallery'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Layout className="w-4 h-4 shrink-0" />
              <span>Galeri & Layout</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'ai'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>Pengaturan AI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'upload'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span>Upload, Crop & Ekspor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'security'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              id="settings-security-tab-btn"
            >
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Keamanan Folder</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preferences')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'preferences'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0" />
              <span>Preferensi & Database</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pwa')}
              className={`shrink-0 relative flex items-center gap-2 py-3 px-4 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap -mb-px border-b-2 ${
                activeTab === 'pwa'
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              id="settings-pwa-tab-btn"
            >
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>PWA & Android App</span>
            </button>
          </nav>
        </div>

        {/* 3. Container Konten Pengaturan */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 text-slate-200 text-sm relative z-10">
          
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

          {/* TAB: KEAMANAN FOLDER & SISTEM PEMULIHAN */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in" id="settings-security-content">
              {/* Info Header Banner */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-slate-900 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Folder Lock Protection &amp; Recovery System
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                      v2.1
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Aplikasi PromptVault bebas dibuka tanpa kunci global. Anda dapat melindungi folder tertentu secara individual menggunakan <strong>Satu Master Folder Password</strong> dengan 2 metode pemulihan darurat independen (Recovery PIN &amp; Email OTP).
                  </p>
                </div>
              </div>

              {/* ======================================================== */}
              {/* SUBSECTION A: MASTER FOLDER PASSWORD */}
              {/* ======================================================== */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        A. Master Folder Password
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Kredensial tunggal untuk seluruh folder terproteksi
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${
                        isMasterPasswordSet
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {isMasterPasswordSet ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Aktif &amp; Terkonfigurasi</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Belum Dibuat</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Satu Master Folder Password ini berlaku untuk seluruh folder yang Anda pilih untuk dikunci. Password dienkripsi menggunakan hashing PBKDF2 SHA-256 dengan salt unik.
                </p>

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Form or Trigger Button */}
                {!showPasswordForm ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(true);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                        setOldPasswordInput('');
                        setNewPasswordInput('');
                        setConfirmPasswordInput('');
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                        isMasterPasswordSet
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{isMasterPasswordSet ? 'Ganti Master Folder Password' : 'Buat Master Folder Password'}</span>
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPasswordError(null);
                      setPasswordSuccess(null);

                      if (isMasterPasswordSet) {
                        const creds = getEffectiveMasterFolderCredentials(settings.security);
                        if (!oldPasswordInput.trim()) {
                          setPasswordError('Masukkan password saat ini untuk verifikasi.');
                          return;
                        }
                        const isOldValid = await verifyMasterFolderPassword(
                          oldPasswordInput.trim(),
                          creds.hash,
                          creds.salt
                        );
                        if (!isOldValid) {
                          setPasswordError('Password lama salah. Akses perubahan ditolak.');
                          return;
                        }
                      }

                      const np = newPasswordInput.trim();
                      const cp = confirmPasswordInput.trim();

                      if (!np) {
                        setPasswordError('Password baru tidak boleh kosong.');
                        return;
                      }
                      if (np.length < 4) {
                        setPasswordError('Password baru minimal 4 karakter.');
                        return;
                      }
                      if (np !== cp) {
                        setPasswordError('Konfirmasi password tidak cocok.');
                        return;
                      }

                      setIsSavingPassword(true);
                      try {
                        const { masterPasswordHash, masterPasswordSalt } =
                          await hashMasterFolderPassword(np);
                        updateSecuritySetting({
                          isMasterFolderPasswordSet: true,
                          masterFolderPasswordHash: masterPasswordHash,
                          masterFolderPasswordSalt: masterPasswordSalt,
                          vaultAccessKeyHash: masterPasswordHash,
                          vaultAccessKeySalt: masterPasswordSalt,
                        });
                        setPasswordSuccess('Master Folder Password berhasil diperbarui!');
                        setShowPasswordForm(false);
                      } catch (err: any) {
                        setPasswordError(err.message || 'Gagal menyimpan Master Folder Password.');
                      } finally {
                        setIsSavingPassword(false);
                      }
                    }}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3.5"
                  >
                    <div className="font-semibold text-xs text-slate-200">
                      {isMasterPasswordSet ? 'Ganti Master Folder Password' : 'Buat Master Folder Password Baru'}
                    </div>

                    {isMasterPasswordSet && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          Password Lama
                        </label>
                        <div className="relative">
                          <input
                            type={showOldPassword ? 'text' : 'password'}
                            value={oldPasswordInput}
                            onChange={(e) => setOldPasswordInput(e.target.value)}
                            placeholder="Masukkan password saat ini..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 pr-9 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPassword(!showOldPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showOldPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          Password Baru (Min. 4 Karakter)
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPasswordInput}
                            onChange={(e) => setNewPasswordInput(e.target.value)}
                            placeholder="Password baru..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 pr-9 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          Konfirmasi Password Baru
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            placeholder="Konfirmasi password baru..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 pr-9 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPassword}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        {isSavingPassword && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Simpan Password</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* ======================================================== */}
              {/* SUBSECTION B: MASTER RECOVERY PIN */}
              {/* ======================================================== */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        B. Master Recovery PIN
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Metode pemulihan pertama jika lupa password folder
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${
                        isPinSet
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {isPinSet ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Terkonfigurasi (PIN 6 Digit)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Belum Diatur</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  PIN darurat 6 digit numerik untuk memulihkan akses dan membuat Master Folder Password baru. PIN tidak dihapus setelah digunakan.
                </p>

                {pinSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{pinSuccess}</span>
                  </div>
                )}

                {pinError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                {!showPinForm ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinForm(true);
                        setPinError(null);
                        setPinSuccess(null);
                        setOldPinInput('');
                        setNewPinInput('');
                        setConfirmPinInput('');
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                        isPinSet
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{isPinSet ? 'Ganti Recovery PIN' : 'Atur Recovery PIN (6 Digit)'}</span>
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPinError(null);
                      setPinSuccess(null);

                      if (isPinSet) {
                        if (!oldPinInput.trim()) {
                          setPinError('Masukkan PIN saat ini untuk verifikasi.');
                          return;
                        }
                        const isOldValid = await verifyMasterRecoveryPin(
                          oldPinInput.trim(),
                          settings.security?.masterPinHash,
                          settings.security?.masterPinSalt
                        );
                        if (!isOldValid) {
                          setPinError('PIN lama salah. Akses perubahan ditolak.');
                          return;
                        }
                      }

                      const np = newPinInput.trim();
                      const cp = confirmPinInput.trim();

                      if (!np || !/^\d{6}$/.test(np)) {
                        setPinError('PIN harus tepat 6 digit angka numerik.');
                        return;
                      }
                      if (np !== cp) {
                        setPinError('Konfirmasi PIN tidak cocok.');
                        return;
                      }

                      setIsSavingPin(true);
                      try {
                        const { masterPinHash, masterPinSalt } = await hashMasterRecoveryPin(np);
                        updateSecuritySetting({
                          isMasterPinSet: true,
                          masterPinHash,
                          masterPinSalt,
                        });
                        setPinSuccess('Master Recovery PIN berhasil disimpan!');
                        setShowPinForm(false);
                      } catch (err: any) {
                        setPinError(err.message || 'Gagal menyimpan Recovery PIN.');
                      } finally {
                        setIsSavingPin(false);
                      }
                    }}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3.5"
                  >
                    <div className="font-semibold text-xs text-slate-200">
                      {isPinSet ? 'Ganti Master Recovery PIN' : 'Atur Master Recovery PIN Baru'}
                    </div>

                    {isPinSet && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          PIN Saat Ini (6 Digit)
                        </label>
                        <div className="relative">
                          <input
                            type={showOldPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={6}
                            value={oldPinInput}
                            onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="6 digit PIN lama..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 pr-9 font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPin(!showOldPin)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showOldPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          PIN Baru (6 Digit Angka)
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={6}
                            value={newPinInput}
                            onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="6 digit angka..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 pr-9 font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPin(!showNewPin)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          Konfirmasi PIN Baru
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={6}
                            value={confirmPinInput}
                            onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ulangi 6 digit..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 pr-9 font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPin(!showConfirmPin)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showConfirmPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPinForm(false)}
                        className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPin}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        {isSavingPin && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Simpan Recovery PIN</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* ======================================================== */}
              {/* SUBSECTION C: EMAIL PEMULIHAN */}
              {/* ======================================================== */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        C. Email Pemulihan (Email OTP)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Metode pemulihan alternatif via kode OTP 6 digit
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${
                        emailStatus === 'verified'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : emailStatus === 'pending'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {emailStatus === 'verified' && (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>TERVERIFIKASI</span>
                        </>
                      )}
                      {emailStatus === 'pending' && (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>MENUNGGU VERIFIKASI</span>
                        </>
                      )}
                      {emailStatus === 'unregistered' && <span>BELUM TERDAFTAR</span>}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Email pemulihan digunakan untuk mengirim kode OTP 6 digit saat Anda lupa Master Folder Password. Kode OTP berlaku 5 menit dengan batas percobaan maksimal 5 kali.
                </p>

                {simulatedOtpNotice && (
                  <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 font-mono">
                    {simulatedOtpNotice}
                  </div>
                )}

                {emailOtpSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{emailOtpSuccess}</span>
                  </div>
                )}

                {emailOtpError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{emailOtpError}</span>
                  </div>
                )}

                {/* State 1: Verified Email Display */}
                {emailStatus === 'verified' && !showChangeEmailForm && (
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-slate-400 font-medium">Alamat Email Terdaftar:</div>
                      <div className="text-sm font-bold text-slate-100 font-mono">
                        {maskEmail(recoveryEmailConfig?.email || '')}
                      </div>
                      {recoveryEmailConfig?.verifiedAt && (
                        <div className="text-[10px] text-emerald-400">
                          Diverifikasi pada: {new Date(recoveryEmailConfig.verifiedAt).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowChangeEmailForm(true);
                        setEmailOtpError(null);
                        setEmailOtpSuccess(null);
                        setEmailInput('');
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                    >
                      Ganti Alamat Email
                    </button>
                  </div>
                )}

                {/* State 2: Pending OTP Verification */}
                {emailStatus === 'pending' && (
                  <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-xl space-y-3.5">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-amber-300">
                        Kode verifikasi telah dikirim ke: <span className="font-mono">{emailInput}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Masukkan 6 digit kode OTP yang kami kirimkan untuk memverifikasi kepemilikan email.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="6 Digit OTP..."
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 font-mono tracking-widest max-w-xs"
                      />

                      <button
                        type="button"
                        onClick={async () => {
                          if (!otpInput.trim() || isVerifyingEmailOtp) return;
                          setIsVerifyingEmailOtp(true);
                          setEmailOtpError(null);
                          setEmailOtpSuccess(null);
                          try {
                            const res = await verifyEmailOtp(emailInput, otpInput.trim(), 'verify_email');
                            if (res.success) {
                              const updatedEmailConfig: RecoveryEmailConfig = {
                                email: emailInput.trim().toLowerCase(),
                                status: 'verified',
                                verifiedAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                              };
                              updateSecuritySetting({ recoveryEmail: updatedEmailConfig });
                              setEmailOtpSuccess('Email pemulihan berhasil diverifikasi!');
                              setShowChangeEmailForm(false);
                              setOtpInput('');
                            } else {
                              setEmailOtpError(res.error || 'Kode OTP tidak valid.');
                            }
                          } catch (err: any) {
                            setEmailOtpError(err.message || 'Gagal memverifikasi OTP.');
                          } finally {
                            setIsVerifyingEmailOtp(false);
                          }
                        }}
                        disabled={isVerifyingEmailOtp || otpInput.trim().length !== 6}
                        className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        {isVerifyingEmailOtp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Verifikasi Email</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={async () => {
                          if (otpCooldown > 0 || isSendingEmailOtp) return;
                          setIsSendingEmailOtp(true);
                          setEmailOtpError(null);
                          try {
                            const res = await requestEmailOtp(emailInput, 'verify_email');
                            if (res.success) {
                              setOtpCooldown(res.resendAfterSeconds || 60);
                              setEmailOtpSuccess('Kode baru telah dikirimkan.');
                              if (res.simulatedOtp) {
                                setSimulatedOtpNotice(`[Mode Simulasi: Kode OTP Anda adalah ${res.simulatedOtp}]`);
                              }
                            } else {
                              setEmailOtpError(res.error || 'Gagal mengirim ulang OTP.');
                            }
                          } catch (err: any) {
                            setEmailOtpError(err.message || 'Gagal mengirim ulang OTP.');
                          } finally {
                            setIsSendingEmailOtp(false);
                          }
                        }}
                        disabled={otpCooldown > 0 || isSendingEmailOtp}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold disabled:opacity-50"
                      >
                        {otpCooldown > 0 ? `Kirim Ulang Kode (${otpCooldown}s)` : 'Kirim Ulang Kode OTP'}
                      </button>

                      <span className="text-slate-600">•</span>

                      <button
                        type="button"
                        onClick={() => {
                          updateSecuritySetting({
                            recoveryEmail: {
                              email: recoveryEmailConfig?.email || '',
                              status: recoveryEmailConfig?.status === 'verified' ? 'verified' : 'unregistered',
                            },
                          });
                          setShowChangeEmailForm(false);
                          setEmailOtpError(null);
                        }}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* State 3: Register or Change Email Form */}
                {(emailStatus === 'unregistered' || showChangeEmailForm) && emailStatus !== 'pending' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const cleanEmail = emailInput.trim().toLowerCase();
                      if (!cleanEmail || !cleanEmail.includes('@')) {
                        setEmailOtpError('Masukkan alamat email yang valid.');
                        return;
                      }

                      setIsSendingEmailOtp(true);
                      setEmailOtpError(null);
                      setEmailOtpSuccess(null);
                      setSimulatedOtpNotice(null);

                      try {
                        const res = await requestEmailOtp(cleanEmail, 'verify_email');
                        if (res.success) {
                          const updatedEmailConfig: RecoveryEmailConfig = {
                            email: cleanEmail,
                            status: 'pending',
                            updatedAt: new Date().toISOString(),
                          };
                          updateSecuritySetting({ recoveryEmail: updatedEmailConfig });
                          setOtpCooldown(res.resendAfterSeconds || 60);
                          setEmailOtpSuccess(`Kode verifikasi OTP dikirim ke ${cleanEmail}`);
                          if (res.simulatedOtp) {
                            setSimulatedOtpNotice(`[Mode Simulasi: Kode OTP Anda adalah ${res.simulatedOtp}]`);
                          }
                        } else {
                          setEmailOtpError(res.error || 'Gagal mengirim kode verifikasi.');
                        }
                      } catch (err: any) {
                        setEmailOtpError(err.message || 'Gagal mengirim kode verifikasi.');
                      } finally {
                        setIsSendingEmailOtp(false);
                      }
                    }}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3"
                  >
                    <label className="text-xs font-semibold text-slate-200 block">
                      {emailStatus === 'verified' ? 'Ganti Alamat Email Pemulihan' : 'Daftarkan Email Pemulihan'}
                    </label>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="contoh: namaanda@gmail.com"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                      />

                      <button
                        type="submit"
                        disabled={isSendingEmailOtp || !emailInput.trim()}
                        className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0"
                      >
                        {isSendingEmailOtp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <Mail className="w-3.5 h-3.5" />
                        <span>Kirim Kode Verifikasi</span>
                      </button>

                      {showChangeEmailForm && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowChangeEmailForm(false);
                            setEmailOtpError(null);
                          }}
                          className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Batal
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* ======================================================== */}
              {/* SUBSECTION D: FOLDER TERPROTEKSI */}
              {/* ======================================================== */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                        D. Daftar Folder Terproteksi
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Status proteksi kunci pada setiap folder aplikasi
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                      {folders.filter((f) => f.isLocked).length} dari {folders.length} Folder Dilindungi
                    </span>

                    {folders.some((f) => f.isLocked && unlockedFolderIds.has(f.id)) && onLockAllFolders && (
                      <button
                        type="button"
                        onClick={onLockAllFolders}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Kunci Semua Folder Sesi</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {folders.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">Belum ada folder yang dibuat.</div>
                  ) : (
                    folders.map((f) => {
                      const isProtected = Boolean(f.isLocked);
                      const isUnlocked = unlockedFolderIds.has(f.id);
                      const color = FOLDER_COLORS.find((c) => c.value === f.color) || FOLDER_COLORS[0];

                      return (
                        <div
                          key={f.id}
                          className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg ${color.bg} ${color.text} flex items-center justify-center shrink-0`}>
                              {isProtected ? (
                                isUnlocked ? <Unlock className="w-3.5 h-3.5 text-emerald-300" /> : <Lock className="w-3.5 h-3.5 text-amber-300" />
                              ) : (
                                <Folder className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <span className="font-semibold text-slate-200 truncate">{f.name}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isProtected ? (
                              isUnlocked ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-1">
                                  <Unlock className="w-3 h-3" />
                                  <span>Terbuka di Sesi</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>Terkunci</span>
                                </span>
                              )
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                Bebas Akses
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800/60 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Untuk mengaktifkan atau menonaktifkan kunci pada folder individual, gunakan tombol menu tiga titik (⋮) di samping nama folder pada sidebar.
                  </span>
                </div>
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
                      src={appLogo}
                      alt="PromptVault App Icon"
                      className="w-12 h-12 rounded-2xl object-contain shadow-lg shadow-indigo-600/30 shrink-0"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = './icons/icon-192.png';
                      }}
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
                    <span className="text-slate-400 text-[11px] block">Akses Aplikasi</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Terbuka Penuh (Bebas Akses)
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

        {/* 4. Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 z-30">
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
