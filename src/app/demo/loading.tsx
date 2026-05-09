import { Skeleton } from '@/components/ui/skeleton';

export default function DemoLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <Skeleton className="h-8 w-64 mx-auto" />
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
