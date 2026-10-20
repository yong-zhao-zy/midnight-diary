/**
 * 周/月 AI 摘要的生成与缓存（server-only）。
 *
 * 流程：
 *   1. 取周期内日记（按 diary_date，缺失的历史数据回落到 created_at）
 *   2. 算 source_fingerprint（日记内容哈希）→ 与库里的比对
 *   3. 指纹一致 → 直接用缓存，不调用 LLM
 *   4. 不一致 → 一次 LLM 调用生成整周期所有模块的摘要，upsert 落库
 *
 * 与 summary_overrides 的关系：这里只写 period_summaries（AI 值），
 * 用户手写的周期摘要永不覆盖 —— 显示层取 override ?? AI。
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGACY_KEY_MAP, extractEventText } from "@/lib/module-config";
import {
  formatMonthDay,
  getPeriodKey,
  getPeriodRange,
  parseDateKey,
  type PeriodRange,
  type PeriodScope,
} from "@/lib/period-summary-service";

export interface PeriodModuleRef {
  id: string;
  label: string;
}

export interface PeriodDiaryRow {
  id: string;
  diary_date: string | null;
  created_at: string;
  deleted_at?: string | null;
  is_deleted?: boolean | null;
  content: Record<string, string> | null;
  module_summaries: Record<string, string> | null;
}

export interface PeriodSummaryRow {
  module_id: string;
  content: string;
  source_fingerprint: string;
}

/** 摘要文本的长度上限（字），与前端编辑上限一致 */
export const PERIOD_AI_MAX_LEN: Record<PeriodScope, number> = {
  week: 40,
  month: 60,
};

/** 提示词里要求的长度区间 */
const PERIOD_AI_LEN_HINT: Record<PeriodScope, string> = {
  week: "15~40 个字",
  month: "25~60 个字",
};

function diaryDateKey(row: PeriodDiaryRow): string {
  if (row.diary_date) return row.diary_date;
  const d = new Date(row.created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 取周期内的日记（diary_date 优先，历史空值回落到 created_at） */
export async function fetchPeriodDiaries(
  supabase: SupabaseClient,
  userId: string,
  range: { start: string; end: string }
): Promise<PeriodDiaryRow[]> {
  const { data, error } = await supabase
    .from("diaries")
    .select("id, diary_date, created_at, content, module_summaries, is_deleted")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .or(
      [
        `and(diary_date.gte.${range.start},diary_date.lte.${range.end})`,
        `and(diary_date.is.null,created_at.gte.${range.start}T00:00:00,created_at.lt.${nextDay(
          range.end
        )}T00:00:00)`,
      ].join(",")
    )
    .order("diary_date", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("Fetch period diaries error:", error);
    return [];
  }
  return (data ?? []) as unknown as PeriodDiaryRow[];
}

function nextDay(dateKey: string): string {
  const d = parseDateKey(dateKey);
  if (!d) return dateKey;
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * 周期内日记内容的指纹：任一日记正文/摘要/日期变化都会变。
 * extra：额外参与指纹的素材快照（月摘要传周摘要快照，见 fetchMonthWeekMaterial）。
 */
export function computeFingerprint(diaries: PeriodDiaryRow[], extra?: string): string {
  const lines = diaries
    .map((d) =>
      [
        d.id,
        diaryDateKey(d),
        hash(JSON.stringify(d.content ?? {})),
        hash(JSON.stringify(d.module_summaries ?? {})),
      ].join("|")
    )
    .sort();
  // 不传 extra 时保持原算法不变（周摘要的历史指纹继续命中，不会引发成批重算）
  return hash(extra ? `${lines.join("\n")}\n--${extra}` : lines.join("\n")).slice(0, 32);
}

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** 读已缓存的 AI 周期摘要 */
export async function fetchPeriodSummaries(
  supabase: SupabaseClient,
  userId: string,
  scope: PeriodScope,
  periodKey: string
): Promise<PeriodSummaryRow[]> {
  const { data, error } = await supabase
    .from("period_summaries")
    .select("module_id, content, source_fingerprint")
    .eq("user_id", userId)
    .eq("scope", scope)
    .eq("period_key", periodKey);

  if (error) {
    console.error("Fetch period summaries error:", error);
    return [];
  }
  return (data ?? []) as PeriodSummaryRow[];
}

/** 该周期内用户编辑过的日摘要（用于提炼素材，编辑版优先） */
async function fetchDayOverrides(
  supabase: SupabaseClient,
  userId: string,
  range: { start: string; end: string }
): Promise<Record<string, Record<string, string>>> {
  const { data, error } = await supabase
    .from("summary_overrides")
    .select("period_key, module_id, content")
    .eq("user_id", userId)
    .eq("scope", "day")
    .gte("period_key", range.start)
    .lte("period_key", range.end);

  if (error) {
    console.error("Fetch day overrides error:", error);
    return {};
  }

  const map: Record<string, Record<string, string>> = {};
  for (const row of (data ?? []) as { period_key: string; module_id: string; content: string }[]) {
    if (!map[row.period_key]) map[row.period_key] = {};
    map[row.period_key][row.module_id] = row.content;
  }
  return map;
}

/** 该月内用户编辑过的周摘要：{ weekKey: { moduleId: content } } */
async function fetchWeekOverrides(
  supabase: SupabaseClient,
  userId: string,
  weekKeys: string[]
): Promise<Record<string, Record<string, string>>> {
  if (weekKeys.length === 0) return {};
  const { data, error } = await supabase
    .from("summary_overrides")
    .select("period_key, module_id, content")
    .eq("user_id", userId)
    .eq("scope", "week")
    .in("period_key", weekKeys);

  if (error) {
    console.error("Fetch week overrides error:", error);
    return {};
  }

  const map: Record<string, Record<string, string>> = {};
  for (const row of (data ?? []) as { period_key: string; module_id: string; content: string }[]) {
    if (!map[row.period_key]) map[row.period_key] = {};
    map[row.period_key][row.module_id] = row.content;
  }
  return map;
}

/** 某日记某模块的展示摘要：用户编辑 > AI 摘要 > 正文前 20 字 */
function moduleText(
  diary: PeriodDiaryRow,
  moduleId: string,
  override: string | undefined
): string {
  if (override) return override;
  const summaries = diary.module_summaries;
  if (summaries) {
    if (summaries[moduleId]) return extractEventText(summaries[moduleId]);
    for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
      if (newId === moduleId && summaries[legacyKey]) return extractEventText(summaries[legacyKey]);
    }
  }
  const content = diary.content;
  if (content) {
    if (content[moduleId]) return content[moduleId].trim().slice(0, 20);
    for (const [legacyKey, newId] of Object.entries(LEGACY_KEY_MAP)) {
      if (newId === moduleId && content[legacyKey]) return content[legacyKey].trim().slice(0, 20);
    }
  }
  return "";
}

/** 「无 / 没工作 / 无具体事件」这类占位内容不算素材，否则模型会为它硬写一句填充句 */
function isPlaceholderText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(无|没有|暂无|没)[\u4e00-\u9fa5]{0,3}[。，、\s]*$/.test(t)) return true;
  return /^(无|没有|暂无|今天没)(具体)?(事件|记录|内容|安排)/.test(t);
}

/** 按模块 + 日期拼素材文本；同时返回「真的有素材」的模块 ID */
function buildMaterial(
  scope: PeriodScope,
  modules: PeriodModuleRef[],
  diaries: PeriodDiaryRow[],
  dayOverrides: Record<string, Record<string, string>>,
  monthWeekLines?: Record<string, string[]>
): { material: string; moduleIds: string[] } {
  const blocks: string[] = [];
  const moduleIds: string[] = [];

  for (const mod of modules) {
    const lines: string[] = [];

    // 月摘要承接周摘要：每周一行（该周没周摘要时退回该周的日摘要行）
    if (scope === "month" && monthWeekLines?.[mod.id]?.length) {
      lines.push(...monthWeekLines[mod.id]);
    } else {
      for (const diary of diaries) {
        const dateKey = diaryDateKey(diary);
        const text = moduleText(diary, mod.id, dayOverrides[dateKey]?.[mod.id]);
        if (text && !isPlaceholderText(text)) lines.push(`${formatMonthDay(dateKey)} ${text}`);
      }
    }

    if (lines.length === 0) continue;
    moduleIds.push(mod.id);
    blocks.push(`【${mod.label}（ID: ${mod.id}）】\n${lines.join("\n")}`);
  }

  return { material: blocks.join("\n\n"), moduleIds };
}

function buildSystemPrompt(scope: PeriodScope): string {
  const unit = scope === "week" ? "一周" : "一个月";
  const materialDesc =
    scope === "week"
      ? `会给你${unit}内按日期排列的日摘要（按模块分组，可能含有用户自己改写过的版本）`
      : `会给你这个月按周排列的素材（按模块分组）：多数是「第N周（日期区间） 周摘要」，个别周没有周摘要时给出该周每天的日摘要，可能含有用户自己改写过的版本`;

  return `你是日记周期摘要的提炼器。用户${materialDesc}。

请为每个模块写一条「${scope === "week" ? "周" : "月"}摘要」：
1. 承接这些素材做提炼：指出这一${scope === "week" ? "周" : "个月"}的主线、变化、整体状态，而不是逐日/逐周复述或罗列行程；
2. 长度 ${PERIOD_AI_LEN_HINT[scope]}，一句话，不加标题、不加日期、不写建议、不用「本周」开头也可以；
3. 语气克制、具体，避免空泛评价（如「状态不错」）；
4. 若某模块素材太少无法提炼，就给一句客观概括，不要编造细节；
5. 素材里出现「无具体事件」「无记录」这类占位内容时，用中性的概括即可（例如「这天没留下具体事件，以休息为主」），**禁止**评价成「停摆 / 空白 / 毫无进展」，也不要反过来编造细节${scope === "month" ? "；\n6. 月摘要要体现整月的走势与前后变化，不要写成周摘要的并列堆叠" : ""}。

只输出 JSON 对象：键为模块 ID（如 "m1"），值为摘要文本。不要输出任何其他内容。`;
}

interface GenerateParams {
  supabase: SupabaseClient;
  userId: string;
  scope: PeriodScope;
  periodKey: string;
  modules: PeriodModuleRef[];
  /** 忽略指纹强制重算 */
  force?: boolean;
}

export interface GenerateResult {
  /** 每个模块最终的 AI 摘要（来自缓存或新生成） */
  summaries: Record<string, string>;
  /** 是否本次真的调用了 LLM */
  generated: boolean;
  /** 指纹 */
  fingerprint: string;
  /** 周期内日记条数 */
  diaryCount: number;
}

/**
 * 取周期 AI 摘要：指纹一致读缓存，否则生成并落库。
 * 只写 period_summaries，不碰 summary_overrides（用户编辑永不被覆盖）。
 */
export async function ensurePeriodSummaries({
  supabase,
  userId,
  scope,
  periodKey,
  modules,
  force = false,
}: GenerateParams): Promise<GenerateResult> {
  const range = getPeriodRange(scope, periodKey);
  if (!range) throw new Error("periodKey 无效");

  const diaries = await fetchPeriodDiaries(supabase, userId, range);

  // 月摘要：先取「按周的素材」（周摘要优先），既用于拼素材，也参与指纹
  let dayOverrides: Record<string, Record<string, string>> | undefined;
  let monthWeekMaterial: { byModule: Record<string, string[]>; fingerprint: string } | undefined;
  if (scope === "month") {
    dayOverrides = await fetchDayOverrides(supabase, userId, range);
    monthWeekMaterial = await fetchMonthWeekMaterial(
      supabase,
      userId,
      modules,
      range,
      diaries,
      dayOverrides
    );
  }

  const fingerprint = computeFingerprint(diaries, monthWeekMaterial?.fingerprint);
  const cached = await fetchPeriodSummaries(supabase, userId, scope, periodKey);
  const cachedByModule = new Map(cached.map((row) => [row.module_id, row]));

  const cachedSummaries: Record<string, string> = {};
  for (const [moduleId, row] of cachedByModule) {
    cachedSummaries[moduleId] = row.content;
  }

  // 指纹一致且每个模块都有缓存 → 直接用
  const allFresh =
    !force &&
    cached.length > 0 &&
    cached.every((row) => row.source_fingerprint === fingerprint);
  if (allFresh) {
    return { summaries: cachedSummaries, generated: false, fingerprint, diaryCount: diaries.length };
  }

  if (diaries.length === 0) {
    return { summaries: cachedSummaries, generated: false, fingerprint, diaryCount: 0 };
  }

  if (!dayOverrides) {
    dayOverrides = await fetchDayOverrides(supabase, userId, range);
  }

  const { material, moduleIds } = buildMaterial(
    scope,
    modules,
    diaries,
    dayOverrides,
    monthWeekMaterial?.byModule
  );

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  if (!material) {
    // 全周期只有「无 / 没工作」这类占位内容 → 不该有摘要，顺手清掉历史填充句
    const { error: dropAllError } = await supabase
      .from("period_summaries")
      .delete()
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("period_key", periodKey);
    if (dropAllError) {
      console.error("Drop placeholder-only period summaries error:", dropAllError);
    }
    return { summaries: {}, generated: false, fingerprint, diaryCount: diaries.length };
  }

  // 只向模型要「真的有素材」的模块：否则它会给空模块编「本周无记录」这类填充句，
  // 概览表格里就会多出几行噪音。
  const expectedKeys = moduleIds.map((id) => `"${id}"`).join(", ");
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: buildSystemPrompt(scope) },
        { role: "user", content: `本次需要输出的模块 ID：${expectedKeys}\n\n${material}` },
      ],
      temperature: 0.3,
      max_tokens: 900,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("DeepSeek period summary error:", res.status, body.slice(0, 200));
    throw new Error("周期摘要生成失败");
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";

  const parsed: Record<string, string> = {};
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const json = JSON.parse(match ? match[0] : raw) as Record<string, unknown>;
    for (const mod of modules) {
      const value = json[mod.id];
      if (typeof value === "string" && value.trim()) {
        parsed[mod.id] = value.trim().slice(0, PERIOD_AI_MAX_LEN[scope]);
      }
    }
  } catch {
    console.warn("Period summary JSON parse failed, raw:", raw.slice(0, 200));
  }

  const rows = Object.entries(parsed).map(([moduleId, content]) => ({
    user_id: userId,
    scope,
    period_key: periodKey,
    module_id: moduleId,
    content,
    source_fingerprint: fingerprint,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { data: saved, error } = await supabase
      .from("period_summaries")
      .upsert(rows, { onConflict: "user_id,scope,period_key,module_id" })
      .select("id");
    if (error) {
      console.error("Save period summaries error:", error);
    } else if (!saved || saved.length === 0) {
      console.error("Save period summaries — 0 rows affected（RLS 拦截？）");
    }

    // 清掉本轮没生成成功的旧指纹行，否则每次打开都会判定「不新鲜」而重复调用 LLM
    const { error: cleanError } = await supabase
      .from("period_summaries")
      .delete()
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("period_key", periodKey)
      .neq("source_fingerprint", fingerprint);
    if (cleanError) {
      console.error("Clean stale period summaries error:", cleanError);
    }

    // 清掉「本轮没有素材」的模块历史行：旧逻辑会给空模块生成「本周无记录」这类填充句，
    // 留在库里会让概览格子多出几行噪音。
    const { error: dropError } = await supabase
      .from("period_summaries")
      .delete()
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("period_key", periodKey)
      .not("module_id", "in", `(${moduleIds.join(",")})`);
    if (dropError) {
      console.error("Drop empty-module period summaries error:", dropError);
    }
  }

  // 只回传「有素材」的模块，避免把历史填充句带回前端
  const allowed = new Set(moduleIds);
  const mergedCached: Record<string, string> = {};
  for (const [moduleId, content] of Object.entries(cachedSummaries)) {
    if (allowed.has(moduleId)) mergedCached[moduleId] = content;
  }

  return {
    summaries: { ...mergedCached, ...parsed },
    generated: true,
    fingerprint,
    diaryCount: diaries.length,
  };
}

/**
 * 月摘要素材：把该月拆成自然周，每周取「用户编辑的周摘要 > AI 周摘要」；
 * 某周还没有周摘要时退回该周的日摘要行，保证月素材不出现空洞。
 *
 * 返回：
 *   byModule    —— moduleId → 每周一行的素材文本
 *   fingerprint —— 周摘要快照，参与月摘要指纹（周摘要变了，月摘要跟着重算）
 */
async function fetchMonthWeekMaterial(
  supabase: SupabaseClient,
  userId: string,
  modules: PeriodModuleRef[],
  range: PeriodRange,
  diaries: PeriodDiaryRow[],
  dayOverrides: Record<string, Record<string, string>>
): Promise<{ byModule: Record<string, string[]>; fingerprint: string }> {
  // 该月覆盖到的自然周（按周一起算），顺序即「第 1~N 周」
  const weekKeys = Array.from(
    new Set(range.dates.map((date) => getPeriodKey("week", parseDateKey(date)!)))
  ).sort();

  const [aiRows, weekOverrides] = await Promise.all([
    supabase
      .from("period_summaries")
      .select("period_key, module_id, content")
      .eq("user_id", userId)
      .eq("scope", "week")
      .in("period_key", weekKeys),
    fetchWeekOverrides(supabase, userId, weekKeys),
  ]);

  const aiByWeek: Record<string, Record<string, string>> = {};
  for (const row of (aiRows.data ?? []) as {
    period_key: string;
    module_id: string;
    content: string;
  }[]) {
    if (!aiByWeek[row.period_key]) aiByWeek[row.period_key] = {};
    aiByWeek[row.period_key][row.module_id] = row.content;
  }

  // 日记按周分组，供「该周没有周摘要」时回落
  const diariesByWeek = new Map<string, PeriodDiaryRow[]>();
  for (const diary of diaries) {
    const weekKey = getPeriodKey("week", parseDateKey(diaryDateKey(diary))!);
    if (!diariesByWeek.has(weekKey)) diariesByWeek.set(weekKey, []);
    diariesByWeek.get(weekKey)!.push(diary);
  }

  const byModule: Record<string, string[]> = {};
  const fpParts: string[] = [];

  for (const weekKey of weekKeys) {
    const weekIdx = weekKeys.indexOf(weekKey) + 1;
    const weekDiaries = diariesByWeek.get(weekKey) ?? [];
    const weekRange = getPeriodRange("week", weekKey);
    const weekTag = `第${weekIdx}周`;
    const weekLabel = weekRange
      ? `${weekTag}（${formatMonthDay(weekRange.start)}–${formatMonthDay(weekRange.end)}）`
      : weekTag;

    for (const mod of modules) {
      const edited = weekOverrides[weekKey]?.[mod.id];
      const ai = aiByWeek[weekKey]?.[mod.id];
      const summary = edited || ai;
      if (summary) {
        if (!byModule[mod.id]) byModule[mod.id] = [];
        byModule[mod.id].push(`${weekLabel} ${summary}`);
        fpParts.push(`${weekKey}|${mod.id}|${summary}`);
        continue;
      }
      // 没有周摘要 → 用该周的日摘要补齐（不丢素材）
      for (const diary of weekDiaries) {
        const dateKey = diaryDateKey(diary);
        const text = moduleText(diary, mod.id, dayOverrides[dateKey]?.[mod.id]);
        if (!text || isPlaceholderText(text)) continue;
        if (!byModule[mod.id]) byModule[mod.id] = [];
        byModule[mod.id].push(`${weekTag} ${formatMonthDay(dateKey)} ${text}`);
      }
    }
  }

  return { byModule, fingerprint: fpParts.sort().join("\n") };
}

/**
 * 日记保存/摘要生成后，主动刷新该日所属的周摘要（fire-and-forget）。
 * 失败只打日志 —— 下次打开周弹窗时指纹比对会重试，不影响主流程。
 */
export async function refreshWeekForDate(
  supabase: SupabaseClient,
  userId: string,
  dateKey: string,
  modules: PeriodModuleRef[]
): Promise<void> {
  const date = parseDateKey(dateKey);
  if (!date || modules.length === 0) return;
  const periodKey = getPeriodKey("week", date);
  try {
    await ensurePeriodSummaries({ supabase, userId, scope: "week", periodKey, modules });
  } catch (error) {
    console.error("Refresh week summary failed (non-blocking):", error);
  }
}
