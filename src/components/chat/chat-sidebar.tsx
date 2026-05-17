'use client';

import { FolderOpen, History } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { DocumentListProps } from '../documents/document-list';
import { DocumentList } from '../documents/document-list';
import type { ConversationHistoryListProps } from './conversation-history-list';
import { ConversationHistoryList } from './conversation-history-list';

interface ChatSidebarProps {
  documentListProps: DocumentListProps;
  historyListProps: ConversationHistoryListProps;
  className?: string;
}

export function ChatSidebar({ documentListProps, historyListProps, className }: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'history'>('knowledge');

  return (
    <section
      className={cn(
        'flex h-full flex-col border-r border-border/50 bg-background/60 shadow-xl backdrop-blur-xl',
        className
      )}
      aria-label="Chat sidebar"
    >
      {/* Animated tab toggle */}
      <div className="p-3 border-b border-border/50">
        <div className="relative flex items-center rounded-xl bg-muted/50 p-1 border border-white/5">
          {/* Sliding background pill — CSS transition instead of framer-motion spring */}
          <div
            className="absolute inset-y-1 rounded-lg bg-primary/20 border border-primary/40 shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)] transition-all duration-200 ease-out"
            style={{
              width: 'calc(50% - 4px)',
              left: activeTab === 'knowledge' ? '4px' : 'calc(50%)',
            }}
          />

          {/* Knowledge Base button */}
          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              activeTab === 'knowledge'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground/80'
            )}
          >
            <FolderOpen
              className={cn('h-3.5 w-3.5', activeTab === 'knowledge' && 'text-primary')}
            />
            Knowledge Base
          </button>

          {/* Chat History button */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-colors',
              activeTab === 'history'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground/80'
            )}
          >
            <History className={cn('h-3.5 w-3.5', activeTab === 'history' && 'text-primary')} />
            Chat History
          </button>
        </div>
      </div>

      {/* Content area with CSS fade-slide transition */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div
          key={activeTab}
          className="h-full animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {activeTab === 'knowledge' ? (
            <DocumentList {...documentListProps} />
          ) : (
            <ConversationHistoryList {...historyListProps} />
          )}
        </div>
      </div>
    </section>
  );
}

export default ChatSidebar;
