import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  LayoutGrid,
  List,
  Table,
  FolderPlus,
  Download,
  Menu,
  X,
  Bookmark,
  SlidersHorizontal,
  Settings,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
} from 'lucide-react';
import { FilterState, ViewMode, AppTheme } from '../types';
import appLogo from '../assets/logo-192.png';

interface NavbarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onOpenNewPromptModal: () => void;
  onOpenNewFolderModal: () => void;
  onOpenAIAssistantModal: () => void;
  onOpenExportImportModal: () => void;
  onOpenSettingsModal: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  totalPromptsCount: number;
  theme?: AppTheme;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  filters,
  setFilters,
  onOpenNewPromptModal,
  onOpenNewFolderModal,
  onOpenAIAssistantModal,
  onOpenExportImportModal,
  onOpenSettingsModal,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  totalPromptsCount,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Autofocus mobile search input when expanded
  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  // Unified helper for triggering actions and closing dropdown
  const handleAction = (action: () => void) => {
    setIsMobileMenuOpen(false);
    action();
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 📱 MOBILE VIEW (< md / <= 768px): 2-ROW CLEAN MOBILE STRUCTURE */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="block md:hidden px-3 sm:px-4 py-2.5 space-y-2">
        {/* BARIS 1 — BRAND HEADER: [☰] [Logo] PromptVault ... [🔍] */}
        <div className="flex items-center justify-between min-h-[48px]">
          {/* Left: Hamburger + Logo + PromptVault Title */}
          <div className="flex items-center gap-2.5">
            {/* Hamburger Button with comfortable 44x44px touch target */}
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="w-11 h-11 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 active:bg-slate-800 rounded-xl transition-all border border-slate-700/60 shrink-0"
              aria-label="Buka Menu Sidebar Navigasi"
              id="mobile-hamburger-btn"
            >
              {isMobileSidebarOpen ? (
                <X className="w-5 h-5 text-indigo-400" />
              ) : (
                <Menu className="w-5 h-5 text-slate-200" />
              )}
            </button>

            {/* Logo & Brand Name */}
            <div className="flex items-center gap-2">
              <img
                src={appLogo}
                alt="PromptVault Logo"
                className="w-9 h-9 rounded-xl object-contain shadow-md shadow-indigo-500/20 shrink-0"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = './icons/icon-192.png';
                }}
              />
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">
                PromptVault
              </h1>
            </div>
          </div>

          {/* Right: Theme Toggle & Search Toggle Button */}
          <div className="flex items-center gap-1.5">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/90 text-slate-300 hover:text-slate-100 active:scale-95 transition-all shrink-0"
                aria-label={theme === 'light' ? 'Beralih ke Tema Gelap' : 'Beralih ke Tema Terang'}
                title={theme === 'light' ? 'Mode Gelap (Dark Mode)' : 'Mode Terang (Light Mode)'}
                id="mobile-theme-toggle-btn"
              >
                {theme === 'light' ? (
                  <Sun className="w-5 h-5 text-amber-500" />
                ) : (
                  <Moon className="w-5 h-5 text-indigo-400" />
                )}
              </button>
            )}

            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className={`w-11 h-11 flex items-center justify-center rounded-xl border transition-all active:scale-95 ${
                isMobileSearchOpen || filters.searchQuery
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/90 text-slate-300 hover:text-slate-100 border-slate-700/80 hover:bg-slate-700'
              }`}
              aria-label="Cari Prompt"
              title="Buka Pencarian"
              id="mobile-search-toggle-btn"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* EXPANDABLE SEARCH BAR ON MOBILE (When 🔍 clicked or search query present) */}
        {isMobileSearchOpen && (
          <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="relative flex items-center w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                }
                placeholder="Cari prompt, judul, kategori, tag..."
                className="w-full bg-slate-950/90 border border-indigo-500/50 focus:border-indigo-400 text-slate-100 placeholder-slate-400 text-sm rounded-xl pl-10 pr-16 py-2.5 outline-none ring-2 ring-indigo-500/20 shadow-inner"
                id="mobile-expanded-search-input"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {filters.searchQuery && (
                  <button
                    onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                    className="p-1.5 text-slate-400 hover:text-white text-xs bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors"
                    aria-label="Hapus Teks Pencarian"
                  >
                    ✕
                  </button>
                )}
                <button
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-rose-300 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors"
                  aria-label="Tutup Pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BARIS 2 — QUICK ACTION: [ Menu Cepat ▼ ] */}
        <div className="relative" ref={mobileMenuRef}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all active:scale-[0.99] ${
              isMobileMenuOpen
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-indigo-500/40 shadow-sm'
            }`}
            aria-expanded={isMobileMenuOpen}
            aria-label="Buka Menu Cepat Mobile"
            id="mobile-quick-menu-main-btn"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-semibold tracking-wide">Menu Cepat</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-[11px] font-normal opacity-80">Aksi & Fitur</span>
              {isMobileMenuOpen ? (
                <ChevronUp className="w-4 h-4 text-white" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-300" />
              )}
            </div>
          </button>

          {/* DROPDOWN MENU PANEL (Appears directly below button) */}
          {isMobileMenuOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-2 bg-slate-900/98 border border-indigo-500/40 rounded-2xl p-2.5 shadow-2xl shadow-slate-950/95 backdrop-blur-xl z-50 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[75vh] overflow-y-auto"
              id="mobile-quick-menu-dropdown-panel"
            >
              {/* ✨ AI Assistant */}
              <button
                onClick={() => handleAction(onOpenAIAssistantModal)}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/90 active:bg-slate-700/80 transition-all flex items-center gap-3 group"
                id="mobile-dropdown-ai-assistant-btn"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block text-slate-100 text-sm">✨ AI Assistant</span>
                  <span className="text-[11px] text-slate-400 truncate block">Optimalkan & generate prompt Gemini</span>
                </div>
              </button>

              {/* 💾 Backup & Restore */}
              <button
                onClick={() => handleAction(onOpenExportImportModal)}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/90 active:bg-slate-700/80 transition-all flex items-center gap-3 group"
                id="mobile-dropdown-backup-restore-btn"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block text-slate-100 text-sm">💾 Backup & Restore</span>
                  <span className="text-[11px] text-slate-400 truncate block">Ekspor & impor file JSON full-state</span>
                </div>
              </button>



              {/* 🌓 Toggle Tema (Gelap / Terang) */}
              {onToggleTheme && (
                <button
                  onClick={() => handleAction(onToggleTheme)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left text-xs font-medium text-slate-200 hover:text-slate-100 hover:bg-slate-800/90 active:bg-slate-700/80 transition-all flex items-center gap-3 group"
                  id="mobile-dropdown-theme-toggle-btn"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                    {theme === 'light' ? (
                      <Sun className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Moon className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-100 text-sm flex items-center justify-between">
                      <span>{theme === 'light' ? '☀️ Mode Terang' : '🌙 Mode Gelap'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">
                        {theme === 'light' ? 'Light' : 'Dark'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {theme === 'light' ? 'Beralih ke Tema Gelap (Dark Mode)' : 'Beralih ke Tema Terang (Light Mode)'}
                    </span>
                  </div>
                </button>
              )}

              {/* ⚙️ Settings */}
              <button
                onClick={() => handleAction(onOpenSettingsModal)}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/90 active:bg-slate-700/80 transition-all flex items-center gap-3 group"
                id="mobile-dropdown-settings-btn"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block text-slate-100 text-sm">⚙️ Settings</span>
                  <span className="text-[11px] text-slate-400 truncate block">Keamanan, tema & sinkronisasi</span>
                </div>
              </button>

              {/* 📁 Folder */}
              <button
                onClick={() => handleAction(onOpenNewFolderModal)}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800/90 active:bg-slate-700/80 transition-all flex items-center gap-3 group"
                id="mobile-dropdown-add-folder-btn"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block text-slate-100 text-sm">📁 Folder</span>
                  <span className="text-[11px] text-slate-400 truncate block">Buat kategori/folder baru</span>
                </div>
              </button>

              {/* ➕ Prompt Baru */}
              <button
                onClick={() => handleAction(onOpenNewPromptModal)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl text-left text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all flex items-center gap-3 shadow-lg shadow-indigo-600/30 active:scale-[0.98] group"
                id="mobile-dropdown-add-prompt-btn"
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold block text-white text-sm">➕ Prompt Baru</span>
                  <span className="text-[11px] text-indigo-100 truncate block">Simpan prompt & screenshot</span>
                </div>
              </button>

              {/* Mode Tampilan Switcher on Mobile Dropdown */}
              <div className="pt-2 border-t border-slate-800 px-1 mt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 px-1">
                  <span>Mode Tampilan</span>
                  <span className="font-mono text-indigo-300 capitalize">{filters.viewMode}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, viewMode: 'grid' }));
                      setIsMobileMenuOpen(false);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      filters.viewMode === 'grid'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Grid</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, viewMode: 'list' }));
                      setIsMobileMenuOpen(false);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      filters.viewMode === 'list'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List</span>
                  </button>
                  <button
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, viewMode: 'compact' }));
                      setIsMobileMenuOpen(false);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      filters.viewMode === 'compact'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabel</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 💻 DESKTOP / TABLET VIEW (>= md / > 768px): STANDARDIZED TOOLBAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:block max-w-full xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3 min-h-[72px]">
          {/* 1. Left: Sidebar Toggle & Brand Header */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl lg:hidden transition-colors shrink-0"
              aria-label="Toggle Navigation Sidebar"
              id="desktop-sidebar-toggle-btn"
            >
              {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <img
                src={appLogo}
                alt="PromptVault Logo"
                className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-indigo-500/20 shrink-0"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = './icons/icon-192.png';
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-100">
                    PromptVault
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono">
                    v2.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden xl:block">
                  Penyimpanan & Manager Prompt AI
                </p>
              </div>
            </div>
          </div>

          {/* 2. Search Bar: Balanced width (~210-240px) with clean icon */}
          <div className="relative shrink-0 w-44 md:w-48 lg:w-52 xl:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              placeholder="Cari prompt..."
              className="w-full h-11 bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-indigo-500 text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-9 pr-8 transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner"
              id="global-prompt-search-input"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs bg-slate-700 rounded-full w-4 h-4 flex items-center justify-center"
                aria-label="Bersihkan pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* 3. Center-Right: Standardized Quick Action Button Group (Single Shared Component) */}
          <div
            className="flex items-center gap-1.5 lg:gap-2 shrink-0 overflow-x-auto py-1"
            id="desktop-quick-actions-toolbar"
          >
            {/* ✨ AI Assistant (purple accent) */}
            <DesktopQuickActionButton
              id="desktop-qa-ai-assistant"
              title="Optimalkan Prompt dengan Gemini AI"
              variant="purple-ai"
              icon={<Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />}
              label="AI Assistant"
              onClick={onOpenAIAssistantModal}
            />

            {/* 💾 Backup & Restore (blue/indigo accent) */}
            <DesktopQuickActionButton
              id="desktop-qa-backup-restore"
              title="Ekspor dan Impor Seluruh Data Vault (JSON)"
              variant="blue-backup"
              icon={<Download className="w-5 h-5 text-indigo-400" />}
              label="Backup & Restore"
              onClick={onOpenExportImportModal}
            />



            {/* ⚙️ Settings (slate/indigo accent) */}
            <DesktopQuickActionButton
              id="desktop-qa-settings"
              title="Pengaturan Keamanan, Firebase & Tampilan"
              variant="slate-settings"
              icon={<Settings className="w-5 h-5 text-indigo-400" />}
              label="Settings"
              onClick={onOpenSettingsModal}
            />

            {/* 🌓 Toggle Tema (Dark/Light) */}
            {onToggleTheme && (
              <DesktopQuickActionButton
                id="desktop-qa-theme-toggle"
                title={theme === 'light' ? 'Beralih ke Tema Gelap (Dark Mode)' : 'Beralih ke Tema Terang (Light Mode)'}
                variant="yellow-theme"
                icon={theme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                label={theme === 'light' ? 'Terang' : 'Gelap'}
                onClick={onToggleTheme}
              />
            )}

            {/* 📁 Folder (peach/orange accent) */}
            <DesktopQuickActionButton
              id="desktop-qa-folder"
              title="Buat Folder Kategori Baru"
              variant="peach-folder"
              icon={<FolderPlus className="w-5 h-5 text-amber-400" />}
              label="Folder"
              onClick={onOpenNewFolderModal}
            />

            {/* ➕ Prompt (Primary gradient action) */}
            <DesktopQuickActionButton
              id="desktop-qa-new-prompt"
              title="Tambah Prompt Baru"
              variant="primary-prompt"
              icon={<Plus className="w-5 h-5 text-white" />}
              label="Prompt"
              onClick={onOpenNewPromptModal}
            />
          </div>

          {/* 4. Right: Compact Segmented View Switcher (Grid | List | Tabel) */}
          <div
            id="desktop-view-switcher"
            className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/70 shrink-0 h-11"
          >
            <button
              onClick={() => setFilters((prev) => ({ ...prev, viewMode: 'grid' }))}
              className={`h-9 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                filters.viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Grid"
              id="desktop-view-grid-btn"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden 2xl:inline text-[11px]">Grid</span>
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, viewMode: 'list' }))}
              className={`h-9 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                filters.viewMode === 'list'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Daftar (List)"
              id="desktop-view-list-btn"
            >
              <List className="w-4 h-4" />
              <span className="hidden 2xl:inline text-[11px]">List</span>
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, viewMode: 'compact' }))}
              className={`h-9 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                filters.viewMode === 'compact'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Tabel Kompak"
              id="desktop-view-compact-btn"
            >
              <Table className="w-4 h-4" />
              <span className="hidden 2xl:inline text-[11px]">Tabel</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 STANDARDIZED DESKTOP QUICK ACTION BUTTON COMPONENT
// Strict geometric uniformity: 88px width x 68px height across ALL buttons
// ─────────────────────────────────────────────────────────────────────────────
interface DesktopQuickActionButtonProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title: string;
  variant:
    | 'purple-ai'
    | 'blue-backup'
    | 'rose-lock'
    | 'rose-active'
    | 'slate-settings'
    | 'yellow-theme'
    | 'peach-folder'
    | 'amber-folder'
    | 'primary-prompt';
}

const DesktopQuickActionButton: React.FC<DesktopQuickActionButtonProps> = ({
  id,
  icon,
  label,
  onClick,
  title,
  variant,
}) => {
  // Variant theme definitions (color only, geometry is 100% strictly uniform)
  const variantStyles: Record<typeof variant, string> = {
    'purple-ai':
      'bg-purple-950/30 hover:bg-purple-900/50 border-purple-500/30 hover:border-purple-400/60 text-purple-200 shadow-sm hover:shadow-purple-900/30',
    'blue-backup':
      'bg-slate-800/80 hover:bg-indigo-950/40 border-slate-700/70 hover:border-indigo-500/50 text-slate-200 hover:text-indigo-200',
    'rose-lock':
      'bg-slate-800/80 hover:bg-rose-950/40 border-slate-700/70 hover:border-rose-500/50 text-slate-200 hover:text-rose-200',
    'rose-active':
      'bg-rose-950/50 border-rose-500/60 text-rose-200 shadow-sm shadow-rose-950/50',
    'slate-settings':
      'bg-slate-800/80 hover:bg-slate-750 hover:bg-slate-800 border-slate-700/70 hover:border-slate-500/60 text-slate-200',
    'yellow-theme':
      'bg-slate-800/80 hover:bg-amber-950/40 border-slate-700/70 hover:border-amber-500/50 text-slate-200 hover:text-amber-200',
    'peach-folder':
      'bg-slate-800/80 hover:bg-orange-950/40 border-slate-700/70 hover:border-orange-500/50 text-slate-200 hover:text-orange-200',
    'amber-folder':
      'bg-slate-800/80 hover:bg-amber-950/40 border-slate-700/70 hover:border-amber-500/50 text-slate-200 hover:text-amber-200',
    'primary-prompt':
      'bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-indigo-400/40 text-white shadow-md shadow-indigo-600/30 font-semibold',
  };

  return (
    <button
      id={id}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-[88px] min-w-[88px] max-w-[88px] h-[68px] min-h-[68px] max-h-[68px] p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 shrink-0 transition-all duration-150 active:scale-95 group select-none ${variantStyles[variant]}`}
    >
      {/* Icon: Always placed on top, exactly 20x20px */}
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {icon}
      </div>

      {/* Label: Always placed at bottom, strictly centered, up to 2 lines, height fixed */}
      <span className="text-[11px] font-medium leading-[1.15] text-center w-full px-0.5 line-clamp-2 break-words">
        {label}
      </span>
    </button>
  );
};


