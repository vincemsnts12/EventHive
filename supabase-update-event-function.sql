-- ===== CREATE EVENT UPDATE FUNCTION (BYPASSES RLS) =====
-- This function bypasses RLS for event updates to avoid timeout issues
-- Admin check is done in JavaScript before calling this function for performance
-- Note: This function updates ALL fields - pass current values for fields you don't want to change

-- Drop all versions of the function if they exist
DROP FUNCTION IF EXISTS public.update_event CASCADE;

CREATE OR REPLACE FUNCTION public.update_event(
  p_event_id UUID,
  p_title VARCHAR(255),
  p_description TEXT,
  p_location VARCHAR(500),
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_college_code VARCHAR(10),
  p_organization_name VARCHAR(255),
  p_university_logo_url VARCHAR(500),
  p_status VARCHAR(20),
  p_is_featured BOOLEAN,
  p_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- SECURITY: Server-side admin check (cannot be bypassed by editing localStorage)
  -- Uses optimized is_admin() function which is STABLE and uses indexes
  -- Since this is SECURITY DEFINER, it can call is_admin() even though EXECUTE is revoked
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update events';
  END IF;
  
  -- Check if event exists
  SELECT id INTO v_event_id
  FROM events
  WHERE id = p_event_id;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event with ID % not found', p_event_id;
  END IF;
  
  -- Update event directly (bypasses RLS due to SECURITY DEFINER)
  -- Note: Admin check above ensures security even though RLS is bypassed
  UPDATE events
  SET 
    title = p_title,
    description = p_description,
    location = p_location,
    start_date = p_start_date,
    end_date = p_end_date,
    college_code = p_college_code,
    organization_name = p_organization_name,
    university_logo_url = p_university_logo_url,
    status = p_status,
    is_featured = p_is_featured,
    updated_at = COALESCE(p_updated_at, NOW())
  WHERE id = p_event_id
  RETURNING id INTO v_event_id;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event with ID % not found or could not be updated', p_event_id;
  END IF;
  
  RETURN v_event_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_event TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.update_event IS 'Updates an event with admin validation. Bypasses RLS to avoid timeout issues. Returns the event ID.';

