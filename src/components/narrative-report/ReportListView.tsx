"use client";

import type { ModuleConfig } from "@/lib/module-config";
import type { ReportRow } from "@/lib/narrative-report-service";
import { ReportCard } from "./ReportCard";
import { ReportGenerateForm } from "./ReportGenerateForm";

interface ReportListViewProps {
  reports: ReportRow[];
  diaryDates: string[];
  moduleConfig: ModuleConfig[];
  selectedModules: string[];
  onModulesChange: (ids: string[]) => void;
  showHidden: boolean;
  onShowHiddenChange: (show: boolean) => void;
  isGenerating: boolean;
  onGenerate: (startDate: string, endDate: string, moduleIds: string[]) => void;
  onView: (report: ReportRow) => void;
  onRename: (id: string, theme: string) => void;
  onDelete: (id: string) => void;
}

export function ReportListView({
  reports,
  diaryDates,
  moduleConfig,
  selectedModules,
  onModulesChange,
  showHidden,
  onShowHiddenChange,
  isGenerating,
  onGenerate,
  onView,
  onRename,
  onDelete,
}: ReportListViewProps) {
  return (
    <div className="space-y-4">
      <ReportGenerateForm
        diaryDates={diaryDates}
        moduleConfig={moduleConfig}
        selectedModules={selectedModules}
        onModulesChange={onModulesChange}
        showHidden={showHidden}
        onShowHiddenChange={onShowHiddenChange}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
      />

      {reports.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted/60 text-sm">还没有阶段报告</p>
          <p className="text-xs text-muted/40">
            选择日期范围和维度，生成你的第一份成长报告
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => (
            <ReportCard
              key={report.id}
              report={report}
              index={i}
              onView={onView}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
