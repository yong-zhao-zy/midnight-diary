-- 灵感系统（珍藏碎片 + 心灵练习 + 打卡日志）
-- 包含：3 张新表 + RLS + 索引 + 升级 delete_user_account RPC 覆盖新表
-- 执行方式：在 Supabase SQL Editor 手动执行

-- ============================================================
-- 1. notes 表（珍藏碎片）
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai_interpretation', 'manual')),
  source_diary_id UUID REFERENCES diaries(id),
  source_diary_date DATE,
  sort_order SERIAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_user_isolation ON notes
  USING (user_id = auth.uid() AND is_deleted = false)
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_diary ON notes(source_diary_id) WHERE is_deleted = false;

-- ============================================================
-- 2. practices 表（心灵练习）
-- ============================================================

CREATE TABLE IF NOT EXISTS practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai_interpretation', 'manual')),
  source_diary_id UUID REFERENCES diaries(id),
  source_diary_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY practices_user_isolation ON practices
  USING (user_id = auth.uid() AND is_deleted = false)
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_practices_user ON practices(user_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practices_status ON practices(user_id, is_deleted, status, created_at DESC);

-- ============================================================
-- 3. practice_logs 表（打卡日志 — 日历级原子记录）
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  practiced_at DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, practice_id, practiced_at)
);

ALTER TABLE practice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY practice_logs_user_isolation ON practice_logs
  USING (user_id = auth.uid() AND is_deleted = false)
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_plogs_practice ON practice_logs(practice_id, practiced_at DESC);
CREATE INDEX IF NOT EXISTS idx_plogs_user ON practice_logs(user_id, is_deleted, practiced_at DESC);

-- ============================================================
-- 4. 升级 delete_user_account RPC —— 覆盖 notes / practices / practice_logs
--    逻辑：在原 Step 2 软标记 + Step 3 物理删除 两个块中追加 3 张新表
--    注意：practice_logs 有 ON DELETE CASCADE（随 practice 自动删），但为审计一致仍显式处理
-- ============================================================

DROP FUNCTION IF EXISTS public.delete_user_account(UUID);

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Step 1: 记录注销审计日志（pending）
  INSERT INTO deletion_logs (user_id, status) VALUES (target_user_id, 'pending');

  -- Step 2: 软标记所有业务表（审计轨迹）
  UPDATE diaries         SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE user_memories   SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE reports         SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE prompt_configs  SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE notes           SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE practices       SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE practice_logs   SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE profiles        SET deleted_at = now(), is_deleted = true WHERE id       = target_user_id;

  -- Step 3: 物理删除业务表（先删依赖子表，避免 FK 阻塞）
  DELETE FROM practice_logs  WHERE user_id = target_user_id;
  DELETE FROM practices      WHERE user_id = target_user_id;
  DELETE FROM notes          WHERE user_id = target_user_id;
  DELETE FROM diaries        WHERE user_id = target_user_id;
  DELETE FROM user_memories  WHERE user_id = target_user_id;
  DELETE FROM reports        WHERE user_id = target_user_id;
  DELETE FROM prompt_configs WHERE user_id = target_user_id;
  DELETE FROM profiles       WHERE id       = target_user_id;

  -- Step 4: 回收内测码（used_by/used_at 置 NULL，码可复用）
  UPDATE invite_codes
  SET used_by = NULL, used_at = NULL, deleted_at = NULL, is_deleted = false
  WHERE used_by = target_user_id;

  -- Step 5: 删除 auth 用户（级联清理 auth.identities / auth.sessions / auth.refresh_tokens）
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Step 6: 更新审计日志为已完成
  UPDATE deletion_logs
  SET status = 'completed', completed_at = now()
  WHERE user_id = target_user_id AND status = 'pending';

  RETURN 'ok';

EXCEPTION WHEN OTHERS THEN
  -- 写入失败日志（EXCEPTION 块内不回滚）
  INSERT INTO deletion_logs (user_id, status, error_message)
  VALUES (target_user_id, 'failed', SQLERRM);
  -- 返回错误信息（不 RAISE，避免回滚 EXCEPTION 块内的日志写入）
  RETURN 'error: ' || SQLERRM;
END;
$$;

-- 权限：仅 service role 可调用
REVOKE EXECUTE ON FUNCTION public.delete_user_account(UUID) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO service_role;
