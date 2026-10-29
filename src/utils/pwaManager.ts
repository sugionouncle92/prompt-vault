/**
 * PromptVault Universal PWA & Android Installation Manager
 * Handles Service Worker lifecycle, install prompt capturing,
 * standalone mode detection, real live diagnostics, and seamless update propagation.
 */

// Interface for BeforeInstallPromptEvent
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWADiagnostics {
  isSupported: boolean;
  isSecureContext: boolean;
  isInIframe: boolean;
  swState: 'unsupported' | 'registering' | 'active' | 'waiting' | 'redundant' | 'error';
  manifestStatus: 'valid' | 'invalid' | 'checking' | 'error';
  cacheStatus: 'cached' | 'partial' | 'empty' | 'unsupported';
  cachedAssetsCount: number;
  isPromptAvailable: boolean;
  isStandalone: boolean;
  lastError: string | null;
}

export interface PWAState {
  isInstallable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInstalled: boolean;
  hasUpdate: boolean;
  isInIframe: boolean;
  platform: 'android' | 'ios' | 'desktop' | 'unknown';
  diagnostics: PWADiagnostics;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let activeSWRegistration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let pwaStateListeners: Array<(state: PWAState) => void> = [];

const initialDiagnostics: PWADiagnostics = {
  isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
  isInIframe: typeof window !== 'undefined' && window.self !== window.top,
  swState: typeof navigator !== 'undefined' && !('serviceWorker' in navigator) ? 'unsupported' : 'registering',
  manifestStatus: 'checking',
  cacheStatus: 'empty',
  cachedAssetsCount: 0,
  isPromptAvailable: false,
  isStandalone: false,
  lastError: null,
};

let currentPWAState: PWAState = {
  isInstallable: false,
  isStandalone: false,
  isIOS: false,
  isAndroid: false,
  isInstalled: false,
  hasUpdate: false,
  isInIframe: false,
  platform: 'unknown',
  diagnostics: initialDiagnostics,
};

// Check if deferred prompt is stored on window
function getAvailableInstallPrompt(): BeforeInstallPromptEvent | null {
  if (deferredInstallPrompt) return deferredInstallPrompt;
  if (typeof window !== 'undefined' && (window as any).__deferredInstallPrompt) {
    deferredInstallPrompt = (window as any).__deferredInstallPrompt as BeforeInstallPromptEvent;
    return deferredInstallPrompt;
  }
  return null;
}

// Helper: Calculate initial platform & standalone state
export function getInitialPWAState(): PWAState {
  if (typeof window === 'undefined') return currentPWAState;

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/i.test(ua);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  const isInIframe = window.self !== window.top;

  let platform: 'android' | 'ios' | 'desktop' | 'unknown' = 'desktop';
  if (isAndroid) platform = 'android';
  else if (isIOS) platform = 'ios';

  const prompt = getAvailableInstallPrompt();

  currentPWAState = {
    ...currentPWAState,
    isStandalone,
    isInstalled: isStandalone,
    isIOS,
    isAndroid,
    isInIframe,
    platform,
    isInstallable: !isStandalone && (prompt !== null || isIOS),
    diagnostics: {
      ...currentPWAState.diagnostics,
      isSupported: 'serviceWorker' in navigator,
      isSecureContext: window.isSecureContext,
      isInIframe,
      isStandalone,
      isPromptAvailable: prompt !== null,
    },
  };

  return currentPWAState;
}

// Notify all subscribers
function notifyListeners() {
  pwaStateListeners.forEach((listener) => {
    try {
      listener({ ...currentPWAState });
    } catch (e) {
      console.warn('[PWA] Error in listener callback:', e);
    }
  });
}

/**
 * Initialize PWA Event Listeners (Call once at app boot)
 */
export function initPWAManager(onUpdateAvailable?: () => void) {
  if (typeof window === 'undefined') return;

  getInitialPWAState();

  // 1. Listen for browser install prompt trigger
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    (window as any).__deferredInstallPrompt = deferredInstallPrompt;
    currentPWAState = {
      ...currentPWAState,
      isInstallable: true,
      diagnostics: {
        ...currentPWAState.diagnostics,
        isPromptAvailable: true,
      },
    };
    notifyListeners();
  });

  // 2. Listen for appinstalled event
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    (window as any).__deferredInstallPrompt = null;
    currentPWAState = {
      ...currentPWAState,
      isInstallable: false,
      isInstalled: true,
      isStandalone: true,
      diagnostics: {
        ...currentPWAState.diagnostics,
        isPromptAvailable: false,
        isStandalone: true,
      },
    };
    notifyListeners();
  });

  // 3. Listen for display-mode change
  try {
    const matchMediaStandalone = window.matchMedia('(display-mode: standalone)');
    matchMediaStandalone.addEventListener('change', (e) => {
      const prompt = getAvailableInstallPrompt();
      currentPWAState = {
        ...currentPWAState,
        isStandalone: e.matches,
        isInstalled: e.matches,
        isInstallable: !e.matches && prompt !== null,
        diagnostics: {
          ...currentPWAState.diagnostics,
          isStandalone: e.matches,
        },
      };
      notifyListeners();
    });
  } catch (err) {
    // Ignore unsupported browser edge cases
  }

  // 4. Register Service Worker with robust load-state check
  registerServiceWorker(onUpdateAvailable);

  // 5. Run initial diagnostics
  setTimeout(() => {
    runPWADiagnostics();
  }, 1000);
}

/**
 * Register Service Worker securely with update detection
 */
export function registerServiceWorker(onUpdateAvailable?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    currentPWAState = {
      ...currentPWAState,
      diagnostics: {
        ...currentPWAState.diagnostics,
        swState: 'unsupported',
      },
    };
    notifyListeners();
    return;
  }

  const doRegister = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        activeSWRegistration = registration;
        
        let swState: PWADiagnostics['swState'] = 'active';
        if (registration.installing) swState = 'registering';
        else if (registration.waiting) swState = 'waiting';
        else if (registration.active) swState = 'active';

        currentPWAState = {
          ...currentPWAState,
          diagnostics: {
            ...currentPWAState.diagnostics,
            swState,
            lastError: null,
          },
        };
        notifyListeners();

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New update is ready to activate
                waitingWorker = newWorker;
                currentPWAState = {
                  ...currentPWAState,
                  hasUpdate: true,
                  diagnostics: {
                    ...currentPWAState.diagnostics,
                    swState: 'waiting',
                  },
                };
                notifyListeners();
                if (onUpdateAvailable) {
                  onUpdateAvailable();
                }
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration skipped/failed:', err);
        currentPWAState = {
          ...currentPWAState,
          diagnostics: {
            ...currentPWAState.diagnostics,
            swState: 'error',
            lastError: err?.message || 'Gagal mendaftarkan Service Worker',
          },
        };
        notifyListeners();
      });

    // Refresh page when controlling service worker changes
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  };

  // Safe registration: execute immediately if already loaded
  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister);
  }
}

/**
 * Run real diagnostics checking manifest, cache, and SW state
 */
export async function runPWADiagnostics(): Promise<PWADiagnostics> {
  const diag: PWADiagnostics = {
    ...currentPWAState.diagnostics,
    isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
    isInIframe: typeof window !== 'undefined' && window.self !== window.top,
    isStandalone:
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true),
    isPromptAvailable: getAvailableInstallPrompt() !== null,
  };

  // 1. Check Service Worker state
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) {
        activeSWRegistration = reg;
        if (reg.active) diag.swState = 'active';
        else if (reg.installing) diag.swState = 'registering';
        else if (reg.waiting) diag.swState = 'waiting';
      } else {
        diag.swState = 'registering';
      }
    } catch (e: any) {
      diag.swState = 'error';
      diag.lastError = e?.message || 'Error checking SW registration';
    }
  } else {
    diag.swState = 'unsupported';
  }

  // 2. Check Manifest
  if (typeof window !== 'undefined') {
    try {
      const manifestRes = await fetch('/manifest.webmanifest', { cache: 'no-cache' });
      if (manifestRes.ok) {
        const json = await manifestRes.json();
        if (json.name && json.icons && json.start_url && json.display) {
          diag.manifestStatus = 'valid';
        } else {
          diag.manifestStatus = 'invalid';
        }
      } else {
        diag.manifestStatus = 'error';
      }
    } catch {
      diag.manifestStatus = 'error';
    }
  }

  // 3. Check Cache
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheKeys = await caches.keys();
      const pwaCaches = cacheKeys.filter((k) => k.startsWith('promptvault-'));
      if (pwaCaches.length > 0) {
        let count = 0;
        for (const k of pwaCaches) {
          const cache = await caches.open(k);
          const reqs = await cache.keys();
          count += reqs.length;
        }
        diag.cachedAssetsCount = count;
        diag.cacheStatus = count > 0 ? 'cached' : 'empty';
      } else {
        diag.cacheStatus = 'empty';
        diag.cachedAssetsCount = 0;
      }
    } catch {
      diag.cacheStatus = 'unsupported';
    }
  }

  currentPWAState = {
    ...currentPWAState,
    diagnostics: diag,
  };
  notifyListeners();
  return diag;
}

/**
 * Trigger the native PWA Installation prompt
 */
export async function triggerPWAInstall(): Promise<{
  outcome: 'accepted' | 'dismissed' | 'unsupported' | 'iframe_blocked';
  message?: string;
}> {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const promptEvent = getAvailableInstallPrompt();

  if (!promptEvent) {
    if (isInIframe) {
      return {
        outcome: 'iframe_blocked',
        message:
          'Browser melarang pemasangan PWA otomatis di dalam frame preview AI Studio. Buka URL aplikasi langsung di tab browser baru untuk menginstal.',
      };
    }
    return {
      outcome: 'unsupported',
      message:
        'Browser belum menyediakan install prompt otomatis. Buka menu browser (titik tiga ⋮) lalu pilih "Tambahkan ke Layar Utama" atau "Instal Aplikasi".',
    };
  }

  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    // Immediately consume the prompt reference so it cannot be invoked twice
    deferredInstallPrompt = null;
    if (typeof window !== 'undefined') {
      (window as any).__deferredInstallPrompt = null;
    }

    if (choice.outcome === 'accepted') {
      currentPWAState = {
        ...currentPWAState,
        isInstallable: false,
        isInstalled: true,
        diagnostics: {
          ...currentPWAState.diagnostics,
          isPromptAvailable: false,
        },
      };
      notifyListeners();
    } else {
      currentPWAState = {
        ...currentPWAState,
        isInstallable: false,
        diagnostics: {
          ...currentPWAState.diagnostics,
          isPromptAvailable: false,
        },
      };
      notifyListeners();
    }

    return { outcome: choice.outcome };
  } catch (err: any) {
    console.error('[PWA] Install prompt failed:', err);
    deferredInstallPrompt = null;
    if (typeof window !== 'undefined') {
      (window as any).__deferredInstallPrompt = null;
    }
    return {
      outcome: 'dismissed',
      message: err?.message || 'Proses install prompt dibatalkan.',
    };
  }
}

/**
 * Activate the newly installed Service Worker update safely
 */
export function applyPWAUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

/**
 * Subscribe to PWA state changes in React components
 */
export function subscribePWAState(listener: (state: PWAState) => void): () => void {
  pwaStateListeners.push(listener);
  listener({ ...currentPWAState });

  return () => {
    pwaStateListeners = pwaStateListeners.filter((l) => l !== listener);
  };
}
