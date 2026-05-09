'use client';

import { memo } from 'react';
import { MessageInput } from './message-input';

interface ChatInputAreaProps {
  hasMessages: boolean;
  isLoading: boolean;
  isStreaming: boolean;
  onSendMessage: (message: string, files?: File[]) => void;
}

export const ChatInputArea = memo(function ChatInputArea({
  hasMessages,
  isLoading,
  isStreaming,
  onSendMessage,
}: ChatInputAreaProps) {
  return (
    <div className="flex justify-center px-3 py-3 md:px-4 md:py-3 shrink-0 sticky bottom-0 z-20 bg-gradient-to-t from-background via-background/95 to-background/80 backdrop-blur-xl border-t border-white/5">
      <MessageInput
        onSend={onSendMessage}
        isLoading={isLoading || isStreaming}
        disabled={isLoading}
        placeholder={
          hasMessages ? 'Send a message...' : 'Ask anything... or try a suggestion above'
        }
        className="w-full max-w-4xl"
      />
    </div>
  );
});
