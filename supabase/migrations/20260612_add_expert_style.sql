-- Add expert style configuration to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expert_style VARCHAR(50) DEFAULT 'warm_companion';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_expert_tags JSONB DEFAULT NULL;
