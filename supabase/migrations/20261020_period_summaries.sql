-- 2026-10-20 周期摘要（P2：周/月 AI 摘要缓存）
--
-- 背景：P1 只做了「日摘要可编辑」。周/月摘要原本不存在，需要 AI 生成。
-- 周/月是虚拟周期（没有 diaries 实体行），所以单独建表存 AI 生成结果 + 失效指纹。
--
-- 与 summary_overrides 的分工（两张表各管一层）：
--   period_summaries  = AI 生成的周/月摘要（会被自动刷新）
--   summary_overrides = 用户手动编辑的周/月摘要（永不被 AI 覆盖）
--   显示 = override ?? period_summaries
--
-- 失效判定：source_fingerprint = 该周期内日记内容的哈希（id + diary_date + content + module_summaries）。
--   打开周期弹窗时比对，不一致就重新生成；一致直接读缓存，不烧 LLM 调用。
--
-- 删除账号：user_id 外键 ON DELETE CASCADE，注销时自动清理，无需改 delete_user_account RPC。
--
-- 本脚本幂等，可重复执行。

-- ============================================================
-- 1. 表结构
-- ============================================================
CREATE TABLE IF NOT EXISTS public.period_summaries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope              TEXT NOT NULL CHECK (scope IN ('week', 'month')),
  -- week:  'YYYY-MM-DD'（该周周一）
  -- month: 'YYYY-MM'
  period_key         TEXT NOT NULL,
  module_id          TEXT NOT NULL,
  content            TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, period_key, module_id)
);

COMMENT ON TABLE public.period_summaries IS 'AI 生成的周/月摘要（按周期+模块），带源数据指纹用于失效重算';

CREATE INDEX IF NOT EXISTS idx_period_summaries_lookup
  ON public.period_summaries (user_id, scope, period_key);

-- ============================================================
-- 2. RLS —— 只按归属过滤，绝不带 is_deleted（2026-10-19 教训）
-- ============================================================
ALTER TABLE public.period_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS period_summaries_select ON public.period_summaries;
CREATE POLICY period_summaries_select ON public.period_summaries FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS period_summaries_insert ON public.period_summaries;
CREATE POLICY period_summaries_insert ON public.period_summaries FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS period_summaries_update ON public.period_summaries;
CREATE POLICY period_summaries_update ON public.period_summaries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS period_summaries_delete ON public.period_summaries;
CREATE POLICY period_summaries_delete ON public.period_summaries FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 3. 执行后自检：应看到 4 条策略，SELECT 的 qual 只含 user_id
-- ============================================================
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'period_summaries'
ORDER BY cmd;
