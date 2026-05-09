'use client';

import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

// =============================================================================
// Delete Button with confirmation
// =============================================================================

export function DeleteButton({ documentId }: { documentId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isDeleting}
      className="inline-flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Delete document"
      onClick={() => {
        if (
          window.confirm(
            'Are you sure you want to delete this document? This action cannot be undone.'
          )
        ) {
          setIsDeleting(true);
          fetch(`/api/ingest?id=${documentId}`, { method: 'DELETE' })
            .then((res) => {
              if (res.ok) {
                toast.success('Document deleted');
                router.refresh();
              } else {
                toast.error('Failed to delete document');
              }
            })
            .catch(() => toast.error('Failed to delete document'))
            .finally(() => setIsDeleting(false));
        }
      }}
    >
      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}

// =============================================================================
// Re-ingest Button for failed documents
// =============================================================================

export function ReingestButton({ documentId }: { documentId: string }) {
  const [isReingesting, setIsReingesting] = useState(false);
  const router = useRouter();

  const handleReingest = async () => {
    setIsReingesting(true);
    try {
      const res = await fetch(`/api/ingest?id=${documentId}`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        const userId = data?.data?.userId;
        if (userId) {
          await fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              action: 'retry',
            }),
          });
        }
        toast.success('Re-ingestion started');
        router.refresh();
      }
    } catch (_error: unknown) {
      toast.error('Failed to re-ingest document');
    } finally {
      setIsReingesting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isReingesting}
      className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Re-ingest document"
      onClick={handleReingest}
    >
      {isReingesting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      {isReingesting ? 'Re-ingesting...' : 'Re-ingest'}
    </button>
  );
}
