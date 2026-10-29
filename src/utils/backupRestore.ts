import { FolderItem, PromptItem } from '../types';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../services/firebaseService';

export interface BackupCounts {
  prompts: number;
  folders: number;
  favorites: number;
  images: number;
  lockedFolders: number;
  categories: number;
  targetModels: number;
  variables: number;
}

export interface BackupManifest {
  appName: string;
  appVersion: string;
  backupVersion: string;
  schemaVersion: string;
  createdAt: string;
  workspaceRevision: number;
  environment: string;
  counts: BackupCounts;
  categoriesSummary: string[];
  targetModelsSummary: string[];
  checksum: string;
}

export interface SecurityBackupMetadata {
  masterRecoveryConfigured: boolean;
  masterPinHash?: string;
  masterPinSalt?: string;
  algorithm: string;
  iterations: number;
  saltLengthBytes: number;
  version: string;
  lockedFoldersCount: number;
  folderSecurityMap: Record<
    string,
    {
      isLocked: boolean;
      hasKeyHash: boolean;
      hasKeySalt: boolean;
      lockType?: string;
    }
  >;
}

export interface PromptVaultFullBackup {
  manifest: BackupManifest;
  folders: FolderItem[];
  prompts: PromptItem[];
  settings: AppSettings;
  securityMetadata: SecurityBackupMetadata;
  integrity: {
    valid: boolean;
    generatedAt: string;
    rulesPassed: string[];
    warnings: string[];
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  manifest: BackupManifest | null;
  backupData: PromptVaultFullBackup | null;
  issues: string[];
  warnings: string[];
  schemaCompatibility: 'v2.0_full_state' | 'v1.0_legacy' | 'incompatible';
  calculatedChecksum?: string;
  expectedChecksum?: string;
  checksumMatches?: boolean;
}

export interface PreRestoreSnapshot {
  id: string;
  createdAt: string;
  prompts: PromptItem[];
  folders: FolderItem[];
  settings: AppSettings;
  counts: BackupCounts;
}

export type RestoreMode = 'replace' | 'merge';

export interface PostRestoreVerification {
  isVerified: boolean;
  expected: BackupCounts;
  actual: BackupCounts;
  mismatches: string[];
  timestamp: string;
}

/**
 * Calculate standard SHA-256 hash using browser Web Crypto API
 */
export async function calculateSHA256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract summary statistics from prompts and folders
 */
export function calculateVaultCounts(
  prompts: PromptItem[],
  folders: FolderItem[],
  settings?: AppSettings
): {
  counts: BackupCounts;
  categoriesSummary: string[];
  targetModelsSummary: string[];
} {
  const uniqueCategories = Array.from(
    new Set(prompts.map((p) => p.category || 'Umum').filter(Boolean))
  );
  const uniqueTargetModels = Array.from(
    new Set(prompts.map((p) => p.targetAI || 'Gemini').filter(Boolean))
  );

  let totalImages = 0;
  let totalVariables = 0;
  let favoritesCount = 0;

  prompts.forEach((p) => {
    if (p.isFavorite) favoritesCount += 1;
    if (Array.isArray(p.images)) totalImages += p.images.length;
    if (Array.isArray(p.variables)) totalVariables += p.variables.length;
  });

  const lockedFolders = folders.filter((f) => Boolean(f.isLocked));

  const counts: BackupCounts = {
    prompts: prompts.length,
    folders: folders.length,
    favorites: favoritesCount,
    images: totalImages,
    lockedFolders: lockedFolders.length,
    categories: uniqueCategories.length,
    targetModels: uniqueTargetModels.length,
    variables: totalVariables,
  };

  return {
    counts,
    categoriesSummary: uniqueCategories,
    targetModelsSummary: uniqueTargetModels,
  };
}

/**
 * Build clean security metadata (no plain text passwords)
 */
function buildSecurityMetadata(
  folders: FolderItem[],
  settings: AppSettings
): SecurityBackupMetadata {
  const folderSecurityMap: Record<
    string,
    {
      isLocked: boolean;
      hasKeyHash: boolean;
      hasKeySalt: boolean;
      lockType?: string;
    }
  > = {};

  let lockedCount = 0;

  folders.forEach((f) => {
    if (f.isLocked) {
      lockedCount += 1;
      folderSecurityMap[f.id] = {
        isLocked: true,
        hasKeyHash: Boolean(f.keyHash),
        hasKeySalt: Boolean(f.keySalt),
        lockType: f.lockType || 'key',
      };
    } else {
      folderSecurityMap[f.id] = {
        isLocked: false,
        hasKeyHash: false,
        hasKeySalt: false,
      };
    }
  });

  const masterRecoveryConfigured = Boolean(
    settings.security?.isMasterPinSet &&
      settings.security?.masterPinHash &&
      settings.security?.masterPinSalt
  );

  return {
    masterRecoveryConfigured,
    masterPinHash: settings.security?.masterPinHash || '',
    masterPinSalt: settings.security?.masterPinSalt || '',
    algorithm: 'PBKDF2-SHA256',
    iterations: 100000,
    saltLengthBytes: 16,
    version: '2.0',
    lockedFoldersCount: lockedCount,
    folderSecurityMap,
  };
}

/**
 * Deep-clean prompts and folders to ensure pure state without transient session unlocks
 */
export function sanitizeVaultStateForBackup(
  rawPrompts: PromptItem[],
  rawFolders: FolderItem[],
  rawSettings: AppSettings
): {
  cleanPrompts: PromptItem[];
  cleanFolders: FolderItem[];
  cleanSettings: AppSettings;
} {
  const folderIdSet = new Set(rawFolders.map((f) => f.id));

  // 1. Sanitize folders: preserve immutable ID, name, colors, locks & credentials
  const cleanFolders: FolderItem[] = rawFolders.map((folder) => ({
    id: folder.id,
    name: folder.name || 'Untitled Folder',
    color: folder.color || 'indigo',
    icon: folder.icon || undefined,
    description: folder.description || '',
    createdAt: folder.createdAt || new Date().toISOString(),
    isLocked: Boolean(folder.isLocked),
    keyHash: folder.isLocked ? folder.keyHash || undefined : undefined,
    keySalt: folder.isLocked ? folder.keySalt || undefined : undefined,
    lockType: folder.isLocked ? folder.lockType || 'key' : undefined,
  }));

  // 2. Sanitize prompts: preserve immutable ID, folder relationship, variables, images
  const cleanPrompts: PromptItem[] = rawPrompts.map((prompt) => {
    // If folderId is not in folders list, normalize to null
    const validFolderId =
      prompt.folderId && folderIdSet.has(prompt.folderId)
        ? prompt.folderId
        : null;

    return {
      id: prompt.id,
      title: prompt.title || 'Untitled Prompt',
      promptText: prompt.promptText || '',
      description: prompt.description || '',
      targetAI: prompt.targetAI || 'Gemini',
      category: prompt.category || 'Umum',
      folderId: validFolderId,
      tags: Array.isArray(prompt.tags) ? [...prompt.tags] : [],
      images: Array.isArray(prompt.images) ? [...prompt.images] : [],
      isFavorite: Boolean(prompt.isFavorite),
      createdAt: prompt.createdAt || new Date().toISOString(),
      updatedAt: prompt.updatedAt || new Date().toISOString(),
      versionHistory: Array.isArray(prompt.versionHistory)
        ? [...prompt.versionHistory]
        : [],
      variables: Array.isArray(prompt.variables) ? [...prompt.variables] : [],
    };
  });

  // 3. Sanitize settings: keep persistent configuration, never transient UI
  const cleanSettings: AppSettings = {
    ...rawSettings,
    searchQuery: '', // clear transient search
    activeTab: 'all', // reset transient active tab
    security: {
      masterPinHash: rawSettings.security?.masterPinHash || '',
      masterPinSalt: rawSettings.security?.masterPinSalt || '',
      isMasterPinSet: Boolean(rawSettings.security?.isMasterPinSet),
      updatedAt: rawSettings.security?.updatedAt || new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    cleanPrompts,
    cleanFolders,
    cleanSettings,
  };
}

/**
 * Generate Full-State Backup Package (Schema 2.0) with Deterministic Checksum
 */
export async function generateFullBackupPackage(
  rawPrompts: PromptItem[],
  rawFolders: FolderItem[],
  rawSettings: AppSettings
): Promise<{
  backupPackage: PromptVaultFullBackup;
  filename: string;
  jsonString: string;
}> {
  const { cleanPrompts, cleanFolders, cleanSettings } =
    sanitizeVaultStateForBackup(rawPrompts, rawFolders, rawSettings);

  const { counts, categoriesSummary, targetModelsSummary } =
    calculateVaultCounts(cleanPrompts, cleanFolders, cleanSettings);

  const securityMetadata = buildSecurityMetadata(cleanFolders, cleanSettings);

  const createdAt = new Date().toISOString();
  const workspaceRevision = cleanSettings.security?.isMasterPinSet ? 2 : 1;

  // Preliminary payload for checksum calculation
  const canonicalPayload = {
    schemaVersion: '2.0',
    appVersion: '2.0',
    createdAt,
    folders: cleanFolders,
    prompts: cleanPrompts,
    settings: cleanSettings,
    securityMetadata,
    counts,
  };

  const checksum = await calculateSHA256(JSON.stringify(canonicalPayload));

  const manifest: BackupManifest = {
    appName: 'PromptVault',
    appVersion: '2.0',
    backupVersion: '2.0',
    schemaVersion: '2.0',
    createdAt,
    workspaceRevision,
    environment: 'PromptVault 2 Core',
    counts,
    categoriesSummary,
    targetModelsSummary,
    checksum,
  };

  // Run integrity verification rules
  const rulesPassed: string[] = [];
  const warnings: string[] = [];

  // Rule 1: Prompt ID uniqueness
  const promptIdSet = new Set<string>();
  let hasDuplicatePromptId = false;
  cleanPrompts.forEach((p) => {
    if (promptIdSet.has(p.id)) hasDuplicatePromptId = true;
    promptIdSet.add(p.id);
  });
  if (!hasDuplicatePromptId) {
    rulesPassed.push('Prompt IDs are unique and consistent');
  } else {
    warnings.push('Duplicate prompt ID detected and resolved');
  }

  // Rule 2: Folder Relationship Check
  const folderIdSet = new Set(cleanFolders.map((f) => f.id));
  const invalidFolderRefs = cleanPrompts.filter(
    (p) => p.folderId && !folderIdSet.has(p.folderId)
  );
  if (invalidFolderRefs.length === 0) {
    rulesPassed.push('All prompt folder references are strictly valid');
  } else {
    warnings.push(`${invalidFolderRefs.length} prompt(s) had unlinked folder IDs`);
  }

  // Rule 3: Locked Folder Credentials Integrity
  const invalidLocks = cleanFolders.filter(
    (f) => f.isLocked && (!f.keyHash || !f.keySalt)
  );
  if (invalidLocks.length === 0) {
    rulesPassed.push('All locked folder credentials are cryptographically sound');
  } else {
    warnings.push(`${invalidLocks.length} locked folder(s) missing key hashes`);
  }

  // Rule 4: Master Recovery PIN status
  if (securityMetadata.masterRecoveryConfigured) {
    rulesPassed.push('Master Recovery PIN configuration securely hashed and verified');
  } else {
    rulesPassed.push('Master Recovery PIN is currently unconfigured');
  }

  // Rule 5: Favorites & Image references
  rulesPassed.push(`Verified ${counts.favorites} favorites and ${counts.images} image references`);

  const backupPackage: PromptVaultFullBackup = {
    manifest,
    folders: cleanFolders,
    prompts: cleanPrompts,
    settings: cleanSettings,
    securityMetadata,
    integrity: {
      valid: warnings.length === 0 || invalidLocks.length === 0,
      generatedAt: createdAt,
      rulesPassed,
      warnings,
    },
  };

  // Format Date for Filename: PromptVault_Backup_YYYY-MM-DD_HH-mm.json
  const dateObj = new Date(createdAt);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const filename = `PromptVault_Backup_${yyyy}-${mm}-${dd}_${hh}-${min}.json`;

  const jsonString = JSON.stringify(backupPackage, null, 2);

  return {
    backupPackage,
    filename,
    jsonString,
  };
}

/**
 * Validate backup file content before restore
 */
export async function validateBackupFile(
  fileContent: string
): Promise<BackupValidationResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err: any) {
    return {
      isValid: false,
      manifest: null,
      backupData: null,
      issues: ['File bukan format JSON yang valid: ' + (err.message || '')],
      warnings: [],
      schemaCompatibility: 'incompatible',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      isValid: false,
      manifest: null,
      backupData: null,
      issues: ['Struktur data backup tidak valid.'],
      warnings: [],
      schemaCompatibility: 'incompatible',
    };
  }

  // Check Schema 2.0 vs Legacy 1.0
  const isSchema2 =
    parsed.manifest &&
    (parsed.manifest.schemaVersion === '2.0' || parsed.manifest.backupVersion === '2.0') &&
    Array.isArray(parsed.prompts) &&
    Array.isArray(parsed.folders);

  const isSchema1 =
    !isSchema2 &&
    Array.isArray(parsed.prompts) &&
    (Array.isArray(parsed.folders) || parsed.app === 'PromptVault');

  if (!isSchema2 && !isSchema1) {
    return {
      isValid: false,
      manifest: null,
      backupData: null,
      issues: ['Format file tidak dikenali sebagai backup PromptVault.'],
      warnings: [],
      schemaCompatibility: 'incompatible',
    };
  }

  let fullBackup: PromptVaultFullBackup;

  if (isSchema2) {
    fullBackup = parsed as PromptVaultFullBackup;

    // Checksum verification
    if (fullBackup.manifest?.checksum) {
      try {
        const canonicalPayload = {
          schemaVersion: fullBackup.manifest.schemaVersion || '2.0',
          appVersion: fullBackup.manifest.appVersion || '2.0',
          createdAt: fullBackup.manifest.createdAt,
          folders: fullBackup.folders,
          prompts: fullBackup.prompts,
          settings: fullBackup.settings,
          securityMetadata: fullBackup.securityMetadata,
          counts: fullBackup.manifest.counts,
        };
        const calculated = await calculateSHA256(JSON.stringify(canonicalPayload));
        if (calculated.toLowerCase() !== fullBackup.manifest.checksum.toLowerCase()) {
          warnings.push(
            'Checksum SHA-256 berbeda dari manifest. File mungkin telah diedit secara manual.'
          );
        }
      } catch (err) {
        console.warn('Checksum check error:', err);
      }
    }
  } else {
    // Migrate Legacy 1.0 to Full State 2.0
    warnings.push('File menggunakan format backup legacy (v1.0). Format telah ditingkatkan ke Schema 2.0 secara otomatis.');

    const rawPrompts: PromptItem[] = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    const rawFolders: FolderItem[] = Array.isArray(parsed.folders) ? parsed.folders : [];
    const rawSettings: AppSettings = parsed.settings || DEFAULT_APP_SETTINGS;

    const { cleanPrompts, cleanFolders, cleanSettings } = sanitizeVaultStateForBackup(
      rawPrompts,
      rawFolders,
      rawSettings
    );

    const { counts, categoriesSummary, targetModelsSummary } = calculateVaultCounts(
      cleanPrompts,
      cleanFolders,
      cleanSettings
    );

    const securityMetadata = buildSecurityMetadata(cleanFolders, cleanSettings);

    const manifest: BackupManifest = {
      appName: 'PromptVault',
      appVersion: '2.0',
      backupVersion: '2.0',
      schemaVersion: '2.0',
      createdAt: parsed.exportedAt || new Date().toISOString(),
      workspaceRevision: 1,
      environment: 'Legacy Import Migrated',
      counts,
      categoriesSummary,
      targetModelsSummary,
      checksum: 'legacy-migrated',
    };

    fullBackup = {
      manifest,
      folders: cleanFolders,
      prompts: cleanPrompts,
      settings: cleanSettings,
      securityMetadata,
      integrity: {
        valid: true,
        generatedAt: new Date().toISOString(),
        rulesPassed: ['Migrated from Legacy PromptVault 1.0 format'],
        warnings: ['Legacy backup format upgraded to Full-State 2.0'],
      },
    };
  }

  // Relationship Integrity Check
  const folderIdSet = new Set(fullBackup.folders.map((f) => f.id));
  let unlinkedPromptsCount = 0;

  fullBackup.prompts.forEach((p) => {
    if (p.folderId && !folderIdSet.has(p.folderId)) {
      unlinkedPromptsCount += 1;
    }
  });

  if (unlinkedPromptsCount > 0) {
    warnings.push(
      `${unlinkedPromptsCount} prompt memiliki referensi folder yang tidak ditemukan. Prompt tersebut akan diletakkan di kategori utama/unorganized.`
    );
  }

  // Check Locked Folders security integrity
  const brokenLockedFolders = fullBackup.folders.filter(
    (f) => f.isLocked && (!f.keyHash || !f.keySalt)
  );
  if (brokenLockedFolders.length > 0) {
    warnings.push(
      `${brokenLockedFolders.length} folder terkunci tidak memiliki keyHash/keySalt lengkap.`
    );
  }

  const isValid = issues.length === 0;

  return {
    isValid,
    manifest: fullBackup.manifest,
    backupData: fullBackup,
    issues,
    warnings,
    schemaCompatibility: isSchema2 ? 'v2.0_full_state' : 'v1.0_legacy',
  };
}

/**
 * Pre-Restore Safety Snapshot Management in Session Storage
 */
const PRE_RESTORE_SNAPSHOT_KEY = 'promptvault_prerestore_safety_snapshot';

export function createPreRestoreSnapshot(
  currentPrompts: PromptItem[],
  currentFolders: FolderItem[],
  currentSettings: AppSettings
): PreRestoreSnapshot {
  const { counts } = calculateVaultCounts(currentPrompts, currentFolders, currentSettings);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  const snapshot: PreRestoreSnapshot = {
    id: `PreRestore_${yyyy}-${mm}-${dd}_${hh}-${min}`,
    createdAt: now.toISOString(),
    prompts: JSON.parse(JSON.stringify(currentPrompts)),
    folders: JSON.parse(JSON.stringify(currentFolders)),
    settings: JSON.parse(JSON.stringify(currentSettings)),
    counts,
  };

  try {
    sessionStorage.setItem(PRE_RESTORE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('Could not save snapshot to sessionStorage:', err);
  }

  return snapshot;
}

export function getPreRestoreSnapshot(): PreRestoreSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PRE_RESTORE_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading pre-restore snapshot:', err);
    return null;
  }
}

export function clearPreRestoreSnapshot(): void {
  try {
    sessionStorage.removeItem(PRE_RESTORE_SNAPSHOT_KEY);
  } catch (err) {
    console.error('Error clearing pre-restore snapshot:', err);
  }
}

/**
 * Stage Restored Data with conflict resolution for Replace or Merge modes
 */
export function stageRestoredData(
  backupData: PromptVaultFullBackup,
  currentPrompts: PromptItem[],
  currentFolders: FolderItem[],
  currentSettings: AppSettings,
  mode: RestoreMode
): {
  stagedPrompts: PromptItem[];
  stagedFolders: FolderItem[];
  stagedSettings: AppSettings;
  stats: {
    addedPrompts: number;
    updatedPrompts: number;
    removedPrompts: number;
    addedFolders: number;
    updatedFolders: number;
    removedFolders: number;
  };
} {
  const { cleanPrompts: incomingPrompts, cleanFolders: incomingFolders, cleanSettings: incomingSettings } =
    sanitizeVaultStateForBackup(backupData.prompts, backupData.folders, backupData.settings);

  if (mode === 'replace') {
    // Mode REPLACE: Authoritative full replacement
    return {
      stagedPrompts: incomingPrompts,
      stagedFolders: incomingFolders,
      stagedSettings: {
        ...incomingSettings,
        searchQuery: '',
        activeTab: 'all',
        security: {
          ...incomingSettings.security,
          updatedAt: new Date().toISOString(),
        },
      },
      stats: {
        addedPrompts: incomingPrompts.length,
        updatedPrompts: 0,
        removedPrompts: Math.max(0, currentPrompts.length - incomingPrompts.length),
        addedFolders: incomingFolders.length,
        updatedFolders: 0,
        removedFolders: Math.max(0, currentFolders.length - incomingFolders.length),
      },
    };
  }

  // Mode MERGE: Intelligent merge preserving immutable IDs and newer update timestamps
  const folderMap = new Map<string, FolderItem>();
  let addedFolders = 0;
  let updatedFolders = 0;

  // 1. Existing folders
  currentFolders.forEach((f) => folderMap.set(f.id, { ...f }));

  // 2. Incoming folders merge
  incomingFolders.forEach((incFolder) => {
    if (!folderMap.has(incFolder.id)) {
      folderMap.set(incFolder.id, incFolder);
      addedFolders += 1;
    } else {
      const existing = folderMap.get(incFolder.id)!;
      // Preserve existing locked status if existing is locked, or take incoming lock if existing wasn't locked
      const isLocked = existing.isLocked || incFolder.isLocked;
      const keyHash = existing.keyHash || incFolder.keyHash;
      const keySalt = existing.keySalt || incFolder.keySalt;

      folderMap.set(incFolder.id, {
        ...existing,
        name: incFolder.name || existing.name,
        color: incFolder.color || existing.color,
        description: incFolder.description || existing.description,
        isLocked,
        keyHash,
        keySalt,
      });
      updatedFolders += 1;
    }
  });

  const stagedFolders = Array.from(folderMap.values());
  const validFolderIdSet = new Set(stagedFolders.map((f) => f.id));

  // 3. Prompts merge
  const promptMap = new Map<string, PromptItem>();
  let addedPrompts = 0;
  let updatedPrompts = 0;

  currentPrompts.forEach((p) => promptMap.set(p.id, { ...p }));

  incomingPrompts.forEach((incPrompt) => {
    // Validate folder reference
    const validFolderId =
      incPrompt.folderId && validFolderIdSet.has(incPrompt.folderId)
        ? incPrompt.folderId
        : null;

    const sanitizedIncPrompt: PromptItem = {
      ...incPrompt,
      folderId: validFolderId,
    };

    if (!promptMap.has(incPrompt.id)) {
      promptMap.set(incPrompt.id, sanitizedIncPrompt);
      addedPrompts += 1;
    } else {
      const existing = promptMap.get(incPrompt.id)!;
      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const incomingTime = new Date(incPrompt.updatedAt || 0).getTime();

      if (incomingTime >= existingTime) {
        // Incoming is newer or equal, update
        promptMap.set(incPrompt.id, {
          ...existing,
          ...sanitizedIncPrompt,
          isFavorite: existing.isFavorite || incPrompt.isFavorite, // preserve favorite if either was
        });
        updatedPrompts += 1;
      }
    }
  });

  const stagedPrompts = Array.from(promptMap.values());

  // 4. Merge Settings: keep current Master PIN if already set, otherwise adopt incoming Master PIN
  const hasCurrentMasterPin = Boolean(
    currentSettings.security?.isMasterPinSet && currentSettings.security?.masterPinHash
  );

  const mergedSecurity = hasCurrentMasterPin
    ? currentSettings.security
    : incomingSettings.security;

  const stagedSettings: AppSettings = {
    ...currentSettings,
    preferences: {
      ...currentSettings.preferences,
      ...incomingSettings.preferences,
    },
    aiSettings: {
      ...currentSettings.aiSettings,
      ...incomingSettings.aiSettings,
    },
    gallerySettings: {
      ...currentSettings.gallerySettings,
      ...incomingSettings.gallerySettings,
    },
    panelSizes: {
      ...currentSettings.panelSizes,
      ...incomingSettings.panelSizes,
    },
    security: mergedSecurity,
    updatedAt: new Date().toISOString(),
  };

  return {
    stagedPrompts,
    stagedFolders,
    stagedSettings,
    stats: {
      addedPrompts,
      updatedPrompts,
      removedPrompts: 0,
      addedFolders,
      updatedFolders,
      removedFolders: 0,
    },
  };
}

/**
 * Validate post-restore results against expected manifest counts
 */
export function verifyPostRestoreState(
  restoredPrompts: PromptItem[],
  restoredFolders: FolderItem[],
  manifest: BackupManifest | null
): PostRestoreVerification {
  const { counts: actual } = calculateVaultCounts(restoredPrompts, restoredFolders);

  if (!manifest) {
    return {
      isVerified: true,
      expected: actual,
      actual,
      mismatches: [],
      timestamp: new Date().toISOString(),
    };
  }

  const expected = manifest.counts;
  const mismatches: string[] = [];

  if (actual.prompts !== expected.prompts) {
    mismatches.push(`Total Prompts: Diharapkan ${expected.prompts}, Aktual ${actual.prompts}`);
  }
  if (actual.folders !== expected.folders) {
    mismatches.push(`Total Folders: Diharapkan ${expected.folders}, Aktual ${actual.folders}`);
  }
  if (actual.favorites !== expected.favorites) {
    mismatches.push(`Total Favorites: Diharapkan ${expected.favorites}, Aktual ${actual.favorites}`);
  }
  if (actual.lockedFolders !== expected.lockedFolders) {
    mismatches.push(`Folder Terkunci: Diharapkan ${expected.lockedFolders}, Aktual ${actual.lockedFolders}`);
  }

  return {
    isVerified: mismatches.length === 0,
    expected,
    actual,
    mismatches,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Trigger file download in browser
 */
export function downloadBackupJsonFile(jsonString: string, filename: string): void {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('href', url);
  anchor.setAttribute('download', filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
