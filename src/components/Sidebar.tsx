import React, { useState } from 'react';
import {
  Folder,
  Star,
  Layers,
  Bot,
  Tag,
  Plus,
  Trash2,
  Edit2,
  X,
  FilterX,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Lock,
  Unlock,
  KeyRound,
  MoreVertical,
  ShieldCheck,
  Download,
} from 'lucide-react';
import {
  FilterState,
  FOLDER_COLORS,
  FolderItem,
  PromptItem,
  TARGET_AI_OPTIONS,
} from '../types';
import { sortFoldersByName } from '../utils/storage';

interface SidebarProps {
  prompts: PromptItem[];
  folders: FolderItem[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  unlockedFolderIds: Set<string>;
  onOpenNewFolderModal: () => void;
  onEditFolder: (folder: FolderItem) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenUnlockModal: (folder: FolderItem) => void;
  onOpenLockConfigModal: (folder: FolderItem, mode?: 'set' | 'change' | 'remove') => void;
  onLockFolderNow: (folderId: string) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  prompts,
  folders,
  filters,
  setFilters,
  unlockedFolderIds,
  onOpenNewFolderModal,
  onEditFolder,
  onDeleteFolder,
  onOpenUnlockModal,
  onOpenLockConfigModal,
  onLockFolderNow,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
}) => {
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  // Sort folders automatically (numeric prefix first 01, 02.. then A-Z)
  const sortedFolders = sortFoldersByName(folders);

  // Stats
  const totalPrompts = prompts.length;
  const favoritePrompts = prompts.filter((p) => p.isFavorite).length;
  const totalImages = prompts.reduce((acc, p) => acc + (p.images?.length || 0), 0);

  // Helper to check if a prompt belongs to a locked folder that is currently locked
  const isPromptAccessible = (p: PromptItem) => {
    if (!p.folderId) return true;
    const folder = folders.find((f) => f.id === p.folderId);
    if (!folder || !folder.isLocked) return true;
    return unlockedFolderIds.has(folder.id);
  };

  const accessiblePrompts = prompts.filter(isPromptAccessible);

  // Exact counts for the 3 main menus based on accessible prompts
  const favoritePromptsCount = accessiblePrompts.filter((p) => p.isFavorite).length;
  const imagePromptsCount = accessiblePrompts.filter(
    (p) => p.images && p.images.length > 0
  ).length;
  const textPromptsCount = accessiblePrompts.filter(
    (p) => !p.images || p.images.length === 0
  ).length;

  // Collect all unique tags and count usage
  const tagCountsMap: Record<string, number> = {};
  prompts.forEach((prompt) => {
    (prompt.tags || []).forEach((t) => {
      const normalized = t.toLowerCase().trim();
      if (normalized) {
        tagCountsMap[normalized] = (tagCountsMap[normalized] || 0) + 1;
      }
    });
  });
  const sortedTags = Object.entries(tagCountsMap).sort((a, b) => b[1] - a[1]);

  // Count per Target AI
  const aiCountsMap: Record<string, number> = {};
  prompts.forEach((p) => {
    if (p.targetAI) {
      aiCountsMap[p.targetAI] = (aiCountsMap[p.targetAI] || 0) + 1;
    }
  });

  const isDefaultFavoritView =
    filters.onlyFavorites &&
    filters.folderId === 'all' &&
    filters.category === 'all' &&
    filters.targetAI === 'all' &&
    filters.tag === 'all' &&
    filters.contentType === 'all' &&
    filters.searchQuery.trim().length === 0;

  const isFilterActive = !isDefaultFavoritView;

  const resetAllFilters = () => {
    setFilters((prev) => ({
      ...prev,
      searchQuery: '',
      category: 'all',
      folderId: 'all',
      targetAI: 'all',
      tag: 'all',
      onlyFavorites: true,
      contentType: 'all',
    }));
  };

  const content = (
    <div className="sidebar-vault flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 text-xs overflow-y-auto custom-scrollbar p-4 space-y-6">
      {/* Mobile Close Button */}
      <div className="flex items-center justify-between lg:hidden pb-3 border-b border-slate-800">
        <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> Navigation Vault
        </span>
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/90 active:bg-slate-700 rounded-xl transition-colors shrink-0"
          aria-label="Tutup Menu Sidebar"
          id="close-mobile-sidebar-btn"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Summary Banner */}
      <div className="sidebar-stats-banner bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/40 p-3.5 rounded-2xl border border-indigo-500/20 shadow-inner space-y-2">
        <div className="flex items-center justify-between text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
          <span>Ringkasan Koleksi</span>
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="sidebar-stat-card bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
            <div className="text-base font-extrabold text-slate-100">{totalPrompts}</div>
            <div className="text-[10px] text-slate-400">Prompts</div>
          </div>
          <div className="sidebar-stat-card bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
            <div className="text-base font-extrabold text-amber-400">{favoritePrompts}</div>
            <div className="text-[10px] text-slate-400">Favorit</div>
          </div>
          <div className="sidebar-stat-card bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
            <div className="text-base font-extrabold text-purple-400">{totalImages}</div>
            <div className="text-[10px] text-slate-400">Gambar</div>
          </div>
        </div>
      </div>

      {/* Active Filter Clear Notice */}
      {isFilterActive && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <FilterX className="w-3.5 h-3.5 text-amber-400" /> Filter Aktif
          </span>
          <button
            onClick={resetAllFilters}
            className="text-[11px] font-semibold underline hover:text-white"
            id="reset-filters-btn"
          >
            Reset
          </button>
        </div>
      )}

      {/* Main Views: 3 Menu Kategori Utama */}
      <div className="space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
          Menu Utama
        </div>

        {/* 1. ⭐ Prompt Favorit */}
        <button
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              folderId: 'all',
              onlyFavorites: true,
              contentType: 'all',
            }))
          }
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            filters.onlyFavorites && filters.folderId === 'all'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          id="filter-favorites-btn"
        >
          <div className="flex items-center gap-2">
            <Star
              className={`w-4 h-4 ${
                filters.onlyFavorites && filters.folderId === 'all'
                  ? 'text-amber-300 fill-amber-300'
                  : 'text-amber-400 fill-amber-400'
              }`}
            />
            <span>Prompt Favorit</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
              filters.onlyFavorites && filters.folderId === 'all'
                ? 'bg-white/20 text-white border-transparent font-semibold'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {favoritePromptsCount}
          </span>
        </button>

        {/* 2. 🖼️ Semua Prompt Gambar */}
        <button
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              folderId: 'all',
              onlyFavorites: false,
              contentType: 'image',
            }))
          }
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            !filters.onlyFavorites &&
            filters.contentType === 'image' &&
            filters.folderId === 'all'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          id="filter-image-prompts-btn"
        >
          <div className="flex items-center gap-2">
            <ImageIcon
              className={`w-4 h-4 ${
                !filters.onlyFavorites &&
                filters.contentType === 'image' &&
                filters.folderId === 'all'
                  ? 'text-white'
                  : 'text-purple-400'
              }`}
            />
            <span>Semua Prompt Gambar</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
              !filters.onlyFavorites &&
              filters.contentType === 'image' &&
              filters.folderId === 'all'
                ? 'bg-white/20 text-white border-transparent font-semibold'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {imagePromptsCount}
          </span>
        </button>

        {/* 3. 📝 Semua Prompt Teks */}
        <button
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              folderId: 'all',
              onlyFavorites: false,
              contentType: 'text',
            }))
          }
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
            !filters.onlyFavorites &&
            filters.contentType === 'text' &&
            filters.folderId === 'all'
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'hover:bg-slate-800 text-slate-300'
          }`}
          id="filter-text-prompts-btn"
        >
          <div className="flex items-center gap-2">
            <FileText
              className={`w-4 h-4 ${
                !filters.onlyFavorites &&
                filters.contentType === 'text' &&
                filters.folderId === 'all'
                  ? 'text-white'
                  : 'text-indigo-400'
              }`}
            />
            <span>Semua Prompt Teks</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
              !filters.onlyFavorites &&
              filters.contentType === 'text' &&
              filters.folderId === 'all'
                ? 'bg-white/20 text-white border-transparent font-semibold'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {textPromptsCount}
          </span>
        </button>
      </div>

      {/* Custom Folders Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Folder Saya
          </span>
          <button
            onClick={onOpenNewFolderModal}
            className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
            title="Tambah Folder Baru"
            id="sidebar-add-folder-btn"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {sortedFolders.length === 0 ? (
            <p className="text-slate-500 text-[11px] px-2 italic">Belum ada folder khusus.</p>
          ) : (
            sortedFolders.map((folder) => {
              const colorConfig =
                FOLDER_COLORS.find((c) => c.value === folder.color) || FOLDER_COLORS[0];
              const isLocked = Boolean(folder.isLocked);
              const isUnlockedInSession = unlockedFolderIds.has(folder.id);
              const isSelected = filters.folderId === folder.id;

              // Filter prompt count: hide count or count only visible prompts
              const countInFolder = prompts.filter((p) => p.folderId === folder.id).length;

              const handleFolderClick = () => {
                if (isLocked && !isUnlockedInSession) {
                  onOpenUnlockModal(folder);
                } else {
                  setFilters((prev) => ({
                    ...prev,
                    folderId: folder.id,
                    onlyFavorites: false,
                    contentType: 'all',
                  }));
                }
              };

              return (
                <div
                  key={folder.id}
                  className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? `is-active-folder ${colorConfig.activeBg || 'bg-indigo-600'} border border-indigo-500/50 text-white shadow-md ring-1 ring-white/10 font-medium`
                      : isLocked && !isUnlockedInSession
                      ? 'is-locked-folder hover:bg-slate-800/70 text-slate-300 border border-transparent'
                      : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                  }`}
                >
                  <button
                    onClick={handleFolderClick}
                    className={`flex-1 flex items-center gap-2 truncate text-left transition-colors ${
                      isSelected ? 'text-white font-semibold' : 'text-slate-300 hover:text-slate-100'
                    }`}
                    title={
                      isLocked
                        ? isUnlockedInSession
                          ? 'Folder Terproteksi (Terbuka di Sesi Ini)'
                          : 'Folder Terkunci (Klik untuk Masukkan Key)'
                        : folder.name
                    }
                  >
                    {isLocked && isUnlockedInSession ? (
                      <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Folder className={`w-4 h-4 ${isSelected ? 'text-white' : colorConfig.text} shrink-0`} />
                    )}
                    <span className="truncate">{folder.name}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Soft Rose Lock Badge (single compact lock icon) or Prompt Count Badge */}
                    {isLocked && !isUnlockedInSession ? (
                      <span
                        className="soft-rose-lock-badge flex items-center justify-center w-6 h-5 rounded-md border text-[10px] font-medium shrink-0 transition-colors"
                        title="Folder Terkunci"
                      >
                        <Lock className="w-3 h-3 shrink-0" />
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md border transition-colors ${
                          isSelected
                            ? 'bg-slate-900/90 text-slate-100 border-slate-700/80 font-semibold shadow-xs'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {countInFolder}
                      </span>
                    )}

                    {/* Three-dots Menu Trigger */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFolderMenuId(
                            activeFolderMenuId === folder.id ? null : folder.id
                          );
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          isSelected
                            ? 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60'
                        }`}
                        title="Menu Opsi Folder"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeFolderMenuId === folder.id && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setActiveFolderMenuId(null)}
                          />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-40 text-xs text-slate-200"
                          >
                            {/* Rename / Edit */}
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                onEditFolder(folder);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-slate-200"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Rename / Edit</span>
                            </button>

                            {/* Lock Controls */}
                            {!isLocked ? (
                              <button
                                onClick={() => {
                                  setActiveFolderMenuId(null);
                                  onOpenLockConfigModal(folder, 'set');
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-amber-300"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Kunci Folder</span>
                              </button>
                            ) : (
                              <>
                                {/* Unlock / Relock if in session */}
                                {isUnlockedInSession ? (
                                  <button
                                    onClick={() => {
                                      setActiveFolderMenuId(null);
                                      onLockFolderNow(folder.id);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-amber-300"
                                  >
                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Kunci Sekarang</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActiveFolderMenuId(null);
                                      onOpenUnlockModal(folder);
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-emerald-300"
                                  >
                                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Buka Folder</span>
                                  </button>
                                )}

                                {/* Change Key */}
                                <button
                                  onClick={() => {
                                    setActiveFolderMenuId(null);
                                    onOpenLockConfigModal(folder, 'change');
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-slate-200"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Ubah Key</span>
                                </button>

                                {/* Remove Lock */}
                                <button
                                  onClick={() => {
                                    setActiveFolderMenuId(null);
                                    onOpenLockConfigModal(folder, 'remove');
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2 text-rose-300"
                                >
                                  <Unlock className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Hapus Kunci</span>
                                </button>
                              </>
                            )}

                            <div className="my-1 border-t border-slate-700" />

                            {/* Delete Folder */}
                            <button
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                onDeleteFolder(folder.id);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 text-rose-300 flex items-center gap-2"
                              id={`sidebar-delete-folder-${folder.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus Folder</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tag Cloud */}
      {sortedTags.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center justify-between">
            <span>Filter Tag</span>
            <Tag className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex flex-wrap gap-1.5 px-1">
            {sortedTags.map(([tag, count]) => {
              const isSelected = filters.tag === tag;
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      tag: isSelected ? 'all' : tag,
                    }))
                  }
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/50'
                  }`}
                >
                  #{tag} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Target AI Filters */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center justify-between">
          <span>Target Model AI</span>
          <Bot className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="flex flex-wrap gap-1.5 px-1">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, targetAI: 'all' }))}
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
              filters.targetAI === 'all'
                ? 'bg-indigo-600 text-white font-medium'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-100 border border-slate-700/60'
            }`}
          >
            Semua AI
          </button>
          {TARGET_AI_OPTIONS.map((ai) => {
            const count = aiCountsMap[ai] || 0;
            if (count === 0) return null;
            const isSelected = filters.targetAI === ai;
            return (
              <button
                key={ai}
                onClick={() => setFilters((prev) => ({ ...prev, targetAI: ai }))}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-purple-600 text-white font-medium'
                    : 'bg-slate-800/80 text-slate-300 hover:text-slate-100 border border-slate-700/60'
                }`}
              >
                <span>{ai}</span>
                <span className="opacity-60 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-[calc(100vh-61px)] sticky top-[61px]">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-50 w-[85vw] max-w-[320px] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
