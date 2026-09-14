-- 每日好饭模块（食物库 + 菜谱 + 饮食记录 + 身体数据）
-- 包含：5 张新表 + profiles 新增列 + RLS + 索引 + 升级 delete_user_account RPC 覆盖新表
-- 执行方式：在 Supabase SQL Editor 手动执行

-- ============================================================
-- 0. pg_trgm 扩展（食物名称模糊搜索用）
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. profiles 表新增 health_profile 列
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_profile JSONB DEFAULT NULL;
-- 结构: {height_cm, birth_date, gender, activity_level, calorie_goal, target_weight_kg}

-- ============================================================
-- 2. foods 表（食物库 — 系统预置 + 用户自定义）
-- ============================================================
CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- system 食物为 NULL
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'user')),
  category TEXT,
  -- 宏量营养素（每 100g 可食部分，NOT NULL）
  energy_kcal NUMERIC(8,2) NOT NULL DEFAULT 0,
  protein_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  carb_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  fiber_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- 微量营养素（system 食物填充，user 食物为 NULL）
  sodium_mg NUMERIC(8,2),
  potassium_mg NUMERIC(8,2),
  calcium_mg NUMERIC(8,2),
  magnesium_mg NUMERIC(8,2),
  iron_mg NUMERIC(8,2),
  zinc_mg NUMERIC(8,2),
  selenium_ug NUMERIC(8,2),
  vit_a_ugre NUMERIC(8,2),
  vit_b1_mg NUMERIC(8,2),
  vit_b2_mg NUMERIC(8,2),
  vit_b6_mg NUMERIC(8,2),
  vit_b12_ug NUMERIC(8,2),
  vit_c_mg NUMERIC(8,2),
  vit_d_ug NUMERIC(8,2),
  vit_e_mg NUMERIC(8,2),
  -- 默认份量
  default_serving_g NUMERIC(8,2) DEFAULT 100,
  default_serving_name TEXT DEFAULT '100g',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- system 食物对所有认证用户可见；user 食物仅本人可见
CREATE POLICY foods_select ON foods FOR SELECT
  USING (
    (source = 'system' AND is_deleted = false)
    OR (user_id = auth.uid() AND is_deleted = false)
  );
CREATE POLICY foods_insert ON foods FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY foods_update ON foods FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY foods_delete ON foods FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_foods_system ON foods(source, is_deleted, name);
CREATE INDEX IF NOT EXISTS idx_foods_user ON foods(user_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON foods USING gin (name gin_trgm_ops);
-- system 食物按 name 全局唯一；user 食物按 (user_id, name) 唯一（软删后可重建）
CREATE UNIQUE INDEX IF NOT EXISTS foods_system_name_uniq ON foods(name) WHERE source = 'system' AND is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS foods_user_name_uniq ON foods(user_id, name) WHERE source = 'user' AND is_deleted = false;

-- ============================================================
-- 3. recipes 表（菜谱）
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  servings INT NOT NULL DEFAULT 1 CHECK (servings > 0),
  instructions TEXT,
  -- 每份营养素缓存（由 recipe_ingredients 汇总后写入）
  energy_kcal_per_serving NUMERIC(8,2),
  protein_g_per_serving NUMERIC(8,2),
  fat_g_per_serving NUMERIC(8,2),
  carb_g_per_serving NUMERIC(8,2),
  fiber_g_per_serving NUMERIC(8,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipes_select ON recipes FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY recipes_insert ON recipes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_update ON recipes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipes_delete ON recipes FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id, is_deleted, created_at DESC);

-- ============================================================
-- 4. recipe_ingredients 表（菜谱食材明细）
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity_g NUMERIC(10,2) NOT NULL CHECK (quantity_g > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_ingredients_select ON recipe_ingredients FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY recipe_ingredients_insert ON recipe_ingredients FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipe_ingredients_update ON recipe_ingredients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY recipe_ingredients_delete ON recipe_ingredients FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ri_recipe ON recipe_ingredients(recipe_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_ri_user ON recipe_ingredients(user_id, is_deleted);

-- ============================================================
-- 5. diet_logs 表（每日饮食记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS diet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  servings NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (servings > 0),
  quantity_g NUMERIC(10,2),
  -- 冻结营养素快照（记录时计算冻结，防后续食物/菜谱修改影响历史）
  energy_kcal NUMERIC(8,2) NOT NULL DEFAULT 0,
  protein_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  fat_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  carb_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  fiber_g NUMERIC(8,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  -- food_id 和 recipe_id 二选一
  CHECK (
    (food_id IS NOT NULL AND recipe_id IS NULL)
    OR (food_id IS NULL AND recipe_id IS NOT NULL)
  )
);

ALTER TABLE diet_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY diet_logs_select ON diet_logs FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY diet_logs_insert ON diet_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY diet_logs_update ON diet_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY diet_logs_delete ON diet_logs FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_diet_user_date ON diet_logs(user_id, is_deleted, log_date DESC, meal_type);

-- ============================================================
-- 6. body_metrics 表（身体数据 — 一天一条）
-- ============================================================
CREATE TABLE IF NOT EXISTS body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  weight_kg NUMERIC(5,1),
  waist_cm NUMERIC(5,1),
  hip_cm NUMERIC(5,1),
  chest_cm NUMERIC(5,1),
  left_arm_cm NUMERIC(5,1),
  right_arm_cm NUMERIC(5,1),
  left_thigh_cm NUMERIC(5,1),
  right_thigh_cm NUMERIC(5,1),
  body_fat_pct NUMERIC(4,1),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, log_date)
);

ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY body_metrics_select ON body_metrics FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);
CREATE POLICY body_metrics_insert ON body_metrics FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY body_metrics_update ON body_metrics FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY body_metrics_delete ON body_metrics FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_metrics(user_id, is_deleted, log_date DESC);

-- ============================================================
-- 7. 升级 delete_user_account RPC —— 覆盖 5 张新表
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
  UPDATE diaries             SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE user_memories       SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE reports             SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE prompt_configs      SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE notes               SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE practices           SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE practice_logs       SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE recipe_ingredients  SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE recipes             SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE diet_logs           SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE body_metrics        SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE foods               SET deleted_at = now(), is_deleted = true WHERE user_id = target_user_id;
  UPDATE profiles            SET deleted_at = now(), is_deleted = true WHERE id       = target_user_id;

  -- Step 3: 物理删除业务表（先删依赖子表，避免 FK 阻塞）
  DELETE FROM recipe_ingredients  WHERE user_id = target_user_id;
  DELETE FROM diet_logs            WHERE user_id = target_user_id;
  DELETE FROM body_metrics         WHERE user_id = target_user_id;
  DELETE FROM recipes              WHERE user_id = target_user_id;
  DELETE FROM foods                WHERE user_id = target_user_id;
  DELETE FROM practice_logs        WHERE user_id = target_user_id;
  DELETE FROM practices            WHERE user_id = target_user_id;
  DELETE FROM notes                WHERE user_id = target_user_id;
  DELETE FROM diaries              WHERE user_id = target_user_id;
  DELETE FROM user_memories        WHERE user_id = target_user_id;
  DELETE FROM reports              WHERE user_id = target_user_id;
  DELETE FROM prompt_configs       WHERE user_id = target_user_id;
  DELETE FROM profiles             WHERE id       = target_user_id;

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
  INSERT INTO deletion_logs (user_id, status, error_message)
  VALUES (target_user_id, 'failed', SQLERRM);
  RETURN 'error: ' || SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(UUID) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO service_role;
