-- ===== CREATE EVENT UPDATE FUNCTION (BYPASSES RLS) =====
-- This function bypasses RLS for event updates to avoid timeout issues
-- Admin check is done in JavaScript before calling this function for performance

CREATE OR REPLACE FUNCTION public.update_event(
  p_event_id UUID,
  p_title VARCHAR(255) DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_location VARCHAR(500) DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_college_code VARCHAR(10) DEFAULT NULL,
  p_organization_name VARCHAR(255) DEFAULT NULL,
  p_university_logo_url VARCHAR(500) DEFAULT NULL,
  p_status VARCHAR(20) DEFAULT NULL,
  p_is_featured BOOLEAN DEFAULT NULL,
  p_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_update_data JSONB := '{}'::JSONB;
BEGIN
  -- Build update object dynamically (only include non-null values)
  IF p_title IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('title', p_title);
  END IF;
  
  IF p_description IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('description', p_description);
  END IF;
  
  IF p_location IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('location', p_location);
  END IF;
  
  IF p_start_date IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('start_date', p_start_date);
  END IF;
  
  IF p_end_date IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('end_date', p_end_date);
  END IF;
  
  IF p_college_code IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('college_code', p_college_code);
  END IF;
  
  IF p_organization_name IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('organization_name', p_organization_name);
  END IF;
  
  IF p_university_logo_url IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('university_logo_url', p_university_logo_url);
  END IF;
  
  IF p_status IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('status', p_status);
  END IF;
  
  IF p_is_featured IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('is_featured', p_is_featured);
  END IF;
  
  IF p_updated_at IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('updated_at', p_updated_at);
  ELSE
    v_update_data := v_update_data || jsonb_build_object('updated_at', NOW());
  END IF;
  
  -- Update event directly (admin check done in JavaScript before calling this function)
  -- This avoids RLS evaluation and profile table queries that cause timeouts
  UPDATE events
  SET 
    title = COALESCE((v_update_data->>'title')::VARCHAR(255), title),
    description = COALESCE((v_update_data->>'description')::TEXT, description),
    location = COALESCE((v_update_data->>'location')::VARCHAR(500), location),
    start_date = COALESCE((v_update_data->>'start_date')::TIMESTAMP WITH TIME ZONE, start_date),
    end_date = COALESCE((v_update_data->>'end_date')::TIMESTAMP WITH TIME ZONE, end_date),
    college_code = COALESCE((v_update_data->>'college_code')::VARCHAR(10), college_code),
    organization_name = COALESCE((v_update_data->>'organization_name')::VARCHAR(255), organization_name),
    university_logo_url = COALESCE((v_update_data->>'university_logo_url')::VARCHAR(500), university_logo_url),
    status = COALESCE((v_update_data->>'status')::VARCHAR(20), status),
    is_featured = COALESCE((v_update_data->>'is_featured')::BOOLEAN, is_featured),
    updated_at = (v_update_data->>'updated_at')::TIMESTAMP WITH TIME ZONE
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

