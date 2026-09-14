import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DiaryBrowseContent } from "./DiaryBrowseContent";

export default function DiaryBrowsePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-glow-gold" />
        </main>
      }
    >
      <DiaryBrowseContent />
    </Suspense>
  );
}
