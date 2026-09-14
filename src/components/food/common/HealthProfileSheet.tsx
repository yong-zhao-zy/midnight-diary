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
import type { Gender, ActivityLevel } from "@/config/dri-config";
import { ACTIVITY_LABELS } from "@/config/dri-config";

interface HealthProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][];

export function HealthProfileSheet({ open, onOpenChange }: HealthProfileSheetProps) {
  const healthProfile = useFoodStore((s) => s.healthProfile);
  const saveHealthProfile = useFoodStore((s) => s.saveHealthProfile);

  const [height, setHeight] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (open) {
      setHeight(healthProfile.height_cm ? String(healthProfile.height_cm) : "");
      setBirthDate(healthProfile.birth_date ?? "");
      setGender(healthProfile.gender ?? "");
      setActivity(healthProfile.activity_level ?? "moderate");
      setCalorieGoal(healthProfile.calorie_goal ? String(healthProfile.calorie_goal) : "");
      setTargetWeight(healthProfile.target_weight_kg ? String(healthProfile.target_weight_kg) : "");
    }
  }, [open, healthProfile]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const handleSave = async () => {
    if (!gender) {
      showToast("请选择性别");
      return;
    }
    if (!birthDate) {
      showToast("请填写出生日期");
      return;
    }

    setSaving(true);
    try {
      const ok = await saveHealthProfile({
        height_cm: height ? Number(height) : undefined,
        birth_date: birthDate,
        gender,
        activity_level: activity,
        calorie_goal: calorieGoal ? Number(calorieGoal) : undefined,
        target_weight_kg: targetWeight ? Number(targetWeight) : undefined,
      });
      if (ok) {
        showToast("已保存");
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
      <SheetContent side="bottom" className="bg-midnight border-white/10 rounded-t-3xl max-h-[90vh]">
        <SheetHeader>
          <SheetTitle className="text-glow-gold">健康画像</SheetTitle>
          <SheetDescription className="text-muted/60">
            用于计算你的个性化营养目标（DRI）
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 overflow-y-auto space-y-4 pb-2">
          <Field label="性别">
            <div className="flex gap-2">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-xl text-sm transition-colors ${
                    gender === g
                      ? "bg-glow-gold/90 text-midnight"
                      : "bg-white/[0.03] border border-white/8 text-muted/70"
                  }`}
                >
                  {g === "male" ? "男" : "女"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="出生日期">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-glow-gold/30"
            />
          </Field>

          <Field label="身高 (cm)">
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="如 170"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
            />
          </Field>

          <Field label="活动水平">
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_OPTIONS.map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setActivity(val)}
                  className={`py-2.5 rounded-xl text-xs transition-colors ${
                    activity === val
                      ? "bg-glow-gold/90 text-midnight"
                      : "bg-white/[0.03] border border-white/8 text-muted/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="每日热量目标">
              <input
                type="number"
                inputMode="numeric"
                value={calorieGoal}
                onChange={(e) => setCalorieGoal(e.target.value)}
                placeholder="留空自动算"
                className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
              />
            </Field>
            <Field label="目标体重 (kg)">
              <input
                type="number"
                inputMode="decimal"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                placeholder="如 65"
                className="w-full bg-white/[0.03] border border-white/8 rounded-xl p-3 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-glow-gold/30"
              />
            </Field>
          </div>
          <p className="text-xs text-muted/40">
            热量目标留空时按 BMR × 活动系数自动计算。性别与出生日期用于匹配 DRI 推荐值。
          </p>
        </div>

        <SheetFooter className="border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存画像
          </button>
          {toast && <p className="text-center text-xs text-glow-gold/80">{toast}</p>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted/60">{label}</label>
      {children}
    </div>
  );
}
