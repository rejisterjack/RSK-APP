'use client';

import { AlertTriangle, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
}

export function DegradationBanner(): React.ReactElement | null {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check online status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service health periodically
    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (!res.ok || cancelled) return;
        const data = await res.json();

        const svcs: ServiceStatus[] = [];
        if (data.checks) {
          for (const [key, val] of Object.entries(data.checks)) {
            const check = val as { status?: string; healthy?: boolean };
            if (typeof check.status === 'string' || typeof check.healthy === 'boolean') {
              svcs.push({
                name: formatName(key),
                status:
                  check.healthy === false || check.status === 'unhealthy'
                    ? 'down'
                    : check.status === 'degraded'
                      ? 'degraded'
                      : 'healthy',
              });
            }
          }
        }
        if (!cancelled) setServices(svcs);
      } catch {
        // Health check itself failed - likely offline
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      cancelled = true;
      setIsOffline(false);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 text-xs text-yellow-600 dark:text-yellow-400">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>You&apos;re offline. Some features may be unavailable.</span>
      </div>
    );
  }

  const degraded = services.filter((s) => s.status !== 'healthy');
  if (degraded.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/20 text-xs text-orange-600 dark:text-orange-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        {degraded.length === 1 ? (
          <>
            {degraded[0].name} is {degraded[0].status}
          </>
        ) : (
          <>
            {degraded.length} services degraded: {degraded.map((s) => s.name).join(', ')}
          </>
        )}
      </span>
    </div>
  );
}

function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
