-- Insert the assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the assets bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Allow authenticated users to insert files into the assets bucket
CREATE POLICY "Authenticated users can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'assets' AND auth.uid() = owner);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assets' AND auth.uid() = owner);
