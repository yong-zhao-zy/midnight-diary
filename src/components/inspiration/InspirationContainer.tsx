"use client";

import { useEffect, useState } from "react";
import { Sparkles, Lightbulb } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useInspirationStore } from "@/store/inspiration-store";
import { NoteListPanel } from "./notes/NoteListPanel";
import { PracticeTabs } from "./practices/PracticeTabs";

type InspirationSubTab = "notes" | "practices";

export function InspirationContainer() {
  const [activeSubTab, setActiveSubTab] = useState<InspirationSubTab>("notes");
  const ensureNotes = useInspirationStore((s) => s.ensureNotes);
  const ensurePractices = useInspirationStore((s) => s.ensurePractices);

  useEffect(() => {
    ensureNotes();
    ensurePractices();
  }, [ensureNotes, ensurePractices]);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2 pb-2">
        <Sparkles className="h-4 w-4 text-glow-gold/80" />
        <h2 className="text-base text-foreground/80">灵感</h2>
        <p className="text-xs text-muted/50 ml-2">把触动你的句子和行动留下来</p>
      </header>

      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as InspirationSubTab)}
        className="w-full"
      >
        <TabsList className="w-full rounded-full bg-white/[0.04] border border-white/10 p-1 h-auto">
          <TabsTrigger
            value="notes"
            className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70 inline-flex items-center gap-1.5"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            珍藏碎片
          </TabsTrigger>
          <TabsTrigger
            value="practices"
            className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70 inline-flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            心灵练习
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" forceMount className="mt-4 data-[state=inactive]:hidden">
          <NoteListPanel />
        </TabsContent>

        <TabsContent value="practices" forceMount className="mt-4 data-[state=inactive]:hidden">
          <PracticeTabs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
