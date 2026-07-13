-- 账号注销功能 — 软删除字段 + 审计日志 + 事务级联删除 RPC
-- 执行方式：在 Supabase SQL Editor 手动执行

-- ============================================================
-- 1. 业务表新增软删除字段（deleted_at + is_deleted）
-- ============================================================

-- profiles（id = auth.users.id）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- diaries
ALTER TABLE diaries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE diaries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- user_memories
ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- prompt_configs
ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- invite_codes
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. 注销审计日志表
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed'))
);

-- 启用 RLS 但不创建策略 — 仅 service role（绕过 RLS）可访问
ALTER TABLE public.deletion_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. 安全注销 RPC 函数
-- 逻辑顺序：软标记 → 日志 → 物理删除业务表 → 删 auth.users → 日志 completed
-- 整体在 PostgreSQL 事务中执行，任意一步失败全部回滚
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Step 1: 软标记所有业务表（审计轨迹）
  UPDATE diaries        SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE user_memories  SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE reports        SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE prompt_configs  SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE invite_codes   SET deleted_at = now(), is_deleted = true WHERE used_by  = target_user_id;
  UPDATE profiles       SET deleted_at = now(), is_deleted = true WHERE id       = target_user_id;

  -- Step 2: 记录注销审计日志
  INSERT INTO deletion_logs (user_id, status) VALUES (target_user_id, 'pending');

  -- Step 3: 物理删除业务表（先于 auth.users，确保 FK 不阻塞）
  DELETE FROM diaries        WHERE user_id = target_user_id;
  DELETE FROM user_memories  WHERE user_id = target_user_id;
  DELETE FROM reports        WHERE user_id = target_user_id;
  DELETE FROM prompt_configs  WHERE user_id = target_user_id;
  DELETE FROM invite_codes   WHERE used_by  = target_user_id;
  DELETE FROM profiles       WHERE id       = target_user_id;

  -- Step 4: 删除 auth 用户（级联清理 auth.identities / auth.sessions / auth.refresh_tokens）
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Step 5: 更新审计日志为已完成
  UPDATE deletion_logs
  SET status = 'completed', completed_at = now()
  WHERE user_id = target_user_id AND status = 'pending';
END;
$$;

-- 仅 service role 可调用（postgres 角色绕过 RLS）
REVOKE EXECUTE ON FUNCTION public.delete_user_account(UUID) FROM anon, authenticated;
