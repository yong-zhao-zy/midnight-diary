-- 提示词实验坊 (Prompt Lab) - 用户自定义提示词版本管理
-- 每个用户可为 4 种类型 (guide/analysis/summary/report) 维护多个版本，同时仅一个生效

CREATE TABLE IF NOT EXISTS public.prompt_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  version_number DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  name VARCHAR(255) NOT NULL DEFAULT '系统自带',
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 类型取值约束
ALTER TABLE public.prompt_configs
  ADD CONSTRAINT prompt_configs_type_check
  CHECK (type IN ('guide', 'analysis', 'summary', 'report'));

-- 查询加速索引
CREATE INDEX IF NOT EXISTS idx_prompt_configs_user_type
  ON public.prompt_configs(user_id, type);

-- 复合唯一约束：同一用户同一类型下，同时只能有一个 is_active = true
CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_configs_active_per_type
  ON public.prompt_configs(user_id, type)
  WHERE (is_active = true);

-- 启用 RLS
ALTER TABLE public.prompt_configs ENABLE ROW LEVEL SECURITY;

-- 用户仅能操作自己的提示词
CREATE POLICY "select_own_prompts" ON public.prompt_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own_prompts" ON public.prompt_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_prompts" ON public.prompt_configs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_prompts" ON public.prompt_configs
  FOR DELETE USING (auth.uid() = user_id);
