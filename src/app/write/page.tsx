import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WriteContent } from "./WriteContent";

export default function WritePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-glow-gold" />
        </main>
      }
    >
      <WriteContent />
    </Suspense>
  );
}
