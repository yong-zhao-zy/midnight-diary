"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, LogOut } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { fetchDiaries, type DiaryRow } from "@/lib/diary-service";
import { ResponseLetter, DiaryDetail } from "@/components/diary/ResponseLetter";

export default function Home() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryRow[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<DiaryRow | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchDiaries().then(setEntries);
  }, []);

  // Lock body scroll when drawer is open
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

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-glow-gold">Midnight Diary</h1>
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

        {/* Diary Feed */}
        {mounted && entries.length === 0 && (
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

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <DiaryDetail entry={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

      {/* FAB */}
      <Link
        href="/write"
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </Link>
    </main>
  );
}
