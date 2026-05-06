'use client';

import { ChevronRight, FileText, Highlighter } from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { CitationCard, type Source } from './citations';

interface SourcesPanelProps {
  sources: Source[];
  isOpen: boolean;
  onClose: () => void;
  onSourceClick?: (source: Source) => void;
  className?: string;
}

export function SourcesPanel({
  sources,
  isOpen,
  onClose,
  onSourceClick,
  className,
}: SourcesPanelProps) {
  const isMobile = useIsMobile();

  // Group sources by document
  const groupedSources = React.useMemo(() => {
    const groups: Record<string, Source[]> = {};
    sources.forEach((source) => {
      if (!groups[source.documentName]) {
        groups[source.documentName] = [];
      }
      groups[source.documentName].push(source);
    });
    return groups;
  }, [sources]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isMobile ? (
        /* ── Mobile: bottom sheet ──────────────────────────────── */
        <SheetContent
          side="bottom"
          className={cn('h-[60vh] rounded-t-2xl p-0 flex flex-col', className)}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          </div>
          <SheetHeader className="space-y-2.5 px-4 pb-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Sources ({sources.length})
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <SourcesContent
              sources={sources}
              groupedSources={groupedSources}
              onSourceClick={onSourceClick}
            />
          </ScrollArea>
        </SheetContent>
      ) : (
        /* ── Desktop: right sheet ──────────────────────────────── */
        <SheetContent
          side="right"
          className={cn('w-full sm:max-w-md p-0 flex flex-col', className)}
        >
          <SheetHeader className="space-y-2.5 pb-4 px-4 pt-4">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sources ({sources.length})
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1">
            <SourcesContent
              sources={sources}
              groupedSources={groupedSources}
              onSourceClick={onSourceClick}
            />
          </ScrollArea>
        </SheetContent>
      )}
    </Sheet>
  );
}

/** Shared content rendered inside both mobile and desktop sheet variants */
function SourcesContent({
  sources,
  groupedSources,
  onSourceClick,
}: {
  sources: Source[];
  groupedSources: Record<string, Source[]>;
  onSourceClick?: (source: Source) => void;
}) {
  if (sources.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <FileText className="mb-2 h-12 w-12 opacity-20" />
        <p>No sources available</p>
        <p className="text-sm">Sources will appear here when the assistant references documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-4">
      {/* Summary */}
      <div className="rounded-lg bg-muted p-3">
        <p className="text-sm text-muted-foreground">
          Found {sources.length} relevant passages from {Object.keys(groupedSources).length}{' '}
          documents
        </p>
      </div>

      <Separator />

      {/* Sources by document */}
      {Object.entries(groupedSources).map(([docName, docSources]) => (
        <div key={docName} className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium truncate">{docName}</h4>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {docSources.length}
            </Badge>
          </div>

          <div className="space-y-2 pl-6">
            {docSources.map((source) => (
              <CitationCard
                key={source.id}
                source={source}
                onClick={() => onSourceClick?.(source)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Alternative inline panel version (desktop only)
interface InlineSourcesPanelProps {
  sources: Source[];
  isCollapsed: boolean;
  onToggle: () => void;
  onSourceClick?: (source: Source) => void;
  className?: string;
}

export function InlineSourcesPanel({
  sources,
  isCollapsed,
  onToggle,
  onSourceClick,
  className,
}: InlineSourcesPanelProps) {
  if (isCollapsed) {
    return (
      <div className={cn('border-l bg-muted/30 w-12 flex flex-col items-center py-4', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="min-h-[44px] min-w-[44px]"
          aria-label="Expand sources panel"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        {sources.length > 0 && (
          <Badge
            variant="secondary"
            className="mt-2 text-[10px] h-5 w-5 p-0 flex items-center justify-center"
          >
            {sources.length}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn('border-l bg-muted/30 w-80 flex flex-col', className)}>
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Highlighter className="h-4 w-4" />
          Sources ({sources.length})
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="min-h-[44px] min-w-[44px]"
          aria-label="Collapse sources panel"
        >
          <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sources to display</p>
          ) : (
            sources.map((source) => (
              <CitationCard
                key={source.id}
                source={source}
                onClick={() => onSourceClick?.(source)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
