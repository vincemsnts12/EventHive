-- ============================================
-- CREATE PROFILE IMAGES STORAGE BUCKET AND POLICIES
-- ============================================
-- Run this in the Supabase SQL Editor
-- ============================================

-- Step 1: Create the profile-images bucket (if it doesn't exist)
-- Note: You may need to create this in Supabase Dashboard > Storage > New Bucket
-- Name: profile-images
-- Public: TRUE

-- Step 2: Storage policies for profile-images bucket
-- These allow users to upload/view their own profile images

-- Allow authenticated users to upload images to their own folder
INSERT INTO storage.policies (name, bucket_id, definition)
SELECT
  'Users can upload own profile images',
  'profile-images',
  '(bucket_id = ''profile-images'' AND auth.uid()::text = (storage.foldername(name))[1])'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies 
  WHERE name = 'Users can upload own profile images' 
  AND bucket_id = 'profile-images'
);

-- Allow authenticated users to update their own images
INSERT INTO storage.policies (name, bucket_id, definition, operation)
SELECT
  'Users can update own profile images',
  'profile-images',
  '(bucket_id = ''profile-images'' AND auth.uid()::text = (storage.foldername(name))[1])',
  'UPDATE'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies 
  WHERE name = 'Users can update own profile images' 
  AND bucket_id = 'profile-images'
);

-- Allow public read access (profile images are public)
INSERT INTO storage.policies (name, bucket_id, definition, operation)
SELECT
  'Anyone can view profile images',
  'profile-images',
  'true',
  'SELECT'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies 
  WHERE name = 'Anyone can view profile images' 
  AND bucket_id = 'profile-images'
);

-- ============================================
-- ALTERNATIVE: Simple RLS Policies via SQL Editor
-- ============================================
-- If the above doesn't work, run these in SQL Editor:

-- DROP OLD POLICIES (if any errors)
-- DROP POLICY IF EXISTS "Users can upload own profile images" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update own profile images" ON storage.objects;
-- DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

-- Create policies on storage.objects table (the standard way)

-- 1. Allow authenticated users to INSERT into their own folder
CREATE POLICY "profile_images_insert" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Allow authenticated users to UPDATE their own images
CREATE POLICY "profile_images_update" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow public SELECT (anyone can view profile images)
CREATE POLICY "profile_images_select" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- ============================================
-- MANUAL STEPS IN SUPABASE DASHBOARD
-- ============================================
-- 1. Go to Storage > New Bucket
-- 2. Name: profile-images
-- 3. Check "Public bucket" = TRUE
-- 4. Click Create
-- 5. Then run the SQL policies above
