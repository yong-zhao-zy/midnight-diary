import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TableOfContents,
} from "docx";
import { saveAs } from "file-saver";
import { getDiaryDateStr, type DiaryRow } from "@/lib/diary-service";
import {
  getLabelWithHistory,
  LEGACY_KEY_MAP,
  type ModuleConfig,
} from "@/lib/module-config";

/**
 * Resolve content for a module ID, falling back to legacy keys.
 */
function resolveContent(
  content: Record<string, string>,
  moduleId: string
): string {
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) {
      return content[legacyKey];
    }
  }
  return "";
}

function formatDateZh(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/**
 * Sort entries by diary date descending (newest first).
 */
function sortByDateDesc(entries: DiaryRow[]): DiaryRow[] {
  return [...entries].sort((a, b) => {
    const aDate = getDiaryDateStr(a);
    const bDate = getDiaryDateStr(b);
    return bDate.localeCompare(aDate);
  });
}

/**
 * Filter diaries by date range (inclusive). Empty params = all entries.
 * Returns entries sorted by date descending.
 */
export function filterDiaries(
  entries: DiaryRow[],
  dateFrom?: string,
  dateTo?: string
): DiaryRow[] {
  const filtered = (!dateFrom && !dateTo)
    ? entries
    : entries.filter((entry) => {
        const dateStr = getDiaryDateStr(entry);
        if (dateFrom && dateStr < dateFrom) return false;
        if (dateTo && dateStr > dateTo) return false;
        return true;
      });
  return sortByDateDesc(filtered);
}

/**
 * Generate and download an Excel file from diary entries.
 */
export function generateExcel(
  entries: DiaryRow[],
  selectedModuleIds: string[],
  moduleConfig: ModuleConfig[]
): void {
  const sorted = sortByDateDesc(entries);

  const header = [
    "日期",
    ...selectedModuleIds.map((id) => {
      const mod = moduleConfig.find((m) => m.id === id);
      return mod?.label || id;
    }),
  ];

  const rows = sorted.map((entry) => {
    const dateStr = getDiaryDateStr(entry);
    return [
      formatDateZh(dateStr),
      ...selectedModuleIds.map((id) =>
        resolveContent(entry.content as Record<string, string>, id)
      ),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [
    { wch: 14 },
    ...selectedModuleIds.map(() => ({ wch: 40 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "日记导出");
  XLSX.writeFile(wb, `日记导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Generate and download a Word document from diary entries.
 * Includes a Table of Contents page with clickable hyperlinks to all H1/H2 headings.
 */
export async function generateWord(
  entries: DiaryRow[],
  selectedModuleIds: string[],
  moduleConfig: ModuleConfig[]
): Promise<void> {
  const sorted = sortByDateDesc(entries);
  const children: (Paragraph | TableOfContents)[] = [];

  // ── TOC page ──
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      text: "目录",
    })
  );
  children.push(
    new TableOfContents("目录", {
      hyperlink: true,
      headingStyleRange: "1-2",
    })
  );

  // ── Diary entries ── (each diary starts on a new page)
  sorted.forEach((entry) => {
    const dateStr = getDiaryDateStr(entry);
    const formattedDate = formatDateZh(dateStr);

    // H1: diary date — pageBreakBefore ensures TOC is on its own page
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        text: formattedDate,
        pageBreakBefore: true,
      })
    );

    // H2 + body for each selected module
    for (const moduleId of selectedModuleIds) {
      const { label, renamed, originalLabel } = getLabelWithHistory(
        moduleId,
        moduleConfig,
        entry.module_labels_snapshot
      );
      const h2Text = renamed ? `${label} (原名: ${originalLabel})` : label;
      const content = resolveContent(
        entry.content as Record<string, string>,
        moduleId
      );

      // H2: dimension name (always rendered, keeps TOC hierarchy complete)
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, text: h2Text })
      );
      // Body: diary content or "（无内容）"
      children.push(
        new Paragraph({
          text: content || "（无内容）",
          spacing: { after: 200 },
        })
      );
    }
  });

  const doc = new Document({
    features: { updateFields: true },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `日记导出_${new Date().toISOString().slice(0, 10)}.docx`);
}
