import { Skeleton } from "@/components/ui/skeleton"

export function DiaryListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-12 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-1.5 pt-1">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-2 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}
