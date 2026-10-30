/**
 * PBKDF2 Secure Key Hashing & Verification for PromptVault Folder & App Access Key
 * Uses browser-native Web Crypto API (crypto.subtle)
 * Iterations: 100,000 | Hash: SHA-256 | Salt: 16-byte random salt
 */

// Convert ArrayBuffer to Hex String
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex String to Uint8Array
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Generate 16-byte random salt in hex
export function generateSaltHex(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bufferToHex(salt.buffer);
}

/**
 * Hash key with PBKDF2-SHA256
 */
export async function hashFolderKey(
  key: string,
  existingSaltHex?: string
): Promise<{ keyHash: string; keySalt: string }> {
  const saltHex = existingSaltHex || generateSaltHex();
  const saltBuffer = hexToBuffer(saltHex);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes (256 bits)
  );

  const keyHash = bufferToHex(derivedBits);
  return { keyHash, keySalt: saltHex };
}

/**
 * Verify key against stored hash and salt
 */
export async function verifyFolderKey(
  inputKey: string,
  storedKeyHash: string,
  storedKeySalt: string
): Promise<boolean> {
  if (!inputKey || !storedKeyHash || !storedKeySalt) return false;
  try {
    const { keyHash } = await hashFolderKey(inputKey, storedKeySalt);
    return keyHash.toLowerCase() === storedKeyHash.toLowerCase();
  } catch (err) {
    console.error('Error verifying key:', err);
    return false;
  }
}

/**
 * Validate whether a string is a valid PBKDF2-SHA256 hex hash (64 hex characters)
 */
export function isValidPbkdf2Hash(hash?: string | null): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return /^[0-9a-fA-F]{64}$/.test(hash.trim());
}

/**
 * Validate whether a string is a valid PBKDF2 salt hex (at least 32 hex characters = 16 bytes)
 */
export function isValidPbkdf2Salt(salt?: string | null): boolean {
  if (!salt || typeof salt !== 'string') return false;
  return /^[0-9a-fA-F]{32,}$/.test(salt.trim());
}

/**
 * Hash Master Folder Password with PBKDF2-SHA256
 */
export async function hashMasterFolderPassword(
  password: string,
  existingSaltHex?: string
): Promise<{ masterPasswordHash: string; masterPasswordSalt: string }> {
  const { keyHash, keySalt } = await hashFolderKey(password, existingSaltHex);
  return { masterPasswordHash: keyHash, masterPasswordSalt: keySalt };
}

/**
 * Verify Master Folder Password against stored hash and salt
 */
export async function verifyMasterFolderPassword(
  inputPassword: string,
  storedHash?: string,
  storedSalt?: string
): Promise<boolean> {
  if (!inputPassword || !storedHash || !storedSalt) return false;
  return verifyFolderKey(inputPassword, storedHash, storedSalt);
}

/**
 * Check if Master Folder Password is genuinely configured with a valid PBKDF2 SHA-256 hash
 */
export function isMasterFolderPasswordConfigured(securitySettings?: {
  masterFolderPasswordHash?: string;
  masterFolderPasswordSalt?: string;
  isMasterFolderPasswordSet?: boolean;
} | null): boolean {
  if (!securitySettings) return false;
  const hasValidHash = isValidPbkdf2Hash(securitySettings.masterFolderPasswordHash);
  const hasValidSalt = isValidPbkdf2Salt(securitySettings.masterFolderPasswordSalt);
  return hasValidHash && hasValidSalt && securitySettings.isMasterFolderPasswordSet !== false;
}

export function getEffectiveMasterFolderCredentials(securitySettings?: {
  masterFolderPasswordHash?: string;
  masterFolderPasswordSalt?: string;
} | null): {
  hash?: string;
  salt?: string;
} {
  if (
    isValidPbkdf2Hash(securitySettings?.masterFolderPasswordHash) &&
    isValidPbkdf2Salt(securitySettings?.masterFolderPasswordSalt)
  ) {
    return {
      hash: securitySettings!.masterFolderPasswordHash!.trim(),
      salt: securitySettings!.masterFolderPasswordSalt!.trim(),
    };
  }
  return {};
}

/**
 * Alias for App Vault Access Key Hashing
 */
export async function hashVaultAccessKey(
  key: string,
  existingSaltHex?: string
): Promise<{ accessKeyHash: string; accessKeySalt: string }> {
  const { keyHash, keySalt } = await hashFolderKey(key, existingSaltHex);
  return { accessKeyHash: keyHash, accessKeySalt: keySalt };
}

/**
 * Alias for App Vault Access Key Verification
 */
export async function verifyVaultAccessKey(
  inputKey: string,
  storedHash?: string,
  storedSalt?: string
): Promise<boolean> {
  if (!inputKey || !storedHash || !storedSalt) return false;
  return verifyFolderKey(inputKey, storedHash, storedSalt);
}

// In-memory rate limiting and lockout state for failed unlock attempts
interface LockoutState {
  failedAttempts: number;
  lockedUntil: number | null; // Timestamp ms
}

const lockoutMap = new Map<string, LockoutState>();
const APP_GATE_KEY = '__app_access_gate__';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

/**
 * Check if a folder or app gate is currently locked out from brute-force attempts
 */
export function getFolderLockoutRemainingSeconds(id: string = APP_GATE_KEY): number {
  const state = lockoutMap.get(id);
  if (!state || !state.lockedUntil) return 0;

  const now = Date.now();
  if (now < state.lockedUntil) {
    return Math.ceil((state.lockedUntil - now) / 1000);
  } else {
    // Lockout expired
    state.lockedUntil = null;
    state.failedAttempts = 0;
    return 0;
  }
}

/**
 * Record a failed attempt. If failed attempts reach 5, trigger 30-second lockout.
 */
export function recordFailedAttempt(id: string = APP_GATE_KEY): {
  attemptsLeft: number;
  isLockedOut: boolean;
  lockoutSeconds: number;
} {
  let state = lockoutMap.get(id);
  if (!state) {
    state = { failedAttempts: 0, lockedUntil: null };
    lockoutMap.set(id, state);
  }

  // If already locked out
  const remaining = getFolderLockoutRemainingSeconds(id);
  if (remaining > 0) {
    return {
      attemptsLeft: 0,
      isLockedOut: true,
      lockoutSeconds: remaining,
    };
  }

  state.failedAttempts += 1;

  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    return {
      attemptsLeft: 0,
      isLockedOut: true,
      lockoutSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  return {
    attemptsLeft: MAX_FAILED_ATTEMPTS - state.failedAttempts,
    isLockedOut: false,
    lockoutSeconds: 0,
  };
}

/**
 * Reset failed attempts upon successful unlock
 */
export function resetFailedAttempts(id: string = APP_GATE_KEY): void {
  lockoutMap.delete(id);
}

/**
 * Hash Master Recovery PIN with PBKDF2-SHA256
 */
export async function hashMasterRecoveryPin(
  pin: string,
  existingSaltHex?: string
): Promise<{ masterPinHash: string; masterPinSalt: string }> {
  const { keyHash, keySalt } = await hashFolderKey(pin, existingSaltHex);
  return { masterPinHash: keyHash, masterPinSalt: keySalt };
}

/**
 * Verify Master Recovery PIN against stored hash and salt
 */
export async function verifyMasterRecoveryPin(
  inputPin: string,
  storedMasterHash?: string,
  storedMasterSalt?: string
): Promise<boolean> {
  if (!inputPin || !storedMasterHash || !storedMasterSalt) return false;
  return verifyFolderKey(inputPin, storedMasterHash, storedMasterSalt);
}

/**
 * Check if Master Recovery PIN is configured in security settings based on valid PBKDF2 SHA-256 hash
 */
export function isMasterRecoveryPinConfigured(securitySettings?: {
  masterPinHash?: string;
  masterPinSalt?: string;
  isMasterPinSet?: boolean;
} | null): boolean {
  if (!securitySettings) return false;
  const isSet = Boolean(securitySettings.isMasterPinSet);
  const hasValidHash = isValidPbkdf2Hash(securitySettings.masterPinHash);
  const hasValidSalt = isValidPbkdf2Salt(securitySettings.masterPinSalt);
  return isSet && hasValidHash && hasValidSalt;
}

/**
 * Check if App Vault Access Key is enabled & configured
 * Note: If isGlobalAppLockEnabled is explicitly false, returns false (bypassing the lock)
 */
export function isVaultAccessKeyConfigured(securitySettings?: {
  isGlobalAppLockEnabled?: boolean;
  isVaultAccessKeyEnabled?: boolean;
  vaultAccessKeyHash?: string;
  vaultAccessKeySalt?: string;
} | null): boolean {
  // If global app lock toggle is explicitly turned OFF, bypass all app locking
  if (securitySettings?.isGlobalAppLockEnabled === false) {
    return false;
  }

  return Boolean(
    securitySettings?.isVaultAccessKeyEnabled &&
      securitySettings?.vaultAccessKeyHash &&
      securitySettings?.vaultAccessKeySalt
  );
}

// Session Storage Keys for Vault Unlocked state
const SESSION_VAULT_UNLOCKED_KEY = 'promptvault_session_unlocked';

export function getSessionVaultUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_VAULT_UNLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSessionVaultUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_VAULT_UNLOCKED_KEY, 'true');
    } else {
      sessionStorage.removeItem(SESSION_VAULT_UNLOCKED_KEY);
    }
  } catch (err) {
    console.error('Failed to write session vault unlock state:', err);
  }
}

