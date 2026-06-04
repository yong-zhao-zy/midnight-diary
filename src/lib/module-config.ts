export interface ModuleConfig {
  id: string;
  label: string;
  prompt: string;
  followUp: string;
  isActive: boolean;
  color: string;
  dotColor: string;
}

/**
 * Default module configuration.
 * In the future, this can be fetched from user settings / Supabase.
 */
export const DEFAULT_MODULE_CONFIG: ModuleConfig[] = [
  {
    id: "m1",
    label: "身心觉知",
    prompt: "此刻闭上眼，感受你的内心和身体——它们在告诉你什么？",
    followUp: "这种感受是从什么时候开始的？你的身体哪个部位回应最强烈？",
    isActive: true,
    color: "bg-violet-500/80 text-violet-100",
    dotColor: "bg-violet-400",
  },
  {
    id: "m2",
    label: "人际链接",
    prompt: "今天有谁的面孔浮现在你脑海？你们之间发生了什么？",
    followUp: "在那个瞬间，你真正想要的回应是什么？",
    isActive: true,
    color: "bg-orange-500/80 text-orange-100",
    dotColor: "bg-orange-400",
  },
  {
    id: "m3",
    label: "高光瞬间",
    prompt: "回想今天，有没有一个让你心头一亮的瞬间？哪怕很小。",
    followUp: "是什么让那个瞬间如此珍贵？它映射了你内心的哪个渴望？",
    isActive: true,
    color: "bg-amber-400/80 text-amber-900",
    dotColor: "bg-amber-400",
  },
  {
    id: "m4",
    label: "感恩与愿景",
    prompt: "此刻你最想感谢什么？如果明天只做一件让自己骄傲的小事，你会选择什么？",
    followUp: "是什么曾经阻碍你去做这件事？那个障碍现在还在吗？",
    isActive: true,
    color: "bg-emerald-500/80 text-emerald-100",
    dotColor: "bg-emerald-400",
  },
];

/**
 * Get active modules from config.
 */
export function getActiveModules(config: ModuleConfig[] = DEFAULT_MODULE_CONFIG): ModuleConfig[] {
  return config.filter((m) => m.isActive);
}

/**
 * Build MODULE_LABELS map from config (for backward compat).
 */
export function getModuleLabels(config: ModuleConfig[] = DEFAULT_MODULE_CONFIG): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const m of config) {
    labels[m.id] = m.label;
  }
  return labels;
}

/**
 * Build MODULE_COLORS map from config.
 */
export function getModuleColors(config: ModuleConfig[] = DEFAULT_MODULE_CONFIG): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const m of config) {
    colors[m.id] = m.color;
  }
  return colors;
}

/**
 * Build MODULE_DOT_COLORS map from config.
 */
export function getModuleDotColors(config: ModuleConfig[] = DEFAULT_MODULE_CONFIG): Record<string, string> {
  const dotColors: Record<string, string> = {};
  for (const m of config) {
    dotColors[m.id] = m.dotColor;
  }
  return dotColors;
}

/**
 * Legacy key mapping: old keys → new config IDs.
 * Used for reading old diary data stored with legacy keys.
 */
export const LEGACY_KEY_MAP: Record<string, string> = {
  mind_body: "m1",
  connection: "m2",
  peak_moment: "m3",
  vision: "m4",
};

/**
 * Convert legacy content keys to new module IDs.
 */
export function migrateLegacyContent(content: Record<string, string>): Record<string, string> {
  const migrated: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    const newKey = LEGACY_KEY_MAP[key] || key;
    migrated[newKey] = value;
  }
  return migrated;
}

/**
 * Get letter prefix for a module by its index (0 → A., 1 → B., etc.)
 */
export function getModulePrefix(index: number): string {
  return `${String.fromCharCode(65 + index)}.`;
}

/**
 * Get display label with letter prefix.
 */
export function getPrefixedLabel(label: string, index: number): string {
  return `${getModulePrefix(index)} ${label}`;
}

/**
 * Build a labels snapshot map { moduleId: currentLabel } for persistence.
 */
export function buildLabelsSnapshot(config: ModuleConfig[]): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const m of config) {
    snapshot[m.id] = m.label;
  }
  return snapshot;
}

/**
 * Get display label with rename history.
 * If the module was renamed since the diary was saved, shows: "当前名 (原名: 旧名)"
 */
export function getLabelWithHistory(
  moduleId: string,
  currentConfig: ModuleConfig[],
  savedSnapshot?: Record<string, string> | null
): { label: string; renamed: boolean; originalLabel?: string } {
  const current = currentConfig.find((m) => m.id === moduleId);
  const currentLabel = current?.label || moduleId;

  if (!savedSnapshot || !savedSnapshot[moduleId]) {
    return { label: currentLabel, renamed: false };
  }

  const originalLabel = savedSnapshot[moduleId];
  if (originalLabel !== currentLabel) {
    return { label: currentLabel, renamed: true, originalLabel };
  }

  return { label: currentLabel, renamed: false };
}
