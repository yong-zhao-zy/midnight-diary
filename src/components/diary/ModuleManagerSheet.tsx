"use client";

import { useState } from "react";
import { Settings, Plus, Loader2, GripVertical } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { getModulePrefix, type ModuleConfig } from "@/lib/module-config";
import { createClient } from "@/lib/supabase/client";

interface ModuleManagerSheetProps {
  moduleConfig: ModuleConfig[];
  onConfigChange: (config: ModuleConfig[]) => void;
}

const AVAILABLE_COLORS = [
  { color: "bg-violet-500/80 text-violet-100", dot: "bg-violet-400" },
  { color: "bg-orange-500/80 text-orange-100", dot: "bg-orange-400" },
  { color: "bg-amber-400/80 text-amber-900", dot: "bg-amber-400" },
  { color: "bg-emerald-500/80 text-emerald-100", dot: "bg-emerald-400" },
  { color: "bg-sky-500/80 text-sky-100", dot: "bg-sky-400" },
  { color: "bg-pink-500/80 text-pink-100", dot: "bg-pink-400" },
  { color: "bg-rose-500/80 text-rose-100", dot: "bg-rose-400" },
  { color: "bg-teal-500/80 text-teal-100", dot: "bg-teal-400" },
];

function getNextId(config: ModuleConfig[]): string {
  const ids = config.map((m) => parseInt(m.id.replace("m", ""), 10));
  const max = ids.length > 0 ? Math.max(...ids) : 0;
  return `m${max + 1}`;
}

function getNextColor(config: ModuleConfig[]): { color: string; dot: string } {
  const usedDots = new Set(config.map((m) => m.dotColor));
  const available = AVAILABLE_COLORS.find((c) => !usedDots.has(c.dot));
  return available || AVAILABLE_COLORS[config.length % AVAILABLE_COLORS.length];
}

export function ModuleManagerSheet({
  moduleConfig,
  onConfigChange,
}: ModuleManagerSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ModuleConfig[]>([]);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(moduleConfig.map((m) => ({ ...m })));
    }
    setOpen(isOpen);
  };

  const updateLabel = (id: string, label: string) => {
    setDraft((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label } : m))
    );
  };

  const toggleActive = (id: string, checked: boolean) => {
    setDraft((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isActive: checked } : m))
    );
  };

  const addModule = () => {
    const newId = getNextId(draft);
    const { color, dot } = getNextColor(draft);
    const newModule: ModuleConfig = {
      id: newId,
      label: "新维度",
      prompt: "在这里写下你的想法...",
      followUp: "",
      isActive: true,
      color,
      dotColor: dot,
    };
    setDraft([...draft, newModule]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("profiles")
          .update({ module_config: draft })
          .eq("id", user.id);
      }

      onConfigChange(draft);
      setOpen(false);
    } catch (err) {
      console.error("Save module config error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <button
          className="group relative flex items-center gap-2 px-3 py-2 rounded-xl text-muted/60 hover:text-glow-gold hover:bg-white/5 transition-all"
          aria-label="管理维度"
        >
          <Settings className="h-5 w-5" />
          {/* Indicator pill */}
          <span className="hidden sm:inline text-xs text-muted/40 group-hover:text-glow-gold/70 transition-colors">
            维度
          </span>
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            点击重命名或调整维度
          </span>
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-midnight border-white/10 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-glow-gold">管理维度</SheetTitle>
          <SheetDescription className="text-muted/60">
            自定义日记的维度名称，启用或停用模块
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 space-y-3 overflow-y-auto">
          {draft.map((mod, idx) => (
            <div
              key={mod.id}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3"
            >
              <GripVertical className="h-4 w-4 text-muted/30 shrink-0" />

              {/* Letter prefix */}
              <span className="text-xs text-muted/50 font-mono shrink-0 w-5">
                {getModulePrefix(idx)}
              </span>

              <span
                className={`h-3 w-3 rounded-full shrink-0 ${mod.dotColor}`}
              />

              <input
                type="text"
                value={mod.label}
                onChange={(e) => updateLabel(mod.id, e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground border-b border-transparent focus:border-glow-gold/40 outline-none transition-colors placeholder:text-muted/30"
                placeholder="维度名称"
              />

              <Switch
                checked={mod.isActive}
                onCheckedChange={(checked) => toggleActive(mod.id, checked)}
                size="sm"
              />
            </div>
          ))}

          {/* Add new module */}
          <button
            onClick={addModule}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-3 text-sm text-muted/60 hover:text-glow-gold hover:border-glow-gold/30 transition-all"
          >
            <Plus className="h-4 w-4" />
            新增维度
          </button>
        </div>

        <SheetFooter className="border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glow-gold text-midnight text-sm font-semibold disabled:opacity-50 hover:bg-glow-gold/90 active:scale-[0.98] transition-all"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存配置
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
