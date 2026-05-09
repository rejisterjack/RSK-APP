/**
 * Offline Storage Manager
 * Allows users to view and manage cached data, pending actions,
 * and storage usage with a clean UI.
 */

'use client';

import { Database, HardDrive, Loader2, Trash2, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSyncStatus } from '@/hooks/use-offline-query';
import { apiCache, pendingActions } from '@/lib/offline/indexed-db';
import { getStorageEstimate } from '@/lib/pwa/pwa-config';
import { cn } from '@/lib/utils';

interface StorageStats {
  usage: number;
  quota: number;
  percentage: number;
  cacheEntries: number;
  pendingActions: number;
}

export function OfflineStorageManager({ className }: { className?: string }) {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { pendingCount, isSyncing } = useSyncStatus();

  const loadStats = useCallback(async () => {
    try {
      const estimate = await getStorageEstimate();
      const cacheEntries = (await apiCache.count?.()) ?? 0;
      const pending = await pendingActions.getAll();

      const usage = estimate?.usage ?? 0;
      const quota = estimate?.quota ?? 0;

      setStats({
        usage,
        quota,
        percentage: quota > 0 ? Math.round((usage / quota) * 100) : 0,
        cacheEntries,
        pendingActions: pending.length,
      });
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleClearCache = useCallback(async () => {
    setIsClearing(true);
    try {
      await apiCache.clear?.();
      toast.success('Cache cleared');
      await loadStats();
    } catch {
      toast.error('Failed to clear cache');
    } finally {
      setIsClearing(false);
    }
  }, [loadStats]);

  const handleClearPending = useCallback(async () => {
    setIsClearing(true);
    try {
      const all = await pendingActions.getAll();
      await Promise.all(all.map((a) => pendingActions.delete(a.id)));
      toast.success('Pending actions cleared');
      await loadStats();
    } catch {
      toast.error('Failed to clear pending actions');
    } finally {
      setIsClearing(false);
    }
  }, [loadStats]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <Card className={cn('w-full max-w-md', className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={cn('w-full max-w-md', className)}>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Storage information unavailable
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <HardDrive className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Offline Storage</CardTitle>
            <CardDescription className="text-xs">
              Manage cached data and pending actions
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Storage bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Storage used</span>
            <span className="font-medium">
              {formatBytes(stats.usage)} / {formatBytes(stats.quota)}
            </span>
          </div>
          <Progress
            value={stats.percentage}
            className={cn(
              'h-2',
              stats.percentage > 90
                ? 'bg-destructive/20'
                : stats.percentage > 70
                  ? 'bg-amber-500/20'
                  : ''
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            {stats.percentage}% of available storage
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Database className="h-3.5 w-3.5" />
              Cached entries
            </div>
            <p className="text-lg font-semibold">{stats.cacheEntries}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <WifiOff className="h-3.5 w-3.5" />
              Pending actions
            </div>
            <p className="text-lg font-semibold">{pendingCount}</p>
            {isSyncing && (
              <span className="text-[10px] text-blue-500 flex items-center gap-1 mt-0.5">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Syncing...
              </span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleClearCache}
          disabled={isClearing || stats.cacheEntries === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear cache
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-xs"
          onClick={handleClearPending}
          disabled={isClearing || pendingCount === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear pending
        </Button>
      </CardFooter>
    </Card>
  );
}
