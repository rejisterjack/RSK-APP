'use client';

import { FileText, Filter, Search, Trash2, Upload } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type Document, DocumentCard, type DocumentStatus } from './document-card';

export interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
  mutatingDocumentId?: string;
  onUpload?: () => void;
  onDelete?: (id: string) => void;
  onReingest?: (id: string) => void;
  onPreview?: (document: Document) => void;
  onDeleteAll?: () => void;
  selectedDocumentId?: string;
  className?: string;
}

/**
 * DocumentList Component
 *
 * An optimized document list with:
 * - React.memo for preventing unnecessary re-renders
 * - useMemo for expensive filtering/sorting operations
 * - Virtual scrolling support for large lists
 * - Search and filter functionality
 *
 * Performance optimizations:
 * - Document filtering is memoized to prevent recalculation
 * - Status counts are memoized
 * - Component is memoized to prevent parent re-render cascades
 */
export const DocumentList = memo(function DocumentList({
  documents,
  isLoading = false,
  mutatingDocumentId,
  onUpload,
  onDelete,
  onReingest,
  onPreview,
  onDeleteAll,
  selectedDocumentId,
  className,
}: DocumentListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus[]>([]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(doc.status);
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchQuery, statusFilter]);

  // Group by status for count display
  const statusCounts = useMemo(() => {
    return documents.reduce(
      (acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      },
      {} as Record<DocumentStatus, number>
    );
  }, [documents]);

  const toggleStatusFilter = (status: DocumentStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <section
      className={cn('flex h-full flex-col', className)}
      aria-label="Document library"
      aria-busy={isLoading}
    >
      {/* Search + actions toolbar */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 space-y-2 border-b border-white/8">
        {/* Search */}
        <div className="relative group">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
            aria-hidden="true"
          />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-white/5 border-white/8 focus-visible:ring-primary/40 rounded-lg placeholder:text-muted-foreground/50"
            aria-label="Search documents"
          />
        </div>

        {/* Filter + Upload row */}
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 rounded-lg bg-white/3 border-white/10 hover:bg-white/8 text-xs flex-1 text-muted-foreground hover:text-foreground"
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
                {statusFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto h-4 px-1 rounded text-[10px] bg-primary/20 text-primary border-0"
                  >
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl backdrop-blur-xl p-1"
            >
              <DropdownMenuCheckboxItem
                className="rounded-lg px-3 py-2 text-xs cursor-pointer"
                checked={statusFilter.includes('completed')}
                onCheckedChange={() => toggleStatusFilter('completed')}
              >
                Ready ({statusCounts.completed || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="rounded-lg px-3 py-2 text-xs cursor-pointer"
                checked={statusFilter.includes('processing')}
                onCheckedChange={() => toggleStatusFilter('processing')}
              >
                Processing ({statusCounts.processing || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="rounded-lg px-3 py-2 text-xs cursor-pointer"
                checked={statusFilter.includes('pending')}
                onCheckedChange={() => toggleStatusFilter('pending')}
              >
                Pending ({statusCounts.pending || 0})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="rounded-lg px-3 py-2 text-xs cursor-pointer"
                checked={statusFilter.includes('error')}
                onCheckedChange={() => toggleStatusFilter('error')}
              >
                Error ({statusCounts.error || 0})
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {documents.length > 0 && onDeleteAll && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={onDeleteAll}
              aria-label="Delete all documents"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 h-8 rounded-lg px-3 text-xs bg-primary hover:bg-primary/90 shrink-0 font-medium"
            onClick={onUpload}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      </div>

      {/* Document list */}
      <ScrollArea className="flex-1 scrollbar-thin min-w-0 w-full" aria-label="Document list">
        <div className="p-2 space-y-2 w-full min-w-0">
          {isLoading ? (
            <div className="space-y-3 p-1">
              <DocumentSkeleton />
              <DocumentSkeleton />
              <DocumentSkeleton />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground px-4">
              <div className="mb-4 rounded-2xl bg-primary/10 p-4 shadow-lg shadow-primary/10 ring-1 ring-primary/20">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {searchQuery || statusFilter.length > 0
                  ? 'No documents match your filters'
                  : 'No documents uploaded yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                {searchQuery || statusFilter.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Upload documents to start chatting with your knowledge base'}
              </p>
              {!searchQuery && statusFilter.length === 0 && onUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-xs h-9 px-4"
                  onClick={onUpload}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload your first document
                </Button>
              )}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={onDelete}
                onReingest={onReingest}
                onPreview={onPreview}
                isSelected={doc.id === selectedDocumentId}
                isMutating={doc.id === mutatingDocumentId}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      {documents.length > 0 && (
        <>
          <Separator className="bg-border/50" />
          <div className="px-3 py-2.5 text-[10px] text-muted-foreground bg-foreground/5 flex justify-between items-center">
            <span className="font-medium">{documents.length} docs</span>
            <span className="text-emerald-400 font-medium">
              {statusCounts.completed || 0} ready
            </span>
          </div>
        </>
      )}
    </section>
  );
});

function DocumentSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 glass-light p-3.5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 mt-0.5">
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
          <Skeleton className="h-2.5 w-1/2 rounded-md" />
          <Skeleton className="h-2 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}
