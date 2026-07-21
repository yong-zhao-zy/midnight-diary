import { Skeleton } from "@/components/ui/skeleton";

export function NoteListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-2 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="h-2 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
