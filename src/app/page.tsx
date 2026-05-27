"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { fetchDiaries, getTodayDiary, getDiaryCount, type DiaryRow } from "@/lib/diary-service";
import { ResponseLetter, DiaryDetail } from "@/components/diary/ResponseLetter";
import { IntroOverlay } from "@/components/IntroOverlay";

export default function Home() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryRow[]>([]);
  const [selected, setSelected] = useState<DiaryRow | null>(null);
  const [fabLoading, setFabLoading] = useState(false);

  // Database-driven intro state: null = loading, true/false = resolved
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // Fetch diary count first to determine intro vs content
    getDiaryCount().then((count) => {
      setShowIntro(count === 0);
      // Then load full entries (only needed if count > 0, but fetch anyway for seamless transition)
      fetchDiaries().then(setEntries);
    });
  }, []);

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleNewDiary = async () => {
    if (fabLoading) return;
    setFabLoading(true);

    try {
      const existing = await getTodayDiary();
      if (existing) {
        router.push(`/write?id=${existing.id}`);
      } else {
        router.push("/write");
      }
    } catch {
      router.push("/write");
    } finally {
      setFabLoading(false);
    }
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleEntryUpdated = (updated: DiaryRow) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
    setSelected(updated);
  };

  const latestId = entries[0]?.id;

  // Loading state — prevent content flash before DB query resolves
  if (showIntro === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-glow-gold/60" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <header className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-glow-gold">深空回响</h1>
            <p className="text-sm text-muted">你的深夜回响</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            title="退出登录"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        {!showIntro && entries.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <p className="text-muted">还没有任何记录</p>
            <p className="text-sm text-muted/60">点击右下角开始第一篇日记</p>
          </div>
        )}

        <div className="space-y-4 pb-24">
          {entries.map((entry) => (
            <ResponseLetter
              key={entry.id}
              entry={entry}
              onClick={() => setSelected(entry)}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <DiaryDetail
            entry={selected}
            isLatest={selected.id === latestId}
            onClose={() => setSelected(null)}
            onEntryUpdated={handleEntryUpdated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIntro && (
          <IntroOverlay onComplete={handleIntroComplete} />
        )}
      </AnimatePresence>

      {/* FAB with smart routing */}
      <button
        onClick={handleNewDiary}
        disabled={fabLoading}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-transform"
      >
        {fabLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        )}
      </button>
    </main>
  );
}
