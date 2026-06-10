-- Add public sharing support to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Allow anyone (unauthenticated) to read public reports
CREATE POLICY "allow_public_read" ON public.reports
  FOR SELECT USING (is_public = true);
