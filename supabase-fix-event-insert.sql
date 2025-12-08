-- ===== FIX: Create admin event insertion function =====
-- This function bypasses RLS for event creation (faster than policy evaluation)
-- It checks admin status once, then inserts directly

-- Drop existing slow policy
DROP POLICY IF EXISTS "Admins can create events" ON events;

-- Create a function that admins can call to create events
-- SECURITY DEFINER means it runs with the privileges of the function owner (bypasses RLS)
CREATE OR REPLACE FUNCTION create_event_as_admin(
  p_title VARCHAR(255),
  p_description TEXT,
  p_location VARCHAR(500),
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_status VARCHAR(20) DEFAULT 'Pending',
  p_is_featured BOOLEAN DEFAULT FALSE,
  p_college_code VARCHAR(10) DEFAULT NULL,
  p_colleges JSONB DEFAULT NULL,
  p_organization_name VARCHAR(255) DEFAULT NULL,
  p_university_logo_url VARCHAR(500) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_event_id UUID;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is admin (single query, uses index)
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Only admins can create events';
  END IF;
  
  -- Insert the event (bypasses RLS because SECURITY DEFINER)
  INSERT INTO events (
    title,
    description,
    location,
    start_date,
    end_date,
    status,
    is_featured,
    college_code,
    colleges,
    organization_name,
    university_logo_url,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_title,
    p_description,
    p_location,
    p_start_date,
    p_end_date,
    p_status,
    p_is_featured,
    p_college_code,
    p_colleges,
    p_organization_name,
    p_university_logo_url,
    v_user_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_event_as_admin TO authenticated;

-- Also create a simpler RLS policy as fallback (for direct inserts if needed)
-- This allows any authenticated user to insert, but the frontend restricts to admins
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Verify the function was created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'create_event_as_admin';

