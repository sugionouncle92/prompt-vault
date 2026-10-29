import { useState, useEffect } from 'react';
import {
  PWAState,
  getInitialPWAState,
  subscribePWAState,
  triggerPWAInstall,
  applyPWAUpdate,
  runPWADiagnostics,
} from '../utils/pwaManager';

export function usePWA() {
  const [pwaState, setPwaState] = useState<PWAState>(getInitialPWAState);

  useEffect(() => {
    const unsubscribe = subscribePWAState((state) => {
      setPwaState(state);
    });
    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    return await triggerPWAInstall();
  };

  const handleUpdate = () => {
    applyPWAUpdate();
  };

  const handleRefreshDiagnostics = async () => {
    return await runPWADiagnostics();
  };

  return {
    ...pwaState,
    installPWA: handleInstall,
    applyUpdate: handleUpdate,
    refreshDiagnostics: handleRefreshDiagnostics,
  };
}
