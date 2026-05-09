'use client';

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Menu,
  PanelLeft,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
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
import { useFeatureLevel } from '@/hooks/use-feature-level';
import { cn } from '@/lib/utils';
import { useChatContext } from './chat-context';
import { KeyboardShortcutsTrigger } from './keyboard-shortcuts';
import { ModelPicker } from './model-picker';
import { ShareDialog } from './share-dialog';

interface ChatHeaderProps {
  selectedModel?: string;
  chatId?: string;
  chatTitle?: string;
  isStreaming: boolean;
  isNewChatLoading?: boolean;
  onNewChat?: () => void;
  onModelChange?: (modelId: string) => void;
  onAgentModeToggle?: (enabled: boolean) => void;
  onToggleMobileSidebar?: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  selectedModel = 'groq/llama-3.3-70b-versatile',
  chatId,
  chatTitle,
  isStreaming,
  isNewChatLoading = false,
  onNewChat,
  onModelChange,
  onAgentModeToggle,
  onToggleMobileSidebar,
}: ChatHeaderProps) {
  const { state, dispatch } = useChatContext();
  const { level, isFeatureVisible, unlockAdvanced } = useFeatureLevel();

  const handleAgentModeToggle = useCallback(
    (enabled: boolean) => {
      dispatch({ type: 'SET_AGENT_MODE', enabled });
      onAgentModeToggle?.(enabled);
    },
    [dispatch, onAgentModeToggle]
  );

  return (
    <header className="flex items-center justify-between border-b border-border/20 relative z-30 h-12 md:h-12 px-2 md:px-3">
      {/* ── Left section ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Mobile hamburger (only on < md) */}
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[40px] min-w-[40px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={onToggleMobileSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* New chat button */}
        {onNewChat && (
          <Button
            variant="default"
            size="sm"
            disabled={isNewChatLoading}
            className="gap-1.5 rounded-full shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-3.5 md:px-4 min-h-[40px] h-auto text-xs"
            onClick={onNewChat}
          >
            {isNewChatLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isNewChatLoading ? 'Creating...' : 'New Chat'}
            </span>
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
      <div className="flex items-center gap-1 md:gap-2">
        {/* Desktop-only: Model picker + Agent mode + Share */}
        <div className="hidden md:flex items-center gap-2">
          {isFeatureVisible(1) && (
            <ModelPicker
              selectedModel={selectedModel}
              onModelChange={onModelChange || (() => {})}
              disabled={isStreaming}
            />
          )}
          {isFeatureVisible(1) && (
            <AgentModeToggleCompact
              enabled={state.isAgentMode}
              onToggle={handleAgentModeToggle}
              disabled={isStreaming}
            />
          )}
          {chatId && isFeatureVisible(1) && (
            <ShareDialog chatId={chatId} chatTitle={chatTitle || 'Chat'} />
          )}
        </div>

        {/* Right controls group */}
        <div className="flex items-center gap-0.5 md:gap-1 bg-muted/40 p-0.5 md:p-1 rounded-2xl border border-white/5">
          {/* Desktop-only: Sources inline toggle */}
          <TooltipProvider delayDuration={0}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'hidden md:flex min-h-[40px] min-w-[40px] rounded-xl transition-colors',
                !state.isSourcesInlineCollapsed
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              onClick={() => dispatch({ type: 'TOGGLE_SOURCES_INLINE' })}
              aria-label="Toggle sources panel"
              aria-expanded={!state.isSourcesInlineCollapsed}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipProvider>

          <div className="w-px h-4 bg-border/40 hidden md:block mx-0.5" />

          <KeyboardShortcutsTrigger />

          {/* More toggle (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[40px] min-w-[40px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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

          {/* Settings dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="glass-panel border-border/30 shadow-2xl rounded-2xl min-w-56 mt-2 p-2"
            >
              <DropdownMenuLabel className="font-bold text-foreground px-3 py-2">
                Preferences
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/15 focus:text-primary cursor-default transition-colors font-medium">
                <span className="text-muted-foreground mr-1">Model:</span>{' '}
                {selectedModel.split('/').pop()?.replace(':free', '') || selectedModel}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/15 focus:text-primary cursor-default transition-colors font-medium">
                <span className="text-muted-foreground mr-1">Temperature:</span> 0.7
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/15 focus:text-primary cursor-default transition-colors font-medium">
                <span className="text-muted-foreground mr-1">Streaming:</span> Enabled
              </DropdownMenuItem>
              {level < 2 && (
                <>
                  <DropdownMenuSeparator className="bg-border/20" />
                  <DropdownMenuItem
                    className="rounded-xl px-3 py-2.5 focus:bg-primary/15 focus:text-primary cursor-pointer transition-colors font-medium"
                    onClick={unlockAdvanced}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
                    Show all features
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Mobile "More" expandable row ─────────────────────────── */}
      {state.isMobileMoreOpen && (
        <div className="absolute top-full left-0 right-0 glass-panel border-b border-border/20 p-2 flex items-center gap-2 z-40 md:hidden">
          {isFeatureVisible(1) && (
            <ModelPicker
              selectedModel={selectedModel}
              onModelChange={onModelChange || (() => {})}
              disabled={isStreaming}
            />
          )}
          {isFeatureVisible(1) && (
            <AgentModeToggleCompact
              enabled={state.isAgentMode}
              onToggle={handleAgentModeToggle}
              disabled={isStreaming}
            />
          )}
          {chatId && isFeatureVisible(1) && (
            <ShareDialog chatId={chatId} chatTitle={chatTitle || 'Chat'} />
          )}
        </div>
      )}
    </header>
  );
});
