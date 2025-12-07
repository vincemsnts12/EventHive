-- ===== MINIMAL RLS POLICY FOR EVENTS INSERT =====
-- Since disabling RLS worked, we'll use the simplest possible policy
-- This only checks if user is authenticated, no admin checks

-- Re-enable RLS (if it was disabled)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop all existing INSERT policies
DROP POLICY IF EXISTS "Only admins can create events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;

-- Create the simplest possible INSERT policy
-- Just checks if user is authenticated (no admin check, no auth.uid() comparison)
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'events' AND cmd = 'INSERT';

