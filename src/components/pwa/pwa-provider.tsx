'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConnectivityBanner, SyncToast, UpdateToast } from '@/components/pwa';
import { SmartInstallPrompt } from '@/components/pwa/smart-install-prompt';
import { useConnectivity } from '@/hooks/use-connectivity';
import { usePWA, useServiceWorker } from '@/hooks/use-pwa';
import { startConnectivityMonitoring } from '@/lib/offline/connectivity-monitor';
import { runMaintenance } from '@/lib/offline/indexed-db';

/**
 * PWA Provider Props
 */
interface PWAProviderProps {
  children: ReactNode;
  /** Show install prompt */
  showInstallPrompt?: boolean;
  /** Show update notifications */
  showUpdateToast?: boolean;
  /** Show connectivity banner */
  showConnectivityBanner?: boolean;
  /** Show sync toast notifications */
  showSyncToast?: boolean;
  /** Position of the connectivity banner */
  connectivityPosition?: 'top' | 'bottom';
  /** Delay before showing install prompt (ms) */
  installPromptDelay?: number;
}

/**
 * PWA Provider Component
 * Wraps the application with PWA-related UI components and functionality.
 * Initializes connectivity monitoring, background sync, and IndexedDB maintenance.
 *
 * @example
 * ```tsx
 * <PWAProvider
 *   showInstallPrompt={true}
 *   showUpdateToast={true}
 *   showConnectivityBanner={true}
 *   showSyncToast={true}
 * >
 *   <App />
 * </PWAProvider>
 * ```
 */
export function PWAProvider({
  children,
  showInstallPrompt = true,
  showUpdateToast = true,
  showConnectivityBanner = true,
  showSyncToast = true,
  connectivityPosition = 'top',
}: PWAProviderProps) {
  const { isInstalled } = usePWA();
  const { checkForUpdate } = useServiceWorker();
  useConnectivityWithToasts();

  // Initialize connectivity monitoring and DB maintenance
  useEffect(() => {
    // Start monitoring network state
    startConnectivityMonitoring();

    // Run DB maintenance on start (clear expired, evict old)
    void runMaintenance();

    // Periodic maintenance every 15 minutes
    const maintenanceInterval = setInterval(
      () => {
        void runMaintenance();
      },
      15 * 60 * 1000
    );

    return () => clearInterval(maintenanceInterval);
  }, []);

  // Check for updates periodically
  useEffect(() => {
    const checkInterval = setInterval(
      () => {
        checkForUpdate();
      },
      60 * 60 * 1000
    ); // Check every hour

    return () => clearInterval(checkInterval);
  }, [checkForUpdate]);

  return (
    <>
      {children}

      {/* Connectivity Banner (enhanced - replaces OfflineIndicator) */}
      {showConnectivityBanner && <ConnectivityBanner position={connectivityPosition} />}

      {/* Sync Toast (shows when background sync completes) */}
      {showSyncToast && <SyncToast />}

      {/* Smart Install Prompt - engagement-based */}
      {showInstallPrompt && !isInstalled && <SmartInstallPrompt />}

      {/* Update Toast */}
      {showUpdateToast && <UpdateToast checkOnMount={true} />}
    </>
  );
}

/**
 * Hook that bridges connectivity state changes to sonner toasts
 */
function useConnectivityWithToasts() {
  const { state, isOffline, isLiefi, isReconnecting } = useConnectivity();
  const [previousState, setPreviousState] = useState<string>('online');

  useEffect(() => {
    // Show toast when going offline
    if (state === 'offline' && previousState !== 'offline') {
      toast.warning("You're offline", {
        description: 'Messages will queue and sync when you reconnect.',
        duration: 5000,
        id: 'connectivity-offline',
      });
    }

    // Show toast when back online
    if (state === 'online' && previousState === 'offline') {
      toast.success("You're back online", {
        description: 'Syncing queued messages...',
        duration: 4000,
        id: 'connectivity-online',
      });
    }

    // Show toast for lie-fi
    if (state === 'liefi' && previousState !== 'liefi') {
      toast.info('Slow connection detected', {
        description: 'Using cached data where possible.',
        duration: 5000,
        id: 'connectivity-liefi',
      });
    }

    setPreviousState(state);
  }, [state, previousState]);

  return { state, previousState, isOffline, isLiefi, isReconnecting };
}
