'use client';

import { BookOpen, FileText, Keyboard, MessageSquare, Settings, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TourStep {
  target: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="upload"]',
    title: 'Upload Documents',
    description:
      "Click here to upload PDF, DOCX, Markdown, or text files. They'll be automatically chunked and embedded for search.",
    icon: <FileText className="h-4 w-4" />,
    position: 'right',
  },
  {
    target: '[data-tour="chat-input"]',
    title: 'Ask Questions',
    description:
      'Type your question here. The AI will search your documents and provide answers with source citations.',
    icon: <MessageSquare className="h-4 w-4" />,
    position: 'top',
  },
  {
    target: '[data-tour="sources"]',
    title: 'View Sources',
    description:
      'Every AI response includes source citations. Click on a source to see the original document chunk and similarity score.',
    icon: <BookOpen className="h-4 w-4" />,
    position: 'left',
  },
  {
    target: '[data-tour="agent-mode"]',
    title: 'Agent Mode',
    description:
      'Enable agent mode for web search, calculators, and multi-step reasoning. Great for complex questions.',
    icon: <Sparkles className="h-4 w-4" />,
    position: 'bottom',
  },
  {
    target: '[data-tour="model-picker"]',
    title: 'Switch Models',
    description:
      'Choose from multiple AI models including free options (DeepSeek, Llama, Gemma) across multiple providers.',
    icon: <Settings className="h-4 w-4" />,
    position: 'bottom',
  },
  {
    target: '[data-tour="shortcuts"]',
    title: 'Keyboard Shortcuts',
    description:
      'Use keyboard shortcuts for faster interaction. Press ? to see all available shortcuts.',
    icon: <Keyboard className="h-4 w-4" />,
    position: 'bottom',
  },
];

const TOUR_DISMISSED_KEY = 'rag-product-tour-dismissed';

export function ProductTour() {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(TOUR_DISMISSED_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => {
        setCurrentStep(0);
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setCurrentStep(-1);
    localStorage.setItem(TOUR_DISMISSED_KEY, 'true');
  }, []);

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      dismiss();
    }
  }, [currentStep, dismiss]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  if (!isVisible || currentStep < 0 || currentStep >= TOUR_STEPS.length) {
    return null;
  }

  const step = TOUR_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 pointer-events-auto cursor-default"
        onClick={dismiss}
        aria-label="Dismiss tour"
      />

      {/* Tour tooltip positioned at center of screen for simplicity */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-[101]">
        <Card className="w-96 shadow-2xl border-primary/20 bg-background">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Step {currentStep + 1} of {TOUR_STEPS.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={`dot-${String(i)}`}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentStep ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="ghost" size="sm" onClick={prev}>
                    Back
                  </Button>
                )}
                <Button size="sm" onClick={next}>
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Hook to check if the product tour should be shown.
 * Returns true if the tour hasn't been dismissed yet.
 */
export function useShouldShowTour(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(TOUR_DISMISSED_KEY);
}

/**
 * Reset the product tour so it shows again on next visit.
 */
export function resetProductTour(): void {
  localStorage.removeItem(TOUR_DISMISSED_KEY);
}
