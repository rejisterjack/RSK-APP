'use client';

import { Loader2, Paperclip, Send, X } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// File upload constraints
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_COUNT = 10;
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

interface MessageInputProps {
  onSend: (message: string, files?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const MessageInput = memo(function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  isLoading = false,
  placeholder = 'Send a message...',
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 160);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Resize on message change
  // biome-ignore lint/correctness/useExhaustiveDependencies: message triggers resize
  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, message]);

  const handleSubmit = useCallback(() => {
    if (!message.trim() && files.length === 0) return;
    if (disabled || isLoading || isSubmitting) return;

    setIsSubmitting(true);
    onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage('');
    setFiles([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    // Release submit guard after a tick
    requestAnimationFrame(() => setIsSubmitting(false));
  }, [message, files, disabled, isLoading, isSubmitting, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} exceeds 50MB limit`;
    }
    if (ALLOWED_FILE_TYPES.size > 0 && !ALLOWED_FILE_TYPES.has(file.type) && file.type !== '') {
      return `${file.name}: unsupported file type (${file.type || 'unknown'})`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);

      if (files.length + selectedFiles.length > MAX_FILE_COUNT) {
        toast.error(`Maximum ${MAX_FILE_COUNT} files allowed`);
        e.target.value = '';
        return;
      }

      const validFiles: File[] = [];
      for (const file of selectedFiles) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
      e.target.value = ''; // Reset input
    },
    [files.length, validateFile]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Debounced typing indicator
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (message.length > 0) {
      onTyping?.(true);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping?.(false);
      }, 1000);
    } else {
      onTyping?.(false);
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, onTyping]);

  const hasContent = message.trim().length > 0 || files.length > 0;

  return (
    <div className={cn('w-full', className)}>
      {/* File attachments */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((file, fileIndex) => (
            <Badge
              key={`${file.name}-${file.size}-${file.lastModified}`}
              variant="secondary"
              className="flex items-center gap-1.5 pr-1 text-xs glass-light border-white/10"
            >
              <Paperclip className="h-3 w-3 text-primary" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 rounded-full p-0 hover:bg-destructive/20 hover:text-destructive transition-colors"
                onClick={() => removeFile(fileIndex)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input area */}
      <form
        className="relative flex items-end gap-2 rounded-2xl glass-panel border border-white/10 p-2 focus-within:border-primary/30 focus-within:shadow-lg focus-within:shadow-primary/10 transition-all"
        aria-label="Chat message input"
      >
        {/* File attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl min-h-[44px] min-w-[44px] h-11 w-11 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          disabled={disabled || isLoading}
          aria-label="Attach file"
          asChild
        >
          <label className="cursor-pointer">
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.html,.xls,.xlsx"
              onChange={handleFileSelect}
              disabled={disabled || isLoading}
              aria-label="File upload"
            />
          </label>
        </Button>

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent px-2 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
          aria-label="Message input"
        />

        {/* Send button */}
        <Button
          onClick={handleSubmit}
          disabled={!hasContent || disabled || isLoading || isSubmitting}
          size="icon"
          className={cn(
            'shrink-0 rounded-xl min-h-[44px] min-w-[44px] h-11 w-11 transition-all',
            hasContent && !disabled && !isLoading
              ? 'bg-gradient-to-br from-primary to-purple-500 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105'
              : 'bg-muted text-muted-foreground'
          )}
          aria-label={isLoading ? 'Sending message' : 'Send message'}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </form>
    </div>
  );
});
