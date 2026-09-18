-- AI 食物估算：foods 表 source 列加 'ai' 值
-- ⚠️ 需在 Supabase SQL Editor 手动执行

-- 1. source CHECK 约束加 'ai'
ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_source_check;
ALTER TABLE foods ADD CONSTRAINT foods_source_check CHECK (source IN ('system', 'user', 'ai'));

-- 2. AI 食物按用户去重（同用户同名只存一条）
CREATE UNIQUE INDEX IF NOT EXISTS foods_ai_name_uniq
  ON foods (user_id, name) WHERE source = 'ai' AND is_deleted = false;

-- RLS 无需改动：
-- 现有 SELECT 策略 (source='system' AND is_deleted=false) OR (user_id=auth.uid() AND is_deleted=false)
-- 第二分支已覆盖 source='ai' 且 user_id 有值的食物
-- INSERT/UPDATE/DELETE 策略 user_id=auth.uid() 已覆盖
