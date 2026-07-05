"use client";

import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { Download, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { type DiaryRow } from "@/lib/diary-service";
import { type ModuleConfig, getModulePrefix } from "@/lib/module-config";
import { filterDiaries, generateExcel, generateWord } from "@/lib/export-utils";
import { DateRangePicker } from "./DateRangePicker";

interface DiaryExportButtonProps {
  entries: DiaryRow[];
  moduleConfig: ModuleConfig[];
  diaryDates: string[];
}

export function DiaryExportButton({
  entries,
  moduleConfig,
  diaryDates,
}: DiaryExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(moduleConfig.map((m) => m.id))
  );
  const [exportFormat, setExportFormat] = useState<"excel" | "word">("excel");
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedModules(new Set(moduleConfig.map((m) => m.id)));
  const deselectAll = () => setSelectedModules(new Set());

  const dateFromStr = dateRange?.from
    ? `${dateRange.from.getFullYear()}-${String(dateRange.from.getMonth() + 1).padStart(2, "0")}-${String(dateRange.from.getDate()).padStart(2, "0")}`
    : undefined;
  const dateToStr = dateRange?.to
    ? `${dateRange.to.getFullYear()}-${String(dateRange.to.getMonth() + 1).padStart(2, "0")}-${String(dateRange.to.getDate()).padStart(2, "0")}`
    : undefined;

  const handleExport = async () => {
    if (selectedModules.size === 0) {
      showToast("请至少选择一个维度");
      return;
    }

    const filtered = filterDiaries(entries, dateFromStr, dateToStr);

    if (filtered.length === 0) {
      showToast("无日记可导出");
      return;
    }

    const moduleIds = moduleConfig
      .filter((m) => selectedModules.has(m.id))
      .map((m) => m.id);

    setExporting(true);
    try {
      if (exportFormat === "excel") {
        generateExcel(filtered, moduleIds, moduleConfig);
      } else {
        await generateWord(filtered, moduleIds, moduleConfig);
      }
      setOpen(false);
    } catch {
      showToast("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Icon-only trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="导出日记"
        className="flex items-center justify-center h-9 w-9 rounded-2xl bg-white/[0.04] border border-white/10 text-muted/60 hover:text-foreground hover:border-white/20 transition-all shrink-0"
      >
        <Download className="h-4 w-4" />
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-glow-gold/10 border border-glow-gold/20 text-sm text-glow-gold text-center">
          {toast}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-midnight/80 backdrop-blur-sm"
            onClick={() => !exporting && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-white/10 bg-deep-blue p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-glow-gold">导出日记</h2>
              <button
                onClick={() => !exporting && setOpen(false)}
                className="p-1 rounded-lg text-muted/60 hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Date range — reuses DateRangePicker (same source as list page) */}
            <div className="space-y-2">
              <label className="text-xs text-muted/60">日期范围（留空 = 全部）</label>
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                highlightDates={diaryDates}
              />
            </div>

            {/* Module selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted/60">维度选择</label>
                <div className="flex gap-2">
                  <button onClick={selectAll} disabled={exporting} className="text-xs text-muted/50 hover:text-glow-gold transition-colors">全选</button>
                  <button onClick={deselectAll} disabled={exporting} className="text-xs text-muted/50 hover:text-glow-gold transition-colors">取消全选</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {moduleConfig.map((mod, idx) => {
                  const checked = selectedModules.has(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      disabled={exporting}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all border",
                        checked
                          ? "border-glow-gold/30 bg-glow-gold/5 text-foreground/90"
                          : "border-white/10 bg-white/[0.02] text-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center h-4 w-4 rounded border transition-all shrink-0",
                          checked ? "border-glow-gold/50 bg-glow-gold/20" : "border-white/20"
                        )}
                      >
                        {checked && <Check className="h-3 w-3 text-glow-gold" />}
                      </span>
                      <span>{getModulePrefix(idx)} {mod.label}</span>
                      {!mod.isActive && (
                        <span className="text-[9px] text-muted/40 ml-auto">(已停用)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format selection */}
            <div className="space-y-2">
              <label className="text-xs text-muted/60">导出格式</label>
              <div className="flex gap-2">
                {(["excel", "word"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setExportFormat(f)}
                    disabled={exporting}
                    className={cn(
                      "flex-1 h-9 rounded-lg text-sm transition-all border",
                      exportFormat === f
                        ? "border-glow-gold/40 bg-glow-gold/10 text-glow-gold"
                        : "border-white/10 bg-white/[0.02] text-muted/50"
                    )}
                  >
                    {f === "excel" ? "Excel (.xlsx)" : "Word (.docx)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                disabled={exporting}
                className="flex-1 h-10 rounded-full text-sm border border-white/10 bg-white/[0.02] text-muted/60 hover:text-foreground hover:border-white/20 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || selectedModules.size === 0}
                className="flex-1 h-10 rounded-full text-sm font-semibold bg-glow-gold text-midnight hover:bg-glow-gold/90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    导出中...
                  </>
                ) : (
                  "确认导出"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
