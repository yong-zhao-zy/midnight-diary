"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useInspirationStore } from "@/store/inspiration-store";
import type { PracticeRow } from "@/lib/practice-service";
import { TodayPracticeList } from "./TodayPracticeList";
import { HistoryPracticeList } from "./HistoryPracticeList";
import { PracticeListForCalendar } from "./PracticeListForCalendar";
import { PracticeEmptyState } from "./PracticeEmptyState";
import { PracticeListSkeleton } from "./PracticeListSkeleton";
import { PracticeEditorSheet } from "./PracticeEditorSheet";
import { useToast } from "../common/Toast";

type PracticeSubTab = "checkin" | "view";

export function PracticeTabs() {
  const practicesActive = useInspirationStore((s) => s.practicesActive);
  const practicesCompleted = useInspirationStore((s) => s.practicesCompleted);
  const practicesFetchedAt = useInspirationStore((s) => s.practicesFetchedAt);
  const completePractice = useInspirationStore((s) => s.completePractice);
  const removePractice = useInspirationStore((s) => s.removePractice);
  const { showToast, ToastElement } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<PracticeSubTab>("checkin");
  const [editorOpen, setEditorOpen] = useState(false);
  const [practiceToEdit, setPracticeToEdit] = useState<PracticeRow | null>(null);

  const openEditorForNew = () => {
    setPracticeToEdit(null);
    setEditorOpen(true);
  };

  const handleComplete = async (id: string) => {
    const ok = await completePractice(id);
    if (ok) {
      showToast("已完结");
    } else {
      showToast("操作失败");
    }
    return ok;
  };

  const handleDelete = async (id: string) => {
    const ok = await removePractice(id);
    if (ok) {
      showToast("已删除");
    } else {
      showToast("删除失败");
    }
    return ok;
  };

  // Loading state
  if (practicesFetchedAt === null) {
    return <PracticeListSkeleton />;
  }

  // Empty state (no active + no completed)
  if (practicesActive.length === 0 && practicesCompleted.length === 0) {
    return (
      <>
        <PracticeEmptyState onManualAdd={openEditorForNew} />
        <PracticeEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          practiceToEdit={practiceToEdit}
        />
        {ToastElement}
      </>
    );
  }

  return (
    <>
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as PracticeSubTab)}
        className="w-full"
      >
        <TabsList className="w-full rounded-full bg-white/[0.04] border border-white/10 p-1 h-auto mb-4">
          <TabsTrigger
            value="checkin"
            className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70"
          >
            打卡
          </TabsTrigger>
          <TabsTrigger
            value="view"
            className="flex-1 rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-glow-gold/90 data-[state=active]:text-midnight data-[state=active]:shadow-none text-muted/70"
          >
            打卡查看
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkin" forceMount className="data-[state=inactive]:hidden">
          <div className="space-y-6 pb-20">
            <TodayPracticeList
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
            <HistoryPracticeList onDelete={handleDelete} />
          </div>

          {/* FAB for manual add (only on checkin tab) */}
          {activeSubTab === "checkin" && (
            <button
              onClick={openEditorForNew}
              className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-glow-gold shadow-lg shadow-glow-gold/25 text-midnight hover:scale-105 active:scale-95 transition-transform z-40"
              aria-label="新增练习"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </TabsContent>

        <TabsContent value="view" forceMount className="data-[state=inactive]:hidden">
          <PracticeListForCalendar />
        </TabsContent>
      </Tabs>

      <PracticeEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        practiceToEdit={practiceToEdit}
      />
      {ToastElement}
    </>
  );
}
