-- ===== SIMPLIFY EVENTS SELECT POLICY =====
-- Replace the existing SELECT policy with a simpler one that doesn't trigger other policy evaluations
-- This should improve performance for authenticated users

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;

-- Create a new, simpler SELECT policy
-- Using a simple constant true without any function calls
-- Note: WITH CHECK is only for INSERT/UPDATE, not SELECT
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

