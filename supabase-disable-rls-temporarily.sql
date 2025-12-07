-- ===== TEMPORARILY DISABLE RLS FOR TESTING =====
-- ONLY USE THIS FOR TESTING - NOT FOR PRODUCTION
-- This will help us determine if RLS is causing the timeout

-- Check current RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'events';

-- Temporarily disable RLS (FOR TESTING ONLY)
-- ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS later:
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- NOTE: This removes all security checks. Only use for debugging.
-- After testing, re-enable RLS and use proper policies.

