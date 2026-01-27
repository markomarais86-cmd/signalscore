-- Create storage bucket for exports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exports', 'exports', false, 52428800, ARRAY['text/csv', 'application/csv'])
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can only download files from their org
CREATE POLICY "Users can download their org exports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exports' 
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM user_profiles WHERE user_id = auth.uid()
  )
);

-- RLS policy: Service role can insert export files (edge function uses service key)
CREATE POLICY "Service role can upload exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports');

-- RLS policy: Allow deletion for org members
CREATE POLICY "Users can delete their org exports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exports' 
  AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM user_profiles WHERE user_id = auth.uid()
  )
);