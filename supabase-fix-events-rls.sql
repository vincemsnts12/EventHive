-- ===== FIX EVENTS RLS POLICIES =====
-- Update the INSERT policy to only allow admins to create events
-- Keep SELECT policy as "viewable by everyone"

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;

-- Create new INSERT policy that only allows admins
CREATE POLICY "Only admins can create events"
  ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Verify the SELECT policy is still correct (should already exist)
-- "Events are viewable by everyone" with USING (true) - this is correct

-- Note: The UPDATE and DELETE policies should already be correct:
-- "Admins can update events" - checks is_admin = TRUE
-- "Admins can delete events" - checks is_admin = TRUE

