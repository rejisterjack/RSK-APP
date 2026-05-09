'use client';

import { FileText, Loader2, MessageSquare, Sparkles, Upload, Zap } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void;
  onUploadClick?: () => void;
  onFilesDrop?: (files: File[]) => void;
  className?: string;
}

const SUGGESTED_QUESTIONS = [
  'What can you help me with?',
  'How do I upload documents?',
  'Summarize my uploaded documents',
  'What is RAG technology?',
];

const QUICK_ACTIONS: Array<{
  icon: typeof FileText;
  label: string;
  description: string;
  action?: 'upload';
  message?: string;
  gradient: string;
  shadow: string;
}> = [
  {
    icon: FileText,
    label: 'Upload PDF',
    description: 'Add to knowledge base',
    action: 'upload',
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-500/20',
  },
  {
    icon: MessageSquare,
    label: 'Start Chat',
    description: 'Ask about documents',
    message: 'What can you help me with?',
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/20',
  },
  {
    icon: Zap,
    label: 'Quick Summary',
    description: 'Summarize all docs',
    message: 'Summarize my uploaded documents',
    gradient: 'from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/20',
  },
];

export const EmptyState = memo(function EmptyState({
  onSuggestionClick,
  onUploadClick,
  onFilesDrop,
  className,
}: EmptyStateProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesDrop?.(files);
      } else {
        onUploadClick?.();
      }
    },
    [onUploadClick, onFilesDrop]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleAction = useCallback(
    (key: string, handler?: () => void) => {
      if (activeAction) return;
      setActiveAction(key);
      handler?.();
      setTimeout(() => setActiveAction(null), 2000);
    },
    [activeAction]
  );

  return (
    <section
      className={cn('flex flex-col items-center justify-center p-4 max-w-xl mx-auto', className)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      aria-label="Empty state"
    >
      <div className="w-full text-center">
        {/* Welcome header */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/25 mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold tracking-tight">
            <span className="text-gradient">Welcome to RAG Chat</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload documents and ask questions from your knowledge base.
          </p>
        </div>

        {/* Quick actions */}
        <div className="mb-5 grid gap-3 grid-cols-3">
          {QUICK_ACTIONS.map((action) => {
            const actionKey =
              action.action === 'upload' ? 'upload' : (action.message ?? action.label);
            const isActive = activeAction === actionKey;
            return (
              <button
                type="button"
                key={action.label}
                disabled={!!activeAction}
                className={cn(
                  'group flex flex-col items-center p-4 rounded-2xl glass-panel border border-white/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all cursor-pointer text-center min-h-[110px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed',
                  isActive && 'border-primary/40 shadow-lg shadow-primary/10'
                )}
                aria-label={`${action.label}: ${action.description}`}
                onClick={() =>
                  handleAction(
                    actionKey,
                    action.action === 'upload'
                      ? onUploadClick
                      : action.message
                        ? () => onSuggestionClick?.(action.message ?? '')
                        : undefined
                  )
                }
              >
                <div
                  className={cn(
                    'mb-2.5 rounded-xl bg-gradient-to-br p-2 shadow-md transition-transform group-hover:scale-110',
                    action.gradient,
                    action.shadow
                  )}
                >
                  {isActive ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <action.icon className="h-4 w-4 text-white" />
                  )}
                </div>
                <span className="text-xs font-semibold text-foreground">{action.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {action.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Upload zone */}
        <button
          type="button"
          className="group mb-5 w-full rounded-2xl border border-dashed border-muted-foreground/20 glass-light p-5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10 cursor-pointer min-h-[90px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={activeAction === 'upload'}
          onClick={() => handleAction('upload', onUploadClick)}
          aria-label="Upload files to knowledge base"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mx-auto mb-2 transition-colors group-hover:bg-primary/20">
            {activeAction === 'upload' ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-primary" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground">
            {activeAction === 'upload' ? 'Opening...' : 'Drop files here or click to upload'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, TXT, and more</p>
        </button>

        {/* Suggested questions */}
        <div>
          <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Try asking
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                disabled={!!activeAction}
                className="rounded-full text-xs min-h-[44px] h-auto px-4 py-2 glass-light border-white/10 hover:border-primary/30 hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => handleAction(question, () => onSuggestionClick?.(question))}
              >
                {activeAction === question && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {question}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
