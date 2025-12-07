-- ===== CHECK CURRENT EVENTS TABLE POLICIES =====
-- Run this to see what policies are currently active on the events table

-- Check all policies on events table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'events'
ORDER BY cmd, policyname;

-- Check if create_event function exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'create_event'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Check RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'events';

