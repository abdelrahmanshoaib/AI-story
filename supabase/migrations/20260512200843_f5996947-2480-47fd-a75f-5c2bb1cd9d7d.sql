
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS font_family text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS font_size text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS color_theme text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS app_style text DEFAULT 'playful';

CREATE TABLE IF NOT EXISTS public.vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  word text NOT NULL,
  translation text,
  language text NOT NULL DEFAULT 'ar',
  story_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, word, language)
);

ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own vocabulary" ON public.vocabulary
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own vocabulary" ON public.vocabulary
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own vocabulary" ON public.vocabulary
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own vocabulary" ON public.vocabulary
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vocabulary_user_created_idx
  ON public.vocabulary (user_id, created_at DESC);
