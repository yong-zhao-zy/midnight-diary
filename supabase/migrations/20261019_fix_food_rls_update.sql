-- 2026-10-19 修复（v2）：每日好饭相关表的软删被 RLS 拒绝
--
-- 现象：菜谱 / 饮食记录 / 自定义食物点删除后短暂消失又出现，刷新后仍在。
--
-- 根因：这些表上存在 **FOR ALL** 策略（Supabase 面板默认生成的那种）：
--         USING (user_id = auth.uid() AND is_deleted = false)
--       FOR ALL 策略对 UPDATE 同样生效，且 WITH CHECK 默认继承 USING。
--       软删要把 is_deleted 从 false 改成 true，新行因此不再满足
--       `is_deleted = false` → PostgREST 报
--         "new row violates row-level security policy"
--       → API 返回 500 → 前端乐观删除回滚 → 条目复活。
--       与 2026-07-27 notes 的问题完全同源（见 20260727_fix_notes_rls.sql）。
--
-- 为什么 v1 没修好：v1 只 DROP 了 cmd = 'UPDATE' 的策略，
--       FOR ALL 策略（cmd = 'ALL'）仍在，继续拦截 UPDATE。
--
-- 本脚本：删除四张表上的**全部**策略（不限 cmd），按「一条命令一个策略」
--       重建，仅 UPDATE 放行 is_deleted 变化，SELECT 仍只看未删行。
--       可重复执行（幂等）。

-- ① 执行前现状（结果面板可见，便于留档）
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
ORDER BY tablename, cmd;

-- ② 删除四张表上的所有策略（含 FOR ALL）
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ③ recipes / recipe_ingredients / diet_logs：标准四件套
--    SELECT 只看未删；UPDATE 只校验归属（软删/恢复都靠它）
CREATE POLICY recipes_select ON public.recipes FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY recipes_insert ON public.recipes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_update ON public.recipes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_delete ON public.recipes FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY recipe_ingredients_select ON public.recipe_ingredients FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY diet_logs_select ON public.diet_logs FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY diet_logs_insert ON public.diet_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY diet_logs_update ON public.diet_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY diet_logs_delete ON public.diet_logs FOR DELETE
  USING (user_id = auth.uid());

-- ④ foods：系统食物全局可见（只读），自定义食物仅本人可见
CREATE POLICY foods_select ON public.foods FOR SELECT
  USING (
    (source = 'system' AND is_deleted = false)
    OR (user_id = auth.uid() AND is_deleted = false)
  );
CREATE POLICY foods_insert ON public.foods FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY foods_update ON public.foods FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY foods_delete ON public.foods FOR DELETE
  USING (user_id = auth.uid());

-- ⑤ 执行后自检：四张表应各 4 条策略，UPDATE 的 with_check 只含 user_id
SELECT tablename, policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
ORDER BY tablename, cmd;
