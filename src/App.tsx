/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { PromptCard } from './components/PromptCard';
import { PromptListItem } from './components/PromptListItem';
import { PromptCompactTable } from './components/PromptCompactTable';
import { PromptDetailModal } from './components/PromptDetailModal';
import { PromptFormModal } from './components/PromptFormModal';
import { FolderModal } from './components/FolderModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { VariableFillerModal } from './components/VariableFillerModal';
import { ExportImportModal } from './components/ExportImportModal';
import { ImageLightboxModal } from './components/ImageLightboxModal';
import { SettingsModal } from './components/SettingsModal';
import { DeleteFolderModal } from './components/DeleteFolderModal';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import appLogo from './assets/logo-192.png';
import {
  FilterState,
  FolderItem,
  PromptItem,
  PromptVersion,
  SortOption,
  TagItem,
} from './types';
import { copyToClipboard, getStoredTags, saveTagsToStorage } from './utils/storage';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  subscribeToSettings,
  subscribeToPrompts,
  subscribeToFolders,
  saveSettingsToFirebase,
  savePromptToFirebase,
  updatePromptUsageInFirebase,
  deletePromptFromFirebase,
  saveFolderToFirebase,
  deleteFolderFromFirebase,
  atomicDeleteFolderAndRelocatePrompts,
  atomicDeleteFolderAndAllPrompts,
  atomicDeleteEmptyFolder,
  fetchSettingsFromFirebase,
  restoreFullStateToFirebase,
} from './services/firebaseService';
import {
  getStoredTheme,
  saveStoredTheme,
  applyThemeToDocument,
} from './utils/storage';
import { AppTheme } from './types';
import { RestoreMode, PreRestoreSnapshot } from './utils/backupRestore';
import {
  Plus,
  Bookmark,
  CheckCircle,
  SearchX,
  Sparkles,
  Database,
  CloudCheck,
  Shield,
  Star,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

export default function App() {
  // Primary State from Firebase & LocalStorage
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [tagsList, setTagsList] = useState<TagItem[]>(() => getStoredTags());
  const [appSettings, setAppSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_APP_SETTINGS,
    theme: getStoredTheme(),
  }));

  // Firebase connection & restore state
  const [isFirebaseConnecting, setIsFirebaseConnecting] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSettingsRestored, setIsSettingsRestored] = useState(false);

  // Filter State - Default page is "Prompt Favorit" on every new launch/open
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    category: 'all',
    folderId: 'all',
    targetAI: 'all',
    tag: 'all',
    onlyFavorites: true,
    contentType: 'all',
    sortBy: 'newest',
    viewMode: 'grid',
  });

  // Mobile Sidebar Drawer
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal Dialog States
  const [selectedDetailPrompt, setSelectedDetailPrompt] = useState<PromptItem | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);

  const [isAIAssistantModalOpen, setIsAIAssistantModalOpen] = useState(false);
  const [variableFillerPrompt, setVariableFillerPrompt] = useState<PromptItem | null>(null);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Auto-sync tags whenever prompts change
  useEffect(() => {
    if (prompts.length > 0) {
      setTagsList((prevTags) => {
        const tagMap = new Map<string, TagItem>();
        prevTags.forEach((t) => tagMap.set(t.normalizedName, t));

        let changed = false;
        prompts.forEach((p) => {
          if (Array.isArray(p.tags)) {
            p.tags.forEach((tagStr) => {
              const trimmed = (tagStr || '').trim().replace(/^#/, '');
              if (trimmed) {
                const norm = trimmed.toLowerCase();
                if (!tagMap.has(norm)) {
                  changed = true;
                  tagMap.set(norm, {
                    id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: trimmed,
                    normalizedName: norm,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                  });
                }
              }
            });
          }
        });

        if (changed) {
          const updated = Array.from(tagMap.values());
          saveTagsToStorage(updated);
          return updated;
        }
        return prevTags;
      });
    }
  }, [prompts]);

  const handleCreateTag = (tagName: string): TagItem => {
    const trimmed = (tagName || '').trim().replace(/^#/, '');
    const normalized = trimmed.toLowerCase();
    if (!trimmed) {
      throw new Error('Nama tag tidak boleh kosong');
    }

    const existing = tagsList.find((t) => t.normalizedName === normalized);
    if (existing) {
      if (!existing.isActive) {
        const updated = tagsList.map((t) => (t.id === existing.id ? { ...t, isActive: true } : t));
        setTagsList(updated);
        saveTagsToStorage(updated);
        return { ...existing, isActive: true };
      }
      return existing;
    }

    const newTag: TagItem = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: trimmed,
      normalizedName: normalized,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [...tagsList, newTag];
    setTagsList(updated);
    saveTagsToStorage(updated);
    return newTag;
  };

  // Immediate theme synchronization on state changes & mount
  useEffect(() => {
    const currentTheme = appSettings.theme || 'dark';
    saveStoredTheme(currentTheme);
    applyThemeToDocument(currentTheme);
  }, [appSettings.theme]);

  // Handler for instant theme toggling from Navbar or Quick controls
  const handleToggleTheme = () => {
    const nextTheme: AppTheme = appSettings.theme === 'light' ? 'dark' : 'light';
    saveStoredTheme(nextTheme);
    applyThemeToDocument(nextTheme);
    const updatedSettings: AppSettings = {
      ...appSettings,
      theme: nextTheme,
    };
    setAppSettings(updatedSettings);
    saveSettingsToFirebase(updatedSettings);
    showToast(
      nextTheme === 'light'
        ? '☀️ Beralih ke Tema Terang (Light Mode)'
        : '🌙 Beralih ke Tema Gelap (Dark Mode)'
    );
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    if (newSettings.theme && newSettings.theme !== appSettings.theme) {
      saveStoredTheme(newSettings.theme);
      applyThemeToDocument(newSettings.theme);
    }
    setAppSettings(newSettings);
    await saveSettingsToFirebase(newSettings);
  };

  // 1. Initial connection & restore from Firebase Cloud Firestore
  useEffect(() => {
    let unsubSettings: (() => void) | null = null;
    let unsubPrompts: (() => void) | null = null;
    let unsubFolders: (() => void) | null = null;

    const initFirebaseConnection = async () => {
      setIsFirebaseConnecting(true);
      try {
        // Fetch and apply last saved settings from Firebase doc: app/settings/current/main
        const restoredSettings = await fetchSettingsFromFirebase();
        const localTheme = getStoredTheme();
        const effectiveTheme = localTheme || restoredSettings.theme || 'dark';
        setAppSettings({
          ...restoredSettings,
          theme: effectiveTheme,
        });
        applyThemeToDocument(effectiveTheme);

        // Apply saved viewMode & sortBy preferences, but ensure Prompt Favorit is the default landing page on every launch/reload
        if (restoredSettings) {
          setFilters((prev) => ({
            ...prev,
            viewMode: restoredSettings.viewMode || prev.viewMode,
            sortBy: (restoredSettings.sortBy as SortOption) || prev.sortBy,
            // Always land on Prompt Favorit as default on launch/reload
            onlyFavorites: true,
            folderId: 'all',
            contentType: 'all',
            searchQuery: '',
            category: 'all',
            tag: 'all',
            targetAI: 'all',
          }));
        }

        setIsFirebaseConnected(true);
        setIsSettingsRestored(true);

        // Subscribe to Realtime Settings
        unsubSettings = subscribeToSettings(
          (newSettings) => {
            const currentLocalTheme = getStoredTheme();
            const effTheme = currentLocalTheme || newSettings.theme || 'dark';
            setAppSettings({
              ...newSettings,
              theme: effTheme,
            });
            setIsFirebaseConnected(true);
          },
          (err) => {
            console.error('Settings realtime sub error:', err);
            setIsFirebaseConnected(false);
          }
        );

        // Subscribe to Realtime Prompts
        unsubPrompts = subscribeToPrompts(
          (promptsList) => {
            setPrompts(promptsList);
            setIsFirebaseConnected(true);
          },
          (err) => {
            console.error('Prompts realtime sub error:', err);
            setIsFirebaseConnected(false);
          }
        );

        // Subscribe to Realtime Folders
        unsubFolders = subscribeToFolders(
          (foldersList) => {
            setFolders(foldersList);
            setIsFirebaseConnected(true);
          },
          (err) => {
            console.error('Folders realtime sub error:', err);
            setIsFirebaseConnected(false);
          }
        );
      } catch (err) {
        console.error('Firebase connection error:', err);
        setIsFirebaseConnected(false);
      } finally {
        setIsFirebaseConnecting(false);
      }
    };

    initFirebaseConnection();

    return () => {
      if (unsubSettings) unsubSettings();
      if (unsubPrompts) unsubPrompts();
      if (unsubFolders) unsubFolders();
    };
  }, []);

  // 2. Sync filters change automatically to Firebase app/settings/current/main
  const handleFilterChange: React.Dispatch<React.SetStateAction<FilterState>> = (action) => {
    setFilters((prev) => {
      const nextFilters = typeof action === 'function' ? action(prev) : action;

      if (isSettingsRestored) {
        saveSettingsToFirebase({
          filters: {
            category: nextFilters.category,
            targetAI: nextFilters.targetAI,
            folderId: nextFilters.folderId,
            isFavoriteOnly: nextFilters.onlyFavorites,
          },
          viewMode: nextFilters.viewMode,
          sortBy: nextFilters.sortBy as 'updatedAt' | 'title' | 'createdAt',
          searchQuery: nextFilters.searchQuery,
        }).catch((err) => console.warn('Auto-save settings error:', err));
      }

      return nextFilters;
    });
  };

  // Filter & Sort Calculations
  const filteredAndSortedPrompts = useMemo(() => {
    let list = [...prompts];

    // 1. Search Query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const textMatch = p.promptText.toLowerCase().includes(q);
        const categoryMatch = p.category.toLowerCase().includes(q);
        const aiMatch = p.targetAI.toLowerCase().includes(q);
        const tagsMatch = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        const descMatch = (p.description || '').toLowerCase().includes(q);
        return titleMatch || textMatch || categoryMatch || aiMatch || tagsMatch || descMatch;
      });
    }

    // 2. Category
    if (filters.category !== 'all') {
      list = list.filter((p) => p.category === filters.category);
    }

    // 3. Folder
    if (filters.folderId !== 'all') {
      list = list.filter((p) => p.folderId === filters.folderId);
    }

    // 4. Target AI
    if (filters.targetAI !== 'all') {
      list = list.filter((p) => p.targetAI === filters.targetAI);
    }

    // 5. Tag
    if (filters.tag !== 'all') {
      list = list.filter((p) =>
        (p.tags || []).some((t) => t.toLowerCase() === filters.tag.toLowerCase())
      );
    }

    // 6. Favorites
    if (filters.onlyFavorites) {
      list = list.filter((p) => p.isFavorite);
    }

    // 6.1 Content Type Filter (Semua Prompt Gambar vs Semua Prompt Teks)
    if (filters.contentType === 'image') {
      list = list.filter((p) => p.images && p.images.length > 0);
    } else if (filters.contentType === 'text') {
      list = list.filter((p) => !p.images || p.images.length === 0);
    }

    // 7. Sorting
    list.sort((a, b) => {
      if (filters.sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (filters.sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (filters.sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (filters.sortBy === 'favorites') {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (filters.sortBy === 'most_used') {
        const countA = a.usageCount || 0;
        const countB = b.usageCount || 0;
        if (countA !== countB) {
          return countB - countA;
        }
        const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (filters.sortBy === 'last_used') {
        const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    return list;
  }, [prompts, filters]);

  // Determine if viewing a specific folder (hide folder badge on cards) vs Menu Utama (show folder badge)
  const isInsideSpecificFolder = Boolean(filters.folderId && filters.folderId !== 'all');

  // Prompt Handlers connected to Firebase
  const handleSavePrompt = async (data: Partial<PromptItem>, changeNote?: string) => {
    const nowISO = new Date().toISOString();

    if (editingPrompt) {
      // Edit existing prompt
      const nextVersionNumber = (editingPrompt.versionHistory?.length || 1) + 1;
      const newVersionObj: PromptVersion = {
        id: `ver-${Date.now()}`,
        version: nextVersionNumber,
        updatedAt: nowISO,
        title: data.title || editingPrompt.title,
        promptText: data.promptText || editingPrompt.promptText,
        changeNote: changeNote || 'Pembaruan isi prompt',
      };

      const updatedPrompt: PromptItem = {
        ...editingPrompt,
        ...data,
        updatedAt: nowISO,
        versionHistory: [newVersionObj, ...(editingPrompt.versionHistory || [])],
      };

      await savePromptToFirebase(updatedPrompt);
      showToast('Prompt berhasil tersimpan di Firebase!');
    } else {
      // Create new prompt
      const newId = `prompt-${Date.now()}`;
      const initialVersion: PromptVersion = {
        id: `ver-${Date.now()}`,
        version: 1,
        updatedAt: nowISO,
        title: data.title || 'Untitled Prompt',
        promptText: data.promptText || '',
        changeNote: 'Inisialisasi prompt baru',
      };

      const newPromptItem: PromptItem = {
        id: newId,
        title: data.title || 'Untitled Prompt',
        promptText: data.promptText || '',
        description: data.description || '',
        targetAI: data.targetAI || appSettings.preferences.defaultTargetAI || 'ChatGPT',
        category: data.category || appSettings.preferences.defaultCategory || 'Umum',
        folderId: data.folderId || null,
        tags: data.tags || [],
        images: data.images || [],
        isFavorite: false,
        createdAt: nowISO,
        updatedAt: nowISO,
        versionHistory: [initialVersion],
        variables: data.variables || [],
      };

      await savePromptToFirebase(newPromptItem);
      showToast('Prompt baru tersimpan ke Firebase!');
    }

    setIsFormModalOpen(false);
    setEditingPrompt(null);
  };

  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const promptToUpdate = prompts.find((p) => p.id === id);
    if (!promptToUpdate) return;

    const nextFav = !promptToUpdate.isFavorite;
    const updated = { ...promptToUpdate, isFavorite: nextFav, updatedAt: new Date().toISOString() };
    await savePromptToFirebase(updated);
    showToast(nextFav ? 'Ditambahkan ke Favorit (Firebase)!' : 'Dihapus dari Favorit!');
  };

  const handleTrackPromptUsage = async (promptId: string) => {
    const targetPrompt = prompts.find((p) => p.id === promptId);
    if (!targetPrompt) return;

    const nowISO = new Date().toISOString();
    const nextCount = (targetPrompt.usageCount || 0) + 1;
    const updated: PromptItem = {
      ...targetPrompt,
      usageCount: nextCount,
      lastUsedAt: nowISO,
    };

    // Optimistically update local prompts state
    setPrompts((prev) => prev.map((p) => (p.id === promptId ? updated : p)));

    // Synchronize to Firebase
    try {
      await updatePromptUsageInFirebase(promptId, nextCount, nowISO);
    } catch (err) {
      console.error('[Usage Tracking] Error updating usage in Firebase:', err);
    }
  };

  const handleCopyPrompt = async (text: string, e?: React.MouseEvent, promptId?: string) => {
    e?.stopPropagation();
    const ok = await copyToClipboard(text);
    if (ok) {
      showToast('Teks Prompt tersalin ke Clipboard!');
      if (promptId) {
        handleTrackPromptUsage(promptId);
      }
    }
  };

  const handleDuplicatePrompt = async (promptToDup: PromptItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nowISO = new Date().toISOString();
    const dupPrompt: PromptItem = {
      ...promptToDup,
      id: `prompt-${Date.now()}`,
      title: `${promptToDup.title} (Salinan)`,
      createdAt: nowISO,
      updatedAt: nowISO,
      isFavorite: false,
    };
    await savePromptToFirebase(dupPrompt);
    showToast('Prompt berhasil diduplikasi ke Firebase!');
  };

  const handleDeletePrompt = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus prompt ini secara permanen dari Firebase?')) {
      await deletePromptFromFirebase(id);
      if (selectedDetailPrompt?.id === id) {
        setSelectedDetailPrompt(null);
      }
      showToast('Prompt telah dihapus dari Firebase.');
    }
  };

  const handleRestoreVersion = async (promptId: string, version: PromptVersion) => {
    const p = prompts.find((item) => item.id === promptId);
    if (!p) return;

    const restored: PromptItem = {
      ...p,
      title: version.title,
      promptText: version.promptText,
      updatedAt: new Date().toISOString(),
    };
    await savePromptToFirebase(restored);
    showToast(`Berhasil memulihkan ke versi v${version.version}!`);
    setSelectedDetailPrompt(null);
  };

  // Folder Handlers connected to Firebase
  const handleSaveFolder = async (folderData: Partial<FolderItem>) => {
    if (editingFolder) {
      const updatedFolder: FolderItem = {
        ...editingFolder,
        ...folderData,
      };
      await saveFolderToFirebase(updatedFolder);
      showToast('Folder berhasil diperbarui di Firebase!');
    } else {
      const newFolder: FolderItem = {
        id: `folder-${Date.now()}`,
        name: folderData.name || 'Folder Baru',
        color: folderData.color || 'indigo',
        description: folderData.description || '',
        createdAt: new Date().toISOString(),
      };
      await saveFolderToFirebase(newFolder);
      showToast('Folder baru tersimpan di Firebase!');
    }
    setIsFolderModalOpen(false);
    setEditingFolder(null);
  };

  const handleDeleteFolder = (folderId: string) => {
    const target = folders.find((f) => f.id === folderId);
    if (target) {
      setDeletingFolder(target);
    }
  };

  const handleConfirmRelocateAndDeleteFolder = async (
    folderId: string,
    targetFolderId: string | null,
    affectedPrompts: PromptItem[]
  ): Promise<boolean> => {
    try {
      await atomicDeleteFolderAndRelocatePrompts(folderId, targetFolderId, affectedPrompts);
      // Sync local state immediately
      setPrompts((prev) =>
        prev.map((p) =>
          p.folderId === folderId
            ? { ...p, folderId: targetFolderId, updatedAt: new Date().toISOString() }
            : p
        )
      );
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (filters.folderId === folderId) {
        handleFilterChange((prev) => ({ ...prev, folderId: 'all' }));
      }
      setDeletingFolder(null);
      showToast('Folder berhasil dihapus.');
      return true;
    } catch (err) {
      console.error('[Firebase] Error in atomicDeleteFolderAndRelocatePrompts:', err);
      return false;
    }
  };

  const handleConfirmDeleteAllFolderAndPrompts = async (
    folderId: string,
    affectedPrompts: PromptItem[]
  ): Promise<boolean> => {
    try {
      await atomicDeleteFolderAndAllPrompts(folderId, affectedPrompts);
      const deletedIds = new Set(affectedPrompts.map((p) => p.id));
      // Sync local state immediately
      setPrompts((prev) => prev.filter((p) => !deletedIds.has(p.id)));
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (filters.folderId === folderId) {
        handleFilterChange((prev) => ({ ...prev, folderId: 'all' }));
      }
      if (selectedDetailPrompt && deletedIds.has(selectedDetailPrompt.id)) {
        setSelectedDetailPrompt(null);
      }
      setDeletingFolder(null);
      showToast('Folder berhasil dihapus.');
      return true;
    } catch (err) {
      console.error('[Firebase] Error in atomicDeleteFolderAndAllPrompts:', err);
      return false;
    }
  };

  const handleConfirmDeleteEmptyFolder = async (folderId: string): Promise<boolean> => {
    try {
      await atomicDeleteEmptyFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (filters.folderId === folderId) {
        handleFilterChange((prev) => ({ ...prev, folderId: 'all' }));
      }
      setDeletingFolder(null);
      showToast('Folder berhasil dihapus.');
      return true;
    } catch (err) {
      console.error('[Firebase] Error in atomicDeleteEmptyFolder:', err);
      return false;
    }
  };

  // Full-State Atomic Restore Execution
  const handleExecuteRestore = async (
    stagedFolders: FolderItem[],
    stagedPrompts: PromptItem[],
    stagedSettings: AppSettings,
    mode: RestoreMode
  ) => {
    // 1. Commit batch changes to Firebase
    await restoreFullStateToFirebase(
      stagedFolders,
      stagedPrompts,
      stagedSettings,
      mode,
      prompts,
      folders
    );

    // 2. Update local state
    setPrompts(stagedPrompts);
    setFolders(stagedFolders);
    setAppSettings(stagedSettings);

    // 3. Reset filter view if active folder was deleted
    handleFilterChange((prev) => ({
      ...prev,
      folderId: 'all',
      searchQuery: '',
    }));
  };

  // Rollback to Pre-Restore Snapshot
  const handleRollbackSnapshot = async (snapshot: PreRestoreSnapshot) => {
    await restoreFullStateToFirebase(
      snapshot.folders,
      snapshot.prompts,
      snapshot.settings,
      'replace',
      prompts,
      folders
    );

    setPrompts(snapshot.prompts);
    setFolders(snapshot.folders);
    setAppSettings(snapshot.settings);

    handleFilterChange((prev) => ({
      ...prev,
      folderId: 'all',
      searchQuery: '',
    }));
  };

  // 3. Splash Loading Screen before restoring Firebase config (prevents UI flicker)
  if (isFirebaseConnecting || !isSettingsRestored) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 space-y-6 select-none">
        <div className="relative">
          <img
            src={appLogo}
            alt="PromptVault Logo"
            className="w-16 h-16 rounded-2xl object-contain shadow-2xl shadow-indigo-500/40 animate-pulse"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = './icons/icon-192.png';
            }}
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white animate-spin" />
          </div>
        </div>

        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-lg font-bold text-slate-100 tracking-tight flex items-center justify-center gap-2">
            PromptVault
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
              Firebase Firestore
            </span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Menghubungkan ke Cloud Firestore & memulihkan pengaturan terakhir...
          </p>
        </div>

        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse"></div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Database className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>Path: app/settings/current/main</span>
        </div>
      </div>
    );
  }

  // App-Wide Vault Access Key Gate Protection is removed in v2.1
  // The app always opens directly without any app-level lock screen.

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl border border-indigo-400/30 flex items-center gap-2.5 text-xs font-semibold animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Navbar */}
      <Navbar
        filters={filters}
        setFilters={handleFilterChange}
        onOpenNewPromptModal={() => {
          setEditingPrompt(null);
          setIsFormModalOpen(true);
        }}
        onOpenNewFolderModal={() => {
          setEditingFolder(null);
          setIsFolderModalOpen(true);
        }}
        onOpenAIAssistantModal={() => setIsAIAssistantModalOpen(true)}
        onOpenExportImportModal={() => setIsExportImportModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        totalPromptsCount={prompts.length}
        theme={appSettings.theme || 'dark'}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Left Sidebar Filter Navigation */}
        <Sidebar
          prompts={prompts}
          folders={folders}
          filters={filters}
          setFilters={handleFilterChange}
          onOpenNewFolderModal={() => {
            setEditingFolder(null);
            setIsFolderModalOpen(true);
          }}
          onEditFolder={(f) => {
            setEditingFolder(f);
            setIsFolderModalOpen(true);
          }}
          onDeleteFolder={handleDeleteFolder}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        />

        {/* Center Main Workspace Content Area */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 py-3 sm:py-6 space-y-4 sm:space-y-5">

          {/* Top Sort & Filter Bar */}
          <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
              {filters.onlyFavorites && filters.folderId === 'all' ? (
                <>
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                  <span>
                    Prompt Favorit:{' '}
                    <strong className="text-slate-100 font-bold">{filteredAndSortedPrompts.length}</strong>{' '}
                    <span className="hidden xs:inline">Prompt</span>
                  </span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Menampilkan{' '}
                    <strong className="text-slate-100 font-bold">{filteredAndSortedPrompts.length}</strong> dari{' '}
                    {prompts.length} <span className="hidden xs:inline">Prompt</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Firebase Live Status Badge */}
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400">
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Firebase Realtime Sync</span>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
                <span className="text-slate-400 hidden sm:inline">Urutkan:</span>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    handleFilterChange((prev) => ({
                      ...prev,
                      sortBy: e.target.value as SortOption,
                    }))
                  }
                  className="bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl px-2.5 sm:px-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium min-h-[38px]"
                  id="sort-select-dropdown"
                >
                  <option value="newest">Terbaru</option>
                  <option value="oldest">Terlama</option>
                  <option value="title">Nama (A-Z)</option>
                  <option value="favorites">Utamakan Favorit</option>
                  <option value="most_used">Paling Sering Digunakan</option>
                  <option value="last_used">Terakhir Digunakan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Prompts Display View Layout */}
          {filteredAndSortedPrompts.length === 0 ? (
            filters.onlyFavorites ? (
              /* Informative Empty State for Favorites */
              <div className="bg-slate-900/40 border border-amber-500/20 border-dashed rounded-3xl p-10 sm:p-12 text-center space-y-4 max-w-md mx-auto my-12 animate-fade-in shadow-xl shadow-amber-950/10">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
                  <Star className="w-8 h-8 fill-amber-400/20" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-100">
                    Belum Ada Prompt Favorit
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Tandai prompt terbaik Anda dengan ikon bintang (⭐) agar dapat diakses dengan cepat kapan saja di halaman favorit ini.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterChange((prev) => ({
                        ...prev,
                        folderId: 'all',
                        onlyFavorites: false,
                        contentType: 'image',
                        searchQuery: '',
                        tag: 'all',
                      }))
                    }
                    className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 hover:text-purple-300 text-slate-200 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                    id="empty-fav-view-images-btn"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>Lihat Prompt Gambar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterChange((prev) => ({
                        ...prev,
                        folderId: 'all',
                        onlyFavorites: false,
                        contentType: 'text',
                        searchQuery: '',
                        tag: 'all',
                      }))
                    }
                    className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 hover:text-indigo-300 text-slate-200 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                    id="empty-fav-view-texts-btn"
                  >
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Lihat Prompt Teks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrompt(null);
                      setIsFormModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                    id="empty-fav-create-btn"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Prompt Baru</span>
                  </button>
                </div>
              </div>
            ) : (
              /* General Search / Filter Empty State */
              <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-3xl p-12 text-center space-y-4 max-w-md mx-auto my-12">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-400">
                  <SearchX className="w-8 h-8 text-indigo-400" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-200">
                    Tidak ada prompt yang sesuai
                  </h3>
                  <p className="text-xs text-slate-400">
                    Coba ubah kata kunci pencarian atau reset filter kategori, folder, dan tag Anda.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() =>
                      handleFilterChange((prev) => ({
                        ...prev,
                        searchQuery: '',
                        category: 'all',
                        folderId: 'all',
                        targetAI: 'all',
                        tag: 'all',
                        onlyFavorites: true,
                        contentType: 'all',
                      }))
                    }
                    className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700"
                  >
                    Kembali ke Favorit
                  </button>
                  <button
                    onClick={() => {
                      setEditingPrompt(null);
                      setIsFormModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Prompt Baru</span>
                  </button>
                </div>
              </div>
            )
          ) : filters.viewMode === 'grid' ? (
            /* Clean Responsive Grid View (3 to 4 columns on desktop) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
              {filteredAndSortedPrompts.map((p) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  folders={folders}
                  onSelectPrompt={(prompt) => setSelectedDetailPrompt(prompt)}
                  onToggleFavorite={handleToggleFavorite}
                  onCopyPrompt={handleCopyPrompt}
                  onEditPrompt={(prompt) => {
                    setEditingPrompt(prompt);
                    setIsFormModalOpen(true);
                  }}
                  onDuplicatePrompt={handleDuplicatePrompt}
                  onDeletePrompt={handleDeletePrompt}
                  onFillVariables={(prompt) => setVariableFillerPrompt(prompt)}
                  onViewImageLightbox={(imgUrl) => setLightboxImageUrl(imgUrl)}
                  hideImage={filters.contentType === 'text'}
                  hideFolderBadge={isInsideSpecificFolder}
                />
              ))}
            </div>
          ) : filters.viewMode === 'list' ? (
            /* List View */
            <div className="space-y-3">
              {filteredAndSortedPrompts.map((p) => (
                <PromptListItem
                  key={p.id}
                  prompt={p}
                  folders={folders}
                  onSelectPrompt={(prompt) => setSelectedDetailPrompt(prompt)}
                  onToggleFavorite={handleToggleFavorite}
                  onCopyPrompt={handleCopyPrompt}
                  onEditPrompt={(prompt) => {
                    setEditingPrompt(prompt);
                    setIsFormModalOpen(true);
                  }}
                  onDuplicatePrompt={handleDuplicatePrompt}
                  onDeletePrompt={handleDeletePrompt}
                  onFillVariables={(prompt) => setVariableFillerPrompt(prompt)}
                  onViewImageLightbox={(imgUrl) => setLightboxImageUrl(imgUrl)}
                  hideImage={filters.contentType === 'text'}
                  hideFolderBadge={isInsideSpecificFolder}
                />
              ))}
            </div>
          ) : (
            /* Compact Table View */
            <PromptCompactTable
              prompts={filteredAndSortedPrompts}
              folders={folders}
              onSelectPrompt={(prompt) => setSelectedDetailPrompt(prompt)}
              onToggleFavorite={handleToggleFavorite}
              onCopyPrompt={handleCopyPrompt}
              onEditPrompt={(prompt) => {
                setEditingPrompt(prompt);
                setIsFormModalOpen(true);
              }}
              onDuplicatePrompt={handleDuplicatePrompt}
              onDeletePrompt={handleDeletePrompt}
              onFillVariables={(prompt) => setVariableFillerPrompt(prompt)}
              onViewImageLightbox={(imgUrl) => setLightboxImageUrl(imgUrl)}
              hideImageColumn={filters.contentType === 'text'}
              hideFolderColumn={isInsideSpecificFolder}
            />
          )}
        </main>
      </div>

      {/* Modal Dialogs */}
      {selectedDetailPrompt && (
        <PromptDetailModal
          prompt={selectedDetailPrompt}
          folders={folders}
          onClose={() => setSelectedDetailPrompt(null)}
          onEditPrompt={(prompt) => {
            setSelectedDetailPrompt(null);
            setEditingPrompt(prompt);
            setIsFormModalOpen(true);
          }}
          onToggleFavorite={(id) => handleToggleFavorite(id)}
          onRestoreVersion={handleRestoreVersion}
          onUpdateImages={async (promptId, newImages) => {
            const targetPrompt = prompts.find((p) => p.id === promptId);
            if (targetPrompt) {
              const updated = { ...targetPrompt, images: newImages, updatedAt: new Date().toISOString() };
              await savePromptToFirebase(updated);
            }
          }}
          onViewImageLightbox={(imgUrl) => setLightboxImageUrl(imgUrl)}
          onTrackUsage={handleTrackPromptUsage}
        />
      )}

      {isFormModalOpen && (
        <PromptFormModal
          initialPrompt={editingPrompt}
          folders={folders}
          prompts={prompts}
          tagsList={tagsList}
          onCreateTag={handleCreateTag}
          defaultFolderId={
            filters.folderId && filters.folderId !== 'all' && filters.folderId !== 'unorganized'
              ? filters.folderId
              : null
          }
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingPrompt(null);
          }}
          onSave={handleSavePrompt}
        />
      )}

      {isFolderModalOpen && (
        <FolderModal
          initialFolder={editingFolder}
          onClose={() => {
            setIsFolderModalOpen(false);
            setEditingFolder(null);
          }}
          onSave={handleSaveFolder}
        />
      )}

      {isAIAssistantModalOpen && (
        <AIAssistantModal
          onClose={() => setIsAIAssistantModalOpen(false)}
          onSaveNewPrompt={(promptData) => handleSavePrompt(promptData, 'Dibuat dengan AI Assistant')}
        />
      )}

      {variableFillerPrompt && (
        <VariableFillerModal
          prompt={variableFillerPrompt}
          onClose={() => setVariableFillerPrompt(null)}
          onTrackUsage={handleTrackPromptUsage}
        />
      )}

      {isExportImportModalOpen && (
        <ExportImportModal
          prompts={prompts}
          folders={folders}
          appSettings={appSettings}
          onClose={() => setIsExportImportModalOpen(false)}
          onExecuteRestore={handleExecuteRestore}
          onRollbackSnapshot={handleRollbackSnapshot}
          showToast={showToast}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          settings={appSettings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSettingsModalOpen(false)}
          isFirebaseConnected={isFirebaseConnected}
          onRetryFirebase={() => {
            fetchSettingsFromFirebase().then((st) => setAppSettings(st));
          }}
        />
      )}

      {lightboxImageUrl && (
        <ImageLightboxModal
          imageUrl={lightboxImageUrl}
          onClose={() => setLightboxImageUrl(null)}
        />
      )}

      {deletingFolder && (
        <DeleteFolderModal
          folder={deletingFolder}
          folders={folders}
          prompts={prompts}
          onClose={() => setDeletingFolder(null)}
          onConfirmRelocateAndDelete={handleConfirmRelocateAndDeleteFolder}
          onConfirmDeleteAll={handleConfirmDeleteAllFolderAndPrompts}
          onConfirmDeleteEmpty={handleConfirmDeleteEmptyFolder}
        />
      )}

      {/* PWA Background Update Toast */}
      <PWAUpdateToast onDismiss={() => {}} />
    </div>
  );
}
