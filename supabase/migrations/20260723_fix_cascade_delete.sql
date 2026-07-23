-- 级联软删 practice（原子性 RPC）
-- 解决浏览器端两步 UPDATE 无法保证原子性的问题
-- 执行方式：在 Supabase SQL Editor 手动执行

CREATE OR REPLACE FUNCTION public.soft_delete_practice(target_practice_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 校验归属（防止越权）
  SELECT user_id INTO v_user_id FROM public.practices
  WHERE id = target_practice_id AND is_deleted = false;

  IF v_user_id IS NULL THEN
    RETURN 'error: practice not found';
  END IF;

  -- auth.uid() 对 authenticated 角色返回用户 ID；
  -- 对 service_role 返回 NULL（跳过校验，信任服务端调用方已自行鉴权）
  IF auth.uid() IS NOT NULL AND v_user_id != auth.uid() THEN
    RETURN 'error: forbidden';
  END IF;

  -- 事务内级联软删（任一失败则整体回滚）
  UPDATE public.practice_logs
  SET is_deleted = true, deleted_at = now()
  WHERE practice_id = target_practice_id AND is_deleted = false;

  UPDATE public.practices
  SET is_deleted = true, deleted_at = now(), updated_at = now()
  WHERE id = target_practice_id AND is_deleted = false;

  RETURN 'ok';
END;
$$;

-- 权限：authenticated（浏览器端）+ service_role（API 路由）可调用
REVOKE EXECUTE ON FUNCTION public.soft_delete_practice(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.soft_delete_practice(UUID) TO authenticated, service_role;
