-- 修复：补 REVOKE EXECUTE FROM public
-- 原因：PostgreSQL 默认 GRANT EXECUTE TO public，仅 REVOKE anon/authenticated 不够
-- 执行方式：在 Supabase SQL Editor 手动执行

REVOKE EXECUTE ON FUNCTION public.delete_user_account(UUID) FROM public;

-- 清理测试调用产生的无效日志（user_id 不存在的记录）
DELETE FROM deletion_logs WHERE user_id = '00000000-0000-0000-0000-000000000000';
