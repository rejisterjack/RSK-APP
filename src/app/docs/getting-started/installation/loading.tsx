import { Skeleton } from '@/components/ui/skeleton';

export default function DocsInstallationLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
