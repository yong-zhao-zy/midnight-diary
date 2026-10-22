-- 2026-10-22 AI 饮食分析报告快照（【饮食-今日饮食分析】+【分析-周期解读】共用）
--
-- 背景：
--   【饮食】每次点「今日饮食分析」都重新调 DeepSeek；切到别的日期再切回来，报告就没了。
--   【分析】周期报告同理，换个日期范围再换回来也要重算。
--   两张场景本质一样：给「某一段时间」算出来的确定性分析结果 + AI 文案，按 key 存一份快照。
--
-- 设计：
--   scope = 'day'    → period_key = 'YYYY-MM-DD'
--   scope = 'period' → period_key = 'YYYY-MM-DD_YYYY-MM-DD'
--   同一 (user, scope, period_key) 只留一行，重新生成时 upsert 覆盖。
--   payload 存的是服务端 analyzeDay / analyzePeriod 的确定性结果（图表、雷达全靠它），
--   命中缓存时直接回放，既不烧 LLM 也不重算。
--
-- RLS：只按归属过滤，SELECT 策略里绝不能带 is_deleted 之类条件（2026-10-19 教训，
--      否则 UPDATE 新行会违反 SELECT 策略 → 42501）。本表无软删，重新生成走 upsert。
--
-- 删除账号：user_id 外键 ON DELETE CASCADE，注销时自动清理。
--
-- 本脚本幂等，可重复执行。

CREATE TABLE IF NOT EXISTS public.ai_analysis_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope        TEXT NOT NULL CHECK (scope IN ('day', 'period')),
  period_key   TEXT NOT NULL,
  report       TEXT NOT NULL,
  payload      JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, period_key)
);

COMMENT ON TABLE public.ai_analysis_reports IS 'AI 饮食分析报告快照（按天/按周期），用于切回时免重算、免重调 LLM';
COMMENT ON COLUMN public.ai_analysis_reports.payload IS '服务端 analyzeDay / analyzePeriod 的确定性结果，命中缓存时直接回放图表数据';

CREATE INDEX IF NOT EXISTS idx_ai_analysis_reports_lookup
  ON public.ai_analysis_reports (user_id, scope, period_key);

ALTER TABLE public.ai_analysis_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_analysis_reports_select ON public.ai_analysis_reports;
CREATE POLICY ai_analysis_reports_select ON public.ai_analysis_reports FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_analysis_reports_insert ON public.ai_analysis_reports;
CREATE POLICY ai_analysis_reports_insert ON public.ai_analysis_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_analysis_reports_update ON public.ai_analysis_reports;
CREATE POLICY ai_analysis_reports_update ON public.ai_analysis_reports FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_analysis_reports_delete ON public.ai_analysis_reports;
CREATE POLICY ai_analysis_reports_delete ON public.ai_analysis_reports FOR DELETE
  USING (user_id = auth.uid());

-- 自检：应看到 4 条策略
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ai_analysis_reports'
ORDER BY cmd;
