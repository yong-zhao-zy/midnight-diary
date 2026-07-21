"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInspirationStore } from "@/store/inspiration-store";
import { PracticeItem } from "./PracticeItem";

function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TodayPracticeListProps {
  onComplete: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function TodayPracticeList({ onComplete, onDelete }: TodayPracticeListProps) {
  const practicesActive = useInspirationStore((s) => s.practicesActive);
  const todayCheckedIds = useInspirationStore((s) => s.todayCheckedIds);
  const toggleCheckin = useInspirationStore((s) => s.toggleCheckin);

  const { pending, done } = useMemo(() => {
    const pending = practicesActive.filter((p) => !todayCheckedIds.has(p.id));
    const done = practicesActive.filter((p) => todayCheckedIds.has(p.id));
    return { pending, done };
  }, [practicesActive, todayCheckedIds]);

  const handleToggle = (id: string) => {
    void toggleCheckin(id, todayLocalStr());
  };

  if (practicesActive.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* 待完成 */}
      <section className="space-y-2">
        <h3 className="text-xs text-muted/50 px-1">
          今日待完成 · {pending.length}
        </h3>
        {pending.length === 0 ? (
          <p className="text-center py-6 text-xs text-muted/40">
            今日都已打卡
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {pending.map((p) => (
              <motion.div
                key={p.id}
                layoutId={`practice-${p.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
              >
                <PracticeItem
                  practice={p}
                  isChecked={false}
                  onToggleCheck={handleToggle}
                  onComplete={onComplete}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>

      {/* 已完成 */}
      {done.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs text-muted/50 px-1">
            今日已完成 · {done.length}
          </h3>
          <AnimatePresence mode="popLayout">
            {done.map((p) => (
              <motion.div
                key={p.id}
                layoutId={`practice-${p.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
              >
                <PracticeItem
                  practice={p}
                  isChecked={true}
                  onToggleCheck={handleToggle}
                  onComplete={onComplete}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
