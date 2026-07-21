import { Skeleton } from "@/components/ui/skeleton";

export function PracticeListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-2 w-24 rounded-full" />
            <Skeleton className="h-2 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
