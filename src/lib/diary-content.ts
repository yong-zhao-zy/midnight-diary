import { LEGACY_KEY_MAP, type ModuleConfig } from "@/lib/module-config";
import type { DiaryRow } from "@/lib/diary-service";

/** 取某个维度的正文，兼容旧 key（同一套逻辑此前散落在多个组件里） */
export function resolveModuleContent(
  content: Record<string, string> | null | undefined,
  moduleId: string
): string {
  if (!content) return "";
  const direct = content[moduleId];
  if (direct?.trim()) return direct.trim();
  for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
    if (newId === moduleId) {
      const legacy = content[legacyKey];
      if (legacy?.trim()) return legacy.trim();
    }
  }
  return "";
}

/** 单条日记的总字数（所有维度正文之和），用于统计条「平均 X 字」与厚薄分级 */
export function diaryCharCount(entry: DiaryRow, config: ModuleConfig[]): number {
  const content = entry.content as Record<string, string> | null;
  return config.reduce((sum, mod) => sum + resolveModuleContent(content, mod.id).length, 0);
}
