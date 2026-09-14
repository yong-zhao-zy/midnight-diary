"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useFoodStore } from "@/store/food-store";
import { todayShanghaiStr } from "@/lib/date-utils";
import type { BodyMetricRow } from "@/lib/body-metric-service";

interface BodyMetricEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: BodyMetricRow | null;
}

const FIELDS: { key: keyof BodyMetricRow; label: string; placeholder: string }[] = [
  { key: "weight_kg", label: "体重 (kg)", placeholder: "如 65.0" },
  { key: "body_fat_pct", label: "体脂率 (%)", placeholder: "如 22.0" },
  { key: "waist_cm", label: "腰围 (cm)", placeholder: "如 80.0" },
  { key: "hip_cm", label: "臀围 (cm)", placeholder: "如 95.0" },
  { key: "chest_cm", label: "胸围 (cm)", placeholder: "如 90.0" },
  { key: "left_arm_cm", label: "左臂围 (cm)", placeholder: "如 28.0" },
  { key: "right_arm_cm", label: "右臂围 (cm)", placeholder: "如 28.0" },
  { key: "left_thigh_cm", label: "左大腿围 (cm)", placeholder: "如 52.0" },
  { key: "right_thigh_cm", label: "右大腿围 (cm)", placeholder: "如 52.0" },
];

export function BodyMetricEditorSheet({ open, onOpenChange, editTarget }: BodyMetricEditorSheetProps) {
  const saveBodyMetric = useFoodStore((s) => s.saveBodyMetric);
  const [date, setDate] = useState(todayShanghaiStr());
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (open) {
      setToast("");
      if (editTarget) {
        setDate(editTarget.log_date);
        setNote(editTarget.note ?? "");
        const v: Record<string, string> = {};
        for (const f of FIELDS) {
          const val = editTarget[f.key];
          v[f.key] = val != null ? String(val) : "";
        }
        setValues(v);
      } else {
        setDate(todayShanghaiStr());
        setNote("");
        setValues({});
      }
    }
  }, [open, editTarget]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const handleSave = async () => {
    const hasValue = FIELDS.some((f) => values[f.key]?.trim());
    if (!hasValue) {
      showToast("至少填写一项数据");
      return;
    }
    setSaving(true);
    try {
      const input = {
        log_date: date,
        note: note.trim() || undefined,
        weight_kg: numOrUndef(values.weight_kg),
        body_fat_pct: numOrUndef(values.body_fat_pct),
        waist_cm: numOrUndef(values.waist_cm),
        hip_cm: numOrUndef(values.hip_cm),
        chest_cm: numOrUndef(values.chest_cm),
        left_arm_cm: numOrUndef(values.left_arm_cm),
        right_arm_cm: numOrUndef(values.right_arm_cm),
        left_thigh_cm: numOrUndef(values.left_thigh_cm),
        right_thigh_cm: numOrUndef(values.right_thigh_cm),
      };
      const metric = await saveBodyMetric(input);
      if (metric) {
        onOpenChange(false);
      } else {
        showToast("保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>

      <SheetContent side="bottom" className="bg-midnight border-white/10 rounded-t-3xl max-h-[92vh]">
        <SheetHeader>
          <SheetTitle className="text-glow-gold">{editTarget ? "编辑身体数据" : "记录身体数据"}</SheetTitle>
          <SheetDescription className="text-muted/60">同一天再次保存会覆盖原记录</SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 overflow-y-auto space-y-4 pb-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted/60">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayShanghaiStr()}
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-glow-gold/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs text-muted/60">{f.label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
                />
              </div>
            ))}
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
            placeholder="备注（可选）"
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
          />
        </div>

        <SheetFooter className="border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </button>
          {toast && <p className="text-center text-xs text-glow-gold/80">{toast}</p>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function numOrUndef(s: string | undefined): number | undefined {
  const v = s?.trim();
  return v ? Number(v) : undefined;
}
