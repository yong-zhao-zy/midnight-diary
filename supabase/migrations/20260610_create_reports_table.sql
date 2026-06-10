-- Create reports table for narrative AI-generated period reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  theme VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient user-scoped queries
CREATE INDEX idx_reports_user_id ON public.reports(user_id);

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own reports
CREATE POLICY "select_own" ON public.reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON public.reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON public.reports FOR DELETE USING (auth.uid() = user_id);
