'use client';

import { Bot, Square } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Markdown } from './markdown';

interface StreamingMessageProps {
  content: string;
  onCancel?: () => void;
  className?: string;
}

const MemoizedMarkdown = React.memo(function MemoizedMarkdown({ content }: { content: string }) {
  return <Markdown content={content} />;
});

export const StreamingMessage = React.memo(function StreamingMessage({
  content,
  onCancel,
  className,
}: StreamingMessageProps) {
  return (
    <div className={cn('mb-3 mr-auto max-w-3xl w-full', className)}>
      <div className="flex gap-2.5">
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center pt-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full shadow-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </div>
          {/* Animated indicator */}
          <div className="mt-2 flex gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-emerald-400">Assistant</span>
            <span className="text-xs text-muted-foreground/70">generating...</span>
          </div>

          {/* Message bubble */}
          <div className="glass-panel border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 min-w-[140px]">
            <div
              className="text-foreground/90 leading-relaxed prose prose-invert max-w-none text-sm"
              role="log"
              aria-live="polite"
              aria-label="Assistant response"
            >
              <MemoizedMarkdown content={content || '▌'} />
              {content && (
                <span
                  className="inline-block h-4 w-[2px] animate-pulse bg-primary align-middle"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {/* Cancel button */}
          {onCancel && (
            <div className="mt-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="gap-1.5 rounded-xl text-xs h-8 border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop generating
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
