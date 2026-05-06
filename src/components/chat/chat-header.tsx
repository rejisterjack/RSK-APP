'use client';

import { ChevronDown, ChevronUp, History, Menu, PanelLeft, Plus, Settings } from 'lucide-react';
import { memo, useCallback } from 'react';
import { AgentModeToggleCompact } from '@/components/agent/agent-mode-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ApiKeySettings } from './api-key-settings';
import { useChatContext } from './chat-context';
import { KeyboardShortcutsTrigger } from './keyboard-shortcuts';
import { ModelPicker } from './model-picker';
import { ShareDialog } from './share-dialog';

interface ChatHeaderProps {
  selectedModel?: string;
  chatId?: string;
  chatTitle?: string;
  isStreaming: boolean;
  onNewChat?: () => void;
  onModelChange?: (modelId: string) => void;
  onAgentModeToggle?: (enabled: boolean) => void;
  onToggleMobileSidebar?: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  selectedModel = 'google/gemini-2.0-flash-exp:free',
  chatId,
  chatTitle,
  isStreaming,
  onNewChat,
  onModelChange,
  onAgentModeToggle,
  onToggleMobileSidebar,
}: ChatHeaderProps) {
  const { state, dispatch } = useChatContext();

  const handleAgentModeToggle = useCallback(
    (enabled: boolean) => {
      dispatch({ type: 'SET_AGENT_MODE', enabled });
      onAgentModeToggle?.(enabled);
    },
    [dispatch, onAgentModeToggle]
  );

  return (
    <header className="flex items-center justify-between border-b border-border/20 bg-white/5 backdrop-blur-sm relative z-30 h-12 md:h-12">
      {/* ── Left section ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Mobile hamburger (only on < md) */}
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
            onClick={onToggleMobileSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* History button */}
        <TooltipProvider delayDuration={0}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'min-h-[44px] min-w-[44px] rounded-full transition-colors',
              state.isHistoryPanelOpen
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            onClick={() => dispatch({ type: 'SET_HISTORY_PANEL_OPEN', open: true })}
            aria-label="Chat history"
            aria-expanded={state.isHistoryPanelOpen}
          >
            <History className="h-4 w-4" />
          </Button>
        </TooltipProvider>

        {/* New chat button */}
        {onNewChat && (
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3 md:px-4 min-h-[44px] h-auto text-xs"
            onClick={onNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        )}
      </div>

      {/* ── Center section (mobile title, hidden on desktop) ─────── */}
      <div className="md:hidden flex-1 text-center px-2">
        <p className="text-xs font-medium text-muted-foreground truncate max-w-[140px] mx-auto">
          {chatTitle || 'RAG Chat'}
        </p>
      </div>

      {/* ── Right section ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 md:gap-3">
        {/* Desktop-only: Model picker + Agent mode + API key */}
        <div className="hidden md:flex items-center gap-3">
          <ModelPicker
            selectedModel={selectedModel}
            onModelChange={onModelChange || (() => {})}
            disabled={isStreaming}
          />
          <AgentModeToggleCompact
            enabled={state.isAgentMode}
            onToggle={handleAgentModeToggle}
            disabled={isStreaming}
          />
          <ApiKeySettings />
          {chatId && <ShareDialog chatId={chatId} chatTitle={chatTitle || 'Chat'} />}
        </div>

        {/* Right controls group */}
        <div className="flex items-center gap-1 md:gap-2 bg-foreground/5 p-0.5 md:p-1 rounded-full border border-white/5 shadow-inner">
          {/* Desktop-only: Sources inline toggle */}
          <TooltipProvider delayDuration={0}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'hidden md:flex min-h-[44px] min-w-[44px] rounded-full transition-colors',
                !state.isSourcesInlineCollapsed
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
              onClick={() => dispatch({ type: 'TOGGLE_SOURCES_INLINE' })}
              aria-label="Toggle sources panel"
              aria-expanded={!state.isSourcesInlineCollapsed}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipProvider>

          <div className="w-px h-4 bg-border/40 hidden md:block mx-1" />

          <KeyboardShortcutsTrigger />

          {/* More toggle (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
            onClick={() => dispatch({ type: 'TOGGLE_MOBILE_MORE' })}
            aria-label="More options"
            aria-expanded={state.isMobileMoreOpen}
          >
            {state.isMobileMoreOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {/* Settings dropdown (always visible) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-full hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="glass-panel border-border/30 shadow-2xl rounded-2xl min-w-56 mt-3 p-2"
            >
              <DropdownMenuLabel className="font-bold text-foreground px-3 py-2">
                Preferences
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-default transition-colors font-medium">
                <span className="text-muted-foreground mr-1">Model:</span>{' '}
                {selectedModel.split('/').pop()?.replace(':free', '') || selectedModel}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-default transition-colors font-medium">
                <span className="text-muted-foreground mr-1">Temperature:</span> 0.7
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-default transition-colors font-medium">
                <span className="text-muted-foreground mr-1">Streaming:</span> Enabled
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Mobile "More" expandable row ─────────────────────────── */}
      {state.isMobileMoreOpen && (
        <div className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border/20 p-2 flex items-center gap-2 z-40 md:hidden">
          <ModelPicker
            selectedModel={selectedModel}
            onModelChange={onModelChange || (() => {})}
            disabled={isStreaming}
          />
          <AgentModeToggleCompact
            enabled={state.isAgentMode}
            onToggle={handleAgentModeToggle}
            disabled={isStreaming}
          />
          <ApiKeySettings />
          {chatId && <ShareDialog chatId={chatId} chatTitle={chatTitle || 'Chat'} />}
        </div>
      )}
    </header>
  );
});
