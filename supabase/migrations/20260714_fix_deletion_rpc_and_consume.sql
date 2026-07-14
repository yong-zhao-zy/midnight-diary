-- 修复：注销 RPC 容错增强 + 内测码回收 + 消费幂等
-- 问题根因：
--   1. 注销 RPC 无 EXCEPTION 处理，auth.users 删除失败时无错误日志
--   2. 注销时物理删除 invite_codes 行，码不可回收
--   3. consume-invite-code API 无幂等保护 + profile 不存在时静默失败
-- 执行方式：在 Supabase SQL Editor 手动执行

-- ============================================================
-- 1. deletion_logs 增加 error_message 列
-- ============================================================
ALTER TABLE public.deletion_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ============================================================
-- 2. 重写 delete_user_account RPC
--    - 返回 TEXT（'ok' 或 'error: ...'）便于 API 层判断
--    - BEGIN/EXCEPTION/END 容错：失败时写入 failed 日志 + 返回错误信息
--    - 内测码回收：UPDATE used_by=NULL 而非 DELETE（码可复用）
--    - 日志时机：pending → completed / failed
-- ============================================================

-- 先 DROP 旧函数（返回类型从 VOID 改为 TEXT，必须先删再建）
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
  UPDATE diaries        SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE user_memories  SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE reports        SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE prompt_configs  SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE profiles       SET deleted_at = now(), is_deleted = true WHERE id       = target_user_id;

  -- Step 3: 物理删除业务表
  DELETE FROM diaries        WHERE user_id = target_user_id;
  DELETE FROM user_memories  WHERE user_id = target_user_id;
  DELETE FROM reports        WHERE user_id = target_user_id;
  DELETE FROM prompt_configs  WHERE user_id = target_user_id;
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

-- ============================================================
-- 3. 增加索引：invite_codes.used_by 查询性能（幂等检查用）
--    已有 idx_invite_codes_used_by，无需重复创建
-- ============================================================
