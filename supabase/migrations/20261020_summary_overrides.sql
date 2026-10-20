-- 2026-10-20 摘要覆盖层（P1：日摘要可编辑）
--
-- 背景：AI 生成的 module_summaries 不一定准，用户需要能改；且周/月摘要（P2/P3）
-- 没有实体行可挂，需要按「周期 + 模块」独立存储。
--
-- 设计：
--   - 只存用户编辑过的内容（override），AI 原文仍留在 diaries.module_summaries
--   - 读取时：显示 = override ?? AI 摘要。AI 重新生成永不改写 override
--   - 覆盖层为空 = 没有编辑，天然兼容历史数据（无需数据迁移）
--
-- 删除账号：user_id 外键 ON DELETE CASCADE —— delete_user_account 删 auth.users 时
-- 本表行自动级联清除，因此**不需要**改那个 RPC（避免复制陈旧函数体覆盖好饭表的清理逻辑）。
--
-- 本脚本幂等，可重复执行。

-- ============================================================
-- 1. 表结构
-- ============================================================
CREATE TABLE IF NOT EXISTS public.summary_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL CHECK (scope IN ('day', 'week', 'month')),
  -- day:   'YYYY-MM-DD'（= diaries.diary_date）
  -- week:  'YYYY-MM-DD'（该周周一）
  -- month: 'YYYY-MM'
  period_key  TEXT NOT NULL,
  module_id   TEXT NOT NULL,          -- m1..m4（含已停用模块，历史摘要仍要能显示）
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, period_key, module_id)
);

COMMENT ON TABLE public.summary_overrides IS '用户手动编辑的摘要覆盖层（日/周/月），优先级高于 AI 摘要';

CREATE INDEX IF NOT EXISTS idx_summary_overrides_lookup
  ON public.summary_overrides (user_id, scope, period_key);

-- ============================================================
-- 2. RLS —— 只按归属过滤，不带任何 is_deleted 条件
--    （教训：软删表在 SELECT 策略里写 is_deleted=false 会让 UPDATE 新行违反策略）
-- ============================================================
ALTER TABLE public.summary_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS summary_overrides_select ON public.summary_overrides;
CREATE POLICY summary_overrides_select ON public.summary_overrides FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS summary_overrides_insert ON public.summary_overrides;
CREATE POLICY summary_overrides_insert ON public.summary_overrides FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS summary_overrides_update ON public.summary_overrides;
CREATE POLICY summary_overrides_update ON public.summary_overrides FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS summary_overrides_delete ON public.summary_overrides;
CREATE POLICY summary_overrides_delete ON public.summary_overrides FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 3. 执行后自检：应看到 4 条策略，SELECT 的 qual 只含 user_id
-- ============================================================
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'summary_overrides'
ORDER BY cmd;
