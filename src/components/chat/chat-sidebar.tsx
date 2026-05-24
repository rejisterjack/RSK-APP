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
      className={cn('flex h-full flex-col overflow-hidden', className)}
      aria-label="Chat sidebar"
    >
      {/* Tab toggle */}
      <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-white/8">
        <div className="relative flex items-center rounded-xl bg-white/5 p-1 border border-white/8 gap-0">
          {/* Sliding active pill */}
          <div
            className="absolute inset-y-1 rounded-lg bg-primary/20 border border-primary/30 transition-all duration-200 ease-out"
            style={{
              width: 'calc(50% - 4px)',
              left: activeTab === 'knowledge' ? '4px' : 'calc(50%)',
            }}
            aria-hidden="true"
          />

          {/* Knowledge Base tab */}
          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            aria-selected={activeTab === 'knowledge'}
            role="tab"
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-1 py-2 px-1 text-[11px] font-semibold rounded-lg transition-colors duration-150 min-w-0',
              activeTab === 'knowledge'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Knowledge Base</span>
          </button>

          {/* Chat History tab */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            aria-selected={activeTab === 'history'}
            role="tab"
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-1 py-2 px-1 text-[11px] font-semibold rounded-lg transition-colors duration-150 min-w-0',
              activeTab === 'history'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <History className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Chat History</span>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          key={activeTab}
          className="h-full animate-in fade-in slide-in-from-bottom-1 duration-150"
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
