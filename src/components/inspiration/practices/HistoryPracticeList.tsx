"use client";

import { useInspirationStore } from "@/store/inspiration-store";
import { PracticeItem } from "./PracticeItem";

interface HistoryPracticeListProps {
  onDelete: (id: string) => Promise<boolean>;
}

export function HistoryPracticeList({ onDelete }: HistoryPracticeListProps) {
  const practicesCompleted = useInspirationStore((s) => s.practicesCompleted);

  if (practicesCompleted.length === 0) {
    return (
      <p className="text-center py-8 text-xs text-muted/40">
        还没有已完结的练习
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs text-muted/50 px-1">
        历史已完结 · {practicesCompleted.length}
      </h3>
      {practicesCompleted.map((p) => (
        <PracticeItem
          key={p.id}
          practice={p}
          isChecked={false}
          onToggleCheck={() => {}}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
