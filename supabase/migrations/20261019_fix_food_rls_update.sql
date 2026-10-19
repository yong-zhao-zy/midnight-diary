-- 2026-10-19 修复：每日好饭相关表的软删 UPDATE 被 RLS WITH CHECK 拒绝
--
-- 现象：菜谱 / 饮食记录 / 自定义食物点击删除后短暂消失又出现，刷新后仍在。
-- 根因：线上库的 UPDATE 策略 WITH CHECK 里带了 `is_deleted = false`
--       （与 SELECT 策略混用），导致「把 is_deleted 改成 true」这个动作
--       本身违反策略 → PostgREST 报 "new row violates row-level security
--       policy" → API 返回 500 → 前端乐观删除回滚。
--       与 2026-07-27 notes 的 RLS 问题同源（见 20260727_fix_notes_rls.sql）。
-- 修复：删除四张表现有的全部 UPDATE 策略，重建为只按归属判定：
--       USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
--       （与仓库 20260914_food_health_system.sql 的原始定义一致）
-- 幂等：DO 块按 pg_policies 动态 DROP，可重复执行。

-- ① 执行前查看现状（可选，结果会显示在结果面板）
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
  AND cmd = 'UPDATE'
ORDER BY tablename;

-- ② 动态删除四张表现有的全部 UPDATE 策略
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
      AND cmd = 'UPDATE'
  LOOP
    RAISE NOTICE 'dropping policy % on %', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ③ 重建：归属即合法，is_deleted 的变化不受限制（软删 / 恢复都靠它）
CREATE POLICY recipes_update ON public.recipes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY diet_logs_update ON public.diet_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY foods_update ON public.foods FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ④ 执行后自检：应各返回一行，且 with_check 只有 user_id 条件
SELECT tablename, policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
  AND cmd = 'UPDATE'
ORDER BY tablename;
