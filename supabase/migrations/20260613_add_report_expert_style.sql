-- Add expert_style column to reports table to track which expert generated the report
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS expert_style VARCHAR(50) DEFAULT NULL;
