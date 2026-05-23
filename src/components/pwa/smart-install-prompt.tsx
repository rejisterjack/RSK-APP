/**
 * Smart Install Prompt
 * Shows install prompt based on user engagement metrics rather than
 * simple time delays. Tracks page views, session duration, and
 * interaction count to prompt at the optimal moment.
 */

'use client';

import { Download, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useInstallPrompt, usePWA } from '@/hooks/use-pwa';
import { cn } from '@/lib/utils';

interface SmartInstallPromptProps {
  className?: string;
  /** Minimum page views before showing */
  minPageViews?: number;
  /** Minimum session duration in ms before showing */
  minSessionDuration?: number;
  /** Minimum interactions (clicks/scrolls) before showing */
  minInteractions?: number;
  /** Delay after meeting criteria (ms) */
  delayAfterCriteria?: number;
}

const STORAGE_KEY = 'pwa:engagement-metrics';

interface EngagementMetrics {
  pageViews: number;
  sessionStart: number;
  interactions: number;
  promptShown: boolean;
  promptDismissedAt?: number;
}

function getMetrics(): EngagementMetrics {
  if (typeof window === 'undefined') {
    return { pageViews: 0, sessionStart: 0, interactions: 0, promptShown: false };
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as EngagementMetrics;
    } catch {
      // corrupted
    }
  }
  return { pageViews: 0, sessionStart: 0, interactions: 0, promptShown: false };
}

function saveMetrics(metrics: EngagementMetrics): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
}

export function SmartInstallPrompt({
  className,
  minPageViews = 2,
  minSessionDuration = 60000, // 1 minute
  minInteractions = 5,
  delayAfterCriteria = 5000,
}: SmartInstallPromptProps) {
  const { isInstallable: isAvailable, promptInstall, dismissInstall } = useInstallPrompt();
  const { platform, isIOS } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [metrics, setMetrics] = useState<EngagementMetrics>(getMetrics);

  // Track engagement
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const m = getMetrics();
    if (!m.sessionStart) m.sessionStart = Date.now();
    m.pageViews += 1;
    saveMetrics(m);
    setMetrics(m);

    const handleInteraction = () => {
      const current = getMetrics();
      current.interactions += 1;
      saveMetrics(current);
      setMetrics(current);
    };

    // Track clicks and scrolls as interactions
    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('scroll', handleInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('scroll', handleInteraction);
    };
  }, []);

  // Check criteria and show prompt
  useEffect(() => {
    if (!isAvailable || metrics.promptShown) return;

    const sessionDuration = Date.now() - metrics.sessionStart;
    const meetsCriteria =
      metrics.pageViews >= minPageViews &&
      sessionDuration >= minSessionDuration &&
      metrics.interactions >= minInteractions;

    if (meetsCriteria) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        const m = getMetrics();
        m.promptShown = true;
        saveMetrics(m);
      }, delayAfterCriteria);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isAvailable, metrics, minPageViews, minSessionDuration, minInteractions, delayAfterCriteria]);

  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      dismissInstall();
      const m = getMetrics();
      m.promptDismissedAt = Date.now();
      saveMetrics(m);
    }, 300);
  }, [dismissInstall]);

  const handleInstall = useCallback(async () => {
    if (platform === 'ios' || isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    const success = await promptInstall();
    if (success) {
      toast.success('App installed successfully!');
      setIsVisible(false);
    }
  }, [platform, isIOS, promptInstall]);

  if (!isVisible) return null;

  // iOS Instructions
  if (showIOSInstructions) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
        onClick={() => setShowIOSInstructions(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setShowIOSInstructions(false);
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-sm animate-in zoom-in-95"
          role="document"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl border bg-background p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Install on iOS</h3>
                <p className="text-xs text-muted-foreground">Add to Home Screen</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  1
                </span>
                Tap the Share button in Safari
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  2
                </span>
                Scroll down and tap &quot;Add to Home Screen&quot;
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  3
                </span>
                Tap &quot;Add&quot; in the top right
              </li>
            </ol>
            <Button
              variant="outline"
              className="w-full mt-5"
              onClick={() => setShowIOSInstructions(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80',
        'transition-all duration-300',
        isClosing ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100',
        className
      )}
    >
      <div className="rounded-2xl border bg-background/95 backdrop-blur-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Install RAG Chatbot</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to your home screen for offline access, faster launches, and native feel.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 -mr-1 -mt-1 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" className="flex-1 text-xs" onClick={handleInstall}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Install
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={handleDismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
