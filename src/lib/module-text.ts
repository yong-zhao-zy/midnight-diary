/**
 * 模块文本取值工具 —— 统一处理「新 key（m1..m4）」与「历史 key（mind_body…）」的回落。
 * 弹窗、概览表格、周期摘要素材都用这一份，避免三处逻辑漂移。
 */

import { LEGACY_KEY_MAP, extractEventText } from "@/lib/module-config";

/** 模块正文（用户写的原文） */
export function getModuleText(
  content: Record<string, string> | null | undefined,
  moduleId: string
): string {
  if (!content) return "";
  if (content[moduleId]) return content[moduleId];
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && content[legacyKey]) return content[legacyKey];
  }
  return "";
}

/** AI 摘要（module_summaries），只取【事件】部分 */
export function getModuleAiSummary(
  summaries: Record<string, string> | null | undefined,
  moduleId: string
): string {
  if (!summaries) return "";
  if (summaries[moduleId]) return extractEventText(summaries[moduleId]);
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId && summaries[legacyKey]) {
      return extractEventText(summaries[legacyKey]);
    }
  }
  return "";
}
