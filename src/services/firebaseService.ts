import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FolderItem, PromptItem } from '../types';
import { compressBase64Image, sortFoldersByName } from '../utils/storage';

/**
 * Strips all `undefined` values recursively from payloads before sending to Firestore
 * to prevent 'Unsupported field value: undefined' errors.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      typeof (value as any).isEqual !== 'function' // preserve FieldValue like deleteField() or serverTimestamp()
    ) {
      clean[key] = sanitizeFirestorePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export interface AppSecuritySettings {
  isGlobalAppLockEnabled?: boolean; // Global toggle: true = active security/gate, false = bypass/no lock
  isVaultAccessKeyEnabled?: boolean;
  vaultAccessKeyHash?: string;
  vaultAccessKeySalt?: string;
  accessKeyHint?: string;
  isMasterPinSet?: boolean;
  masterPinHash?: string;
  masterPinSalt?: string;
  autoLockDuration?: 'immediate' | 'refresh' | '1min' | '5min' | '15min' | '30min' | 'unload';
  updatedAt?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  activeTab: string; // 'all', 'favorites', or folderId
  viewMode: 'grid' | 'list' | 'compact';
  sortBy: 'updatedAt' | 'title' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  searchQuery: string;
  sidebarCollapsed: boolean;
  filters: {
    category: string;
    targetAI: string;
    folderId: string | null;
    isFavoriteOnly: boolean;
  };
  aiSettings: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    autoOptimize: boolean;
  };
  panelSizes: {
    sidebarWidth: number;
    detailWidth: number;
  };
  preferences: {
    autoCopyOnSelect: boolean;
    confirmBeforeDelete: boolean;
    defaultTargetAI: string;
    defaultCategory: string;
    compactDensity: 'comfortable' | 'compact' | 'spacious';
    fontScale: number;
    showVariableHelper: boolean;
    showTagsInGrid: boolean;
    showImagePreviews: boolean;
    cropAspect: string;
    exportFormat: string;
    uploadMaxSizeMB: number;
    printHeader: boolean;
    autoLockDuration?: 'refresh' | '1min' | '5min' | '15min' | '30min' | 'unload';
  };
  security?: AppSecuritySettings;
  gallerySettings: {
    gridColumns: number;
    cardStyle: 'bordered' | 'glass' | 'flat';
  };
  workspaceRevision?: number;
  lastPage: string;
  updatedAt?: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  activeTab: 'all',
  viewMode: 'grid',
  sortBy: 'updatedAt',
  sortDirection: 'desc',
  searchQuery: '',
  sidebarCollapsed: false,
  workspaceRevision: 1,
  filters: {
    category: 'all',
    targetAI: 'all',
    folderId: null,
    isFavoriteOnly: false,
  },
  aiSettings: {
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'Anda adalah pakar prompt engineering profesional.',
    autoOptimize: true,
  },
  panelSizes: {
    sidebarWidth: 280,
    detailWidth: 420,
  },
  preferences: {
    autoCopyOnSelect: false,
    confirmBeforeDelete: true,
    defaultTargetAI: 'ChatGPT',
    defaultCategory: 'Umum',
    compactDensity: 'comfortable',
    fontScale: 100,
    showVariableHelper: true,
    showTagsInGrid: true,
    showImagePreviews: true,
    cropAspect: 'free',
    exportFormat: 'json',
    uploadMaxSizeMB: 5,
    printHeader: true,
    autoLockDuration: 'refresh',
  },
  gallerySettings: {
    gridColumns: 3,
    cardStyle: 'bordered',
  },
  security: {
    isGlobalAppLockEnabled: true,
    isVaultAccessKeyEnabled: false,
    vaultAccessKeyHash: '',
    vaultAccessKeySalt: '',
    accessKeyHint: '',
    isMasterPinSet: false,
    masterPinHash: '',
    masterPinSalt: '',
    autoLockDuration: '5min',
  },
  lastPage: 'vault',
};

// Firestore Settings Doc Reference: app -> settings -> current -> main
const SETTINGS_DOC_PATH = ['app', 'settings', 'current', 'main'] as const;

export function getSettingsDocRef() {
  return doc(db, SETTINGS_DOC_PATH[0], SETTINGS_DOC_PATH[1], SETTINGS_DOC_PATH[2], SETTINGS_DOC_PATH[3]);
}

// Debounce timer for automatic settings persistence
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Save settings to Firebase with merge option
export function saveSettingsToFirebase(settingsPartial: Partial<AppSettings>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (saveTimer) clearTimeout(saveTimer);

    saveTimer = setTimeout(async () => {
      try {
        const settingsRef = getSettingsDocRef();
        const rawPayload = {
          ...settingsPartial,
          updatedAt: new Date().toISOString(),
          firestoreTimestamp: serverTimestamp(),
        };
        const cleanPayload = sanitizeFirestorePayload(rawPayload);

        console.log('[Firebase] Auto-saving settings to Firebase app/settings/current/main:', cleanPayload);
        await setDoc(settingsRef, cleanPayload, { merge: true });
        console.log('[Firebase] Settings successfully saved.');
        resolve();
      } catch (err) {
        console.error('[Firebase] Failed to auto-save settings to Firebase:', err);
        reject(err);
      }
    }, 350); // 350ms debounce
  });
}

// Restore / Fetch settings once from Firebase
export async function fetchSettingsFromFirebase(): Promise<AppSettings> {
  try {
    const settingsRef = getSettingsDocRef();
    const snapshot = await getDoc(settingsRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      console.log('[Firebase] Restored settings from Firebase:', data);
      return mergeDeepSettings(DEFAULT_APP_SETTINGS, data);
    } else {
      console.log('[Firebase] No settings document found. Initializing app/settings/current/main with defaults...');
      await setDoc(settingsRef, {
        ...DEFAULT_APP_SETTINGS,
        updatedAt: new Date().toISOString(),
        firestoreTimestamp: serverTimestamp(),
      });
      return DEFAULT_APP_SETTINGS;
    }
  } catch (err) {
    console.error('[Firebase] Error fetching settings from Firebase:', err);
    return DEFAULT_APP_SETTINGS;
  }
}

// Deep merge helper for restoring partial settings safely
function mergeDeepSettings(defaultObj: any, incomingObj: any): any {
  if (!incomingObj) return defaultObj;
  const result = { ...defaultObj };

  for (const key of Object.keys(incomingObj)) {
    if (
      incomingObj[key] !== null &&
      typeof incomingObj[key] === 'object' &&
      !Array.isArray(incomingObj[key]) &&
      key in defaultObj
    ) {
      result[key] = mergeDeepSettings(defaultObj[key], incomingObj[key]);
    } else if (incomingObj[key] !== undefined) {
      result[key] = incomingObj[key];
    }
  }
  return result;
}

// Subscribe to Realtime Settings changes
export function subscribeToSettings(onUpdate: (settings: AppSettings) => void, onError?: (err: Error) => void) {
  const settingsRef = getSettingsDocRef();
  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const merged = mergeDeepSettings(DEFAULT_APP_SETTINGS, data);
        onUpdate(merged);
      }
    },
    (err) => {
      console.error('[Firebase] Settings snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

// Subscribe to Realtime Prompts
export function subscribeToPrompts(onUpdate: (prompts: PromptItem[]) => void, onError?: (err: Error) => void) {
  const promptsCol = collection(db, 'prompts');
  return onSnapshot(
    promptsCol,
    (snapshot) => {
      const list: PromptItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || '',
          promptText: data.promptText || '',
          targetAI: data.targetAI || 'Gemini',
          category: data.category || 'Umum',
          folderId: data.folderId || null,
          description: data.description || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          images: Array.isArray(data.images) ? data.images : [],
          isFavorite: Boolean(data.isFavorite),
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          variables: Array.isArray(data.variables) ? data.variables : [],
          versionHistory: Array.isArray(data.versionHistory) ? data.versionHistory : [],
          usageCount: typeof data.usageCount === 'number' ? data.usageCount : 0,
          lastUsedAt: data.lastUsedAt || undefined,
        });
      });
      // Sort by updatedAt desc
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (err) => {
      console.error('[Firebase] Prompts snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

// Subscribe to Realtime Folders
export function subscribeToFolders(onUpdate: (folders: FolderItem[]) => void, onError?: (err: Error) => void) {
  const foldersCol = collection(db, 'folders');
  return onSnapshot(
    foldersCol,
    (snapshot) => {
      const list: FolderItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          color: data.color || 'indigo',
          description: data.description || '',
          createdAt: data.createdAt || new Date().toISOString(),
          isLocked: Boolean(data.isLocked),
          keyHash: data.keyHash || undefined,
          keySalt: data.keySalt || undefined,
          lockType: data.lockType || undefined,
        });
      });
      // Sort automatically by name (natural numeric order for numbers 01, 02.. and A-Z for text)
      const sortedList = sortFoldersByName(list);
      onUpdate(sortedList);
    },
    (err) => {
      console.error('[Firebase] Folders snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

// Prompt CRUD
export async function savePromptToFirebase(prompt: PromptItem): Promise<void> {
  let optimizedPrompt: PromptItem = { ...prompt };

  // 1. Compress base64 images if any are present
  if (Array.isArray(optimizedPrompt.images) && optimizedPrompt.images.length > 0) {
    const compressedImages = await Promise.all(
      optimizedPrompt.images.map((img) => compressBase64Image(img, 800, 800, 0.7))
    );
    optimizedPrompt.images = compressedImages;
  }

  // 2. Cap versionHistory to latest 20 items to prevent document bloat
  if (Array.isArray(optimizedPrompt.versionHistory) && optimizedPrompt.versionHistory.length > 20) {
    optimizedPrompt.versionHistory = optimizedPrompt.versionHistory.slice(0, 20);
  }

  // 3. Size safeguard: If document size is still > 850KB, aggressively compress images
  let jsonString = JSON.stringify(optimizedPrompt);
  if (jsonString.length > 850000) {
    console.warn(`[Firebase] Document size for prompt ${prompt.id} is ${jsonString.length} bytes. Applying extra compression...`);
    if (optimizedPrompt.images && optimizedPrompt.images.length > 0) {
      const recompressed = await Promise.all(
        optimizedPrompt.images.map((img) => compressBase64Image(img, 400, 400, 0.5))
      );
      optimizedPrompt.images = recompressed;
    }
    if (optimizedPrompt.versionHistory && optimizedPrompt.versionHistory.length > 5) {
      optimizedPrompt.versionHistory = optimizedPrompt.versionHistory.slice(0, 5);
    }
  }

  const promptRef = doc(db, 'prompts', prompt.id);
  const cleanPrompt = sanitizeFirestorePayload(optimizedPrompt);
  await setDoc(promptRef, cleanPrompt, { merge: true });
}

export async function updatePromptUsageInFirebase(promptId: string, usageCount: number, lastUsedAt: string): Promise<void> {
  const promptRef = doc(db, 'prompts', promptId);
  await updateDoc(promptRef, {
    usageCount,
    lastUsedAt,
  });
}

export async function deletePromptFromFirebase(promptId: string): Promise<void> {
  const promptRef = doc(db, 'prompts', promptId);
  await deleteDoc(promptRef);
}

// Folder CRUD
export async function saveFolderToFirebase(folder: FolderItem): Promise<void> {
  const folderRef = doc(db, 'folders', folder.id);

  const payload: Record<string, any> = {
    name: folder.name || '',
    color: folder.color || 'indigo',
    description: folder.description || '',
    createdAt: folder.createdAt || new Date().toISOString(),
    isLocked: Boolean(folder.isLocked),
  };

  if (folder.isLocked) {
    if (folder.keyHash) payload.keyHash = folder.keyHash;
    if (folder.keySalt) payload.keySalt = folder.keySalt;
    if (folder.lockType) payload.lockType = folder.lockType || 'key';
  } else {
    // When unlocking/removing lock, safely remove credential fields in Firestore using deleteField()
    payload.keyHash = deleteField();
    payload.keySalt = deleteField();
    payload.lockType = deleteField();
  }

  const cleanPayload = sanitizeFirestorePayload(payload);
  await setDoc(folderRef, cleanPayload, { merge: true });
}

export async function deleteFolderFromFirebase(folderId: string): Promise<void> {
  const folderRef = doc(db, 'folders', folderId);
  await deleteDoc(folderRef);
}

/**
 * Atomic ALL-OR-NOTHING: Relocate prompts to a target folder (or null for root) and delete the folder.
 */
export async function atomicDeleteFolderAndRelocatePrompts(
  folderId: string,
  targetFolderId: string | null,
  promptsToRelocate: PromptItem[]
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Update all prompts currently referencing this folderId
  for (const prompt of promptsToRelocate) {
    const promptRef = doc(db, 'prompts', prompt.id);
    batch.update(promptRef, {
      folderId: targetFolderId,
      updatedAt: new Date().toISOString(),
    });
  }

  // 2. Delete folder doc
  const folderRef = doc(db, 'folders', folderId);
  batch.delete(folderRef);

  // 3. Commit atomically
  await batch.commit();
}

/**
 * Atomic ALL-OR-NOTHING: Delete all prompts inside the folder and delete the folder document.
 */
export async function atomicDeleteFolderAndAllPrompts(
  folderId: string,
  promptsToDelete: PromptItem[]
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Delete all prompts belonging to this folder
  for (const prompt of promptsToDelete) {
    const promptRef = doc(db, 'prompts', prompt.id);
    batch.delete(promptRef);
  }

  // 2. Delete folder doc
  const folderRef = doc(db, 'folders', folderId);
  batch.delete(folderRef);

  // 3. Commit atomically
  await batch.commit();
}

/**
 * Delete empty folder directly from Firebase
 */
export async function atomicDeleteEmptyFolder(folderId: string): Promise<void> {
  const folderRef = doc(db, 'folders', folderId);
  await deleteDoc(folderRef);
}

/**
 * Authoritatively fetch full current state from Firebase
 */
export async function fetchFullAuthorizedState(): Promise<{
  prompts: PromptItem[];
  folders: FolderItem[];
  settings: AppSettings;
}> {
  const settings = await fetchSettingsFromFirebase();

  const promptsSnap = await getDocs(collection(db, 'prompts'));
  const prompts: PromptItem[] = [];
  promptsSnap.forEach((d) => {
    const data = d.data();
    prompts.push({
      id: d.id,
      title: data.title || '',
      promptText: data.promptText || '',
      targetAI: data.targetAI || 'Gemini',
      category: data.category || 'Umum',
      folderId: data.folderId || null,
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      images: Array.isArray(data.images) ? data.images : [],
      isFavorite: Boolean(data.isFavorite),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      variables: Array.isArray(data.variables) ? data.variables : [],
      versionHistory: Array.isArray(data.versionHistory) ? data.versionHistory : [],
    });
  });

  const foldersSnap = await getDocs(collection(db, 'folders'));
  const folders: FolderItem[] = [];
  foldersSnap.forEach((d) => {
    const data = d.data();
    folders.push({
      id: d.id,
      name: data.name || '',
      color: data.color || 'indigo',
      description: data.description || '',
      createdAt: data.createdAt || new Date().toISOString(),
      isLocked: Boolean(data.isLocked),
      keyHash: data.keyHash || undefined,
      keySalt: data.keySalt || undefined,
      lockType: data.lockType || undefined,
    });
  });

  return {
    prompts: prompts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    folders: sortFoldersByName(folders),
    settings,
  };
}

/**
 * Atomic Full-State Restore to Firebase Firestore
 * Uses WriteBatch chunks (under 400 ops per batch) to guarantee all-or-nothing execution,
 * delete obsolete items if in 'replace' mode, write all folders, write all prompts,
 * and bump workspaceRevision.
 */
export async function restoreFullStateToFirebase(
  stagedFolders: FolderItem[],
  stagedPrompts: PromptItem[],
  stagedSettings: AppSettings,
  mode: 'replace' | 'merge',
  existingPrompts: PromptItem[],
  existingFolders: FolderItem[]
): Promise<void> {
  console.log(`[Firebase Restore] Starting atomic restore in mode '${mode}'...`);

  // Step 1: Pre-process and optimize images in staged prompts
  const optimizedPrompts: PromptItem[] = await Promise.all(
    stagedPrompts.map(async (prompt) => {
      let opt = { ...prompt };
      if (Array.isArray(opt.images) && opt.images.length > 0) {
        opt.images = await Promise.all(
          opt.images.map((img) => compressBase64Image(img, 800, 800, 0.7))
        );
      }
      return opt;
    })
  );

  // Step 2: Determine operations to perform
  const stagedFolderIds = new Set(stagedFolders.map((f) => f.id));
  const stagedPromptIds = new Set(optimizedPrompts.map((p) => p.id));

  const operations: Array<{
    type: 'set' | 'delete';
    ref: any;
    payload?: any;
  }> = [];

  // If mode is REPLACE, delete documents that are in Firestore but NOT in the backup
  if (mode === 'replace') {
    existingFolders.forEach((ef) => {
      if (!stagedFolderIds.has(ef.id)) {
        operations.push({
          type: 'delete',
          ref: doc(db, 'folders', ef.id),
        });
      }
    });

    existingPrompts.forEach((ep) => {
      if (!stagedPromptIds.has(ep.id)) {
        operations.push({
          type: 'delete',
          ref: doc(db, 'prompts', ep.id),
        });
      }
    });
  }

  // Write all folders
  stagedFolders.forEach((folder) => {
    const payload: Record<string, any> = {
      name: folder.name || '',
      color: folder.color || 'indigo',
      description: folder.description || '',
      createdAt: folder.createdAt || new Date().toISOString(),
      isLocked: Boolean(folder.isLocked),
    };
    if (folder.isLocked) {
      if (folder.keyHash) payload.keyHash = folder.keyHash;
      if (folder.keySalt) payload.keySalt = folder.keySalt;
      if (folder.lockType) payload.lockType = folder.lockType || 'key';
    } else {
      payload.keyHash = deleteField();
      payload.keySalt = deleteField();
      payload.lockType = deleteField();
    }
    operations.push({
      type: 'set',
      ref: doc(db, 'folders', folder.id),
      payload: sanitizeFirestorePayload(payload),
    });
  });

  // Write all prompts
  optimizedPrompts.forEach((prompt) => {
    operations.push({
      type: 'set',
      ref: doc(db, 'prompts', prompt.id),
      payload: sanitizeFirestorePayload(prompt),
    });
  });

  // Write updated Settings with incremented workspace revision
  const newRevision = (stagedSettings.workspaceRevision || 1) + 1;
  const settingsPayload = sanitizeFirestorePayload({
    ...stagedSettings,
    workspaceRevision: newRevision,
    updatedAt: new Date().toISOString(),
    firestoreTimestamp: serverTimestamp(),
  });

  operations.push({
    type: 'set',
    ref: getSettingsDocRef(),
    payload: settingsPayload,
  });

  // Step 3: Execute in chunked writeBatch (up to 300 operations per batch)
  const BATCH_SIZE = 300;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const chunk = operations.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.type === 'set') {
        batch.set(op.ref, op.payload, { merge: true });
      }
    }

    console.log(`[Firebase Restore] Committing batch chunk ${i / BATCH_SIZE + 1} (${chunk.length} ops)...`);
    await batch.commit();
  }

  console.log(`[Firebase Restore] All ${operations.length} operations successfully committed to Firebase.`);
}

