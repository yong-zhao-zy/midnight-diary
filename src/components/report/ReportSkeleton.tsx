import { Skeleton } from "@/components/ui/skeleton"

export function ReportSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex gap-2 pb-2 border-b border-white/8">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-2 py-2">
          {[0, 1, 2, 3, 4].map((j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
