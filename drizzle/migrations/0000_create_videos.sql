CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text NOT NULL,
  mode text NOT NULL,
  prompt text NOT NULL,
  duration integer NOT NULL,
  aspect_ratio text NOT NULL,
  status text NOT NULL DEFAULT 'generating',
  storage_path text,
  poster_path text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own videos" ON public.videos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own videos" ON public.videos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX videos_user_created_idx ON public.videos (user_id, created_at DESC);

CREATE POLICY "Users read own video files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own video files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);