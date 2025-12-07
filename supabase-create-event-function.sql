-- ===== CREATE EVENT INSERT FUNCTION (BYPASSES RLS) =====
-- This function bypasses RLS for event inserts to avoid timeout issues
-- Admin check is done in JavaScript before calling this function for performance
-- This avoids database-level admin checks that were causing timeouts

-- Drop function if it exists to ensure clean recreation
DROP FUNCTION IF EXISTS public.create_event CASCADE;

CREATE OR REPLACE FUNCTION public.create_event(
  p_title VARCHAR(255),
  p_description TEXT,
  p_location VARCHAR(500),
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_college_code VARCHAR(10),
  p_organization_name VARCHAR(255),
  p_university_logo_url VARCHAR(500),
  p_created_by UUID,
  p_status VARCHAR(20) DEFAULT 'Pending',
  p_is_featured BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_current_user_id UUID;
BEGIN
  -- SECURITY: Get current authenticated user (cannot be spoofed)
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create events';
  END IF;
  
  -- SECURITY: Server-side admin check (cannot be bypassed by editing localStorage)
  -- Uses optimized is_admin() function which is STABLE and uses indexes
  -- Since this is SECURITY DEFINER, it can call is_admin() even though EXECUTE is revoked
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create events';
  END IF;
  
  -- Insert event directly (bypasses RLS due to SECURITY DEFINER)
  -- Admin validation happens in JavaScript before this function is called
  -- Use current user ID, not the parameter (prevents spoofing)
  INSERT INTO events (
    title,
    description,
    location,
    start_date,
    end_date,
    college_code,
    organization_name,
    university_logo_url,
    created_by,
    status,
    is_featured
  ) VALUES (
    p_title,
    p_description,
    p_location,
    p_start_date,
    p_end_date,
    p_college_code,
    p_organization_name,
    p_university_logo_url,
    v_current_user_id,  -- Use verified current user, not parameter
    p_status,
    p_is_featured
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_event TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.create_event IS 'Creates an event with admin validation. Bypasses RLS to avoid timeout issues.';

