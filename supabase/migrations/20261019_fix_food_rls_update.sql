-- 2026-10-19 修复（v3，已在线上库执行）：每日好饭相关表的软删被 RLS 拒绝
--
-- 现象：菜谱 / 饮食记录 / 自定义食物点删除后短暂消失又出现，刷新后仍在。
--
-- 根因（v1、v2 都没抓对，v3 用实验定位）：
--   PostgreSQL 在表启用 RLS 时，UPDATE 产生的**新行**不仅要满足 UPDATE 策略的
--   WITH CHECK，还要满足该表的 **SELECT 策略**。而 SELECT 策略里写了
--   `is_deleted = false`，软删恰恰是把 is_deleted 改成 true —— 新行必然不满足，
--   于是报 `42501 new row violates row-level security policy`。
--
--   四条对照实验（用一张全新表复现，与本表结构无关，属 PG 通用行为）：
--     SELECT 策略            UPDATE 的 WITH CHECK  结果
--     无                     user_id = auth.uid()  通过
--     user_id AND is_deleted=false   user_id = auth.uid()  拒绝
--     user_id（无 is_deleted）        user_id = auth.uid()  通过
--     user_id AND is_deleted=false   true                  拒绝
--
--   在这之前误判过两轮：v1 以为是 FOR ALL 策略（只删了 cmd='UPDATE'），
--   v2 以为还有 FOR ALL 残留（删光重建但 SELECT 仍带 is_deleted）——
--   两者都不解决问题，因为真正的拦截来自 SELECT 策略本身。
--
-- 修复思路：把 `is_deleted = false` 从 SELECT 策略里拿掉，改由查询层过滤。
--   代码侧 31 处读取**已全部**显式 `.eq("is_deleted", false)`（9 处未过滤的
--   全是 insert/update 写入），因此不依赖 RLS 隐藏已删行，风险可控。
--   RLS 仍然按 `user_id = auth.uid()` 做租户隔离，越权访问依旧被挡。
--
-- 注意：软删后行仍在库中（is_deleted=true），只是所有查询都过滤掉；
--   物理删除走 DELETE 策略，同样只允许本人。
--
-- 本脚本幂等，可重复执行。

-- ① 执行前现状（留档）
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
--    SELECT **不再**过滤 is_deleted（否则软删的新行过不了校验）
CREATE POLICY recipes_select ON public.recipes FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY recipes_insert ON public.recipes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_update ON public.recipes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_delete ON public.recipes FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY recipe_ingredients_select ON public.recipe_ingredients FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY recipe_ingredients_insert ON public.recipe_ingredients FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipe_ingredients_update ON public.recipe_ingredients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipe_ingredients_delete ON public.recipe_ingredients FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY diet_logs_select ON public.diet_logs FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY diet_logs_insert ON public.diet_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY diet_logs_update ON public.diet_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY diet_logs_delete ON public.diet_logs FOR DELETE
  USING (user_id = auth.uid());

-- ④ foods：系统食物全局可见，自定义食物仅本人可见
CREATE POLICY foods_select ON public.foods FOR SELECT
  USING ((source = 'system'::text) OR (user_id = auth.uid()));
CREATE POLICY foods_insert ON public.foods FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY foods_update ON public.foods FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY foods_delete ON public.foods FOR DELETE
  USING (user_id = auth.uid());

-- ⑤ 执行后自检：四张表各 4 条策略；SELECT 的 qual 里不应再出现 is_deleted
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('recipes', 'recipe_ingredients', 'diet_logs', 'foods')
ORDER BY tablename, cmd;
