"use client";

import { useState, type RefObject } from "react";
import { Download, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { type DiaryRow } from "@/lib/diary-service";
import { type ModuleConfig } from "@/lib/module-config";
import { type Granularity } from "@/lib/report-service";

interface ReportExportButtonProps {
  /** 已按当前日期筛选的日记 */
  entries: DiaryRow[];
  moduleConfig: ModuleConfig[];
  /** 当前显示的维度（导出时只带这些） */
  moduleIds: string[];
  granularity: Granularity;
  /** 「10.13–10.26」这种人类可读范围，弹窗里回显 */
  rangeLabel: string;
  /** 矩阵容器。JPG 直接截它（含表头与图例，不含筛选控件） */
  captureRef: RefObject<HTMLDivElement | null>;
}

const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: "按日",
  week: "按周",
  month: "按月",
};

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 概览页导出：交互与「每日一记-写日记」的 DiaryExportButton 同一套
 * （图标触发 → 底部弹窗 → 取消/确认），只是格式换成 Excel 与 JPG。
 * 概览页已经筛过日期与维度，弹窗不再重复选，只回显当前条件。
 */
export function ReportExportButton({
  entries,
  moduleConfig,
  moduleIds,
  granularity,
  rangeLabel,
  captureRef,
}: ReportExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"excel" | "image">("excel");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleExport = async () => {
    if (moduleIds.length === 0) {
      showToast("请至少选择一个维度");
      return;
    }

    setExporting(true);
    try {
      if (format === "excel") {
        const { generateExcel } = await import("@/lib/export-utils");
        if (entries.length === 0) {
          showToast("无日记可导出");
          return;
        }
        generateExcel(entries, moduleIds, moduleConfig);
        setOpen(false);
        return;
      }

      const node = captureRef.current;
      if (!node) {
        showToast("矩阵还没准备好");
        return;
      }

      const { toJpeg } = await import("html-to-image");
      const pageBg = getComputedStyle(document.body).backgroundColor || "#020617";
      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: pageBg,
      });

      const link = document.createElement("a");
      link.download = `日记概览-${stamp()}.jpg`;
      link.href = dataUrl;
      link.click();
      setOpen(false);
    } catch {
      showToast("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="导出概览"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line-2 bg-surface-2 text-ink-2/70 transition-all hover:border-line-3 hover:text-ink"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-accent/20 bg-accent/10 px-4 py-2 text-center text-sm text-accent">
          {toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-elevated/80 backdrop-blur-sm"
            onClick={() => !exporting && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md space-y-5 rounded-t-3xl border border-line-2 bg-elevated-2 p-6 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-accent">导出概览</h2>
              <button
                onClick={() => !exporting && setOpen(false)}
                className="rounded-lg p-2 text-ink-2/70 transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 概览页的条件已经在控制层选过，这里只回显，不重复筛 */}
            <div className="space-y-1 rounded-xl border border-line-1 bg-surface-1 px-3 py-2.5">
              <p className="text-[11px] text-ink-2/50">导出范围</p>
              <p className="text-sm text-ink/85">
                {rangeLabel}
                <span className="mx-1.5 text-ink-2/25">·</span>
                {moduleIds.length} 个维度
                <span className="mx-1.5 text-ink-2/25">·</span>
                {GRANULARITY_LABEL[granularity]}
              </p>
              <p className="text-[11px] text-ink-2/40">
                共 {entries.length} 篇。想换范围就先改上面的筛选。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-ink-2/70">导出格式</label>
              <div className="flex gap-2">
                {(
                  [
                    { key: "excel", label: "Excel (.xlsx)" },
                    { key: "image", label: "图片 (.jpg)" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFormat(f.key)}
                    disabled={exporting}
                    className={cn(
                      "h-9 flex-1 rounded-lg border text-sm transition-all",
                      format === f.key
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line-2 bg-surface-1 text-ink-2/60"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-ink-2/40">
                {format === "excel"
                  ? "按日记逐条导出，一年一条，适合再做二次统计。"
                  : "截取下面的矩阵（含行列标签），适合直接发给别人看。"}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                disabled={exporting}
                className="h-10 flex-1 rounded-full border border-line-2 bg-surface-1 text-sm text-ink-2/70 transition-colors hover:border-line-3 hover:text-ink"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || moduleIds.length === 0}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent text-sm font-semibold text-accent-ink transition-all hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
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
