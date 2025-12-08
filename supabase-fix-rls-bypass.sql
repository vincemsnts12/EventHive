-- =============================================
-- FIX: Bypass RLS in create_event_as_admin function
-- =============================================
-- This script updates the function to explicitly bypass RLS
-- Run this in the Supabase SQL Editor

-- Drop the existing function first
DROP FUNCTION IF EXISTS create_event_as_admin(
  VARCHAR(255), TEXT, VARCHAR(500), 
  TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE,
  VARCHAR(20), BOOLEAN, VARCHAR(10), JSONB, VARCHAR(255), VARCHAR(500)
);

-- Recreate with RLS bypass
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
  -- Get the current user from JWT
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user is admin (single indexed query)
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Only admins can create events';
  END IF;
  
  -- BYPASS RLS: Disable row security for this transaction only
  -- This works because SECURITY DEFINER runs as the function owner (postgres)
  SET LOCAL row_security = off;
  
  -- Insert the event directly (no RLS policy evaluation)
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
    COALESCE(p_status, 'Pending'),
    COALESCE(p_is_featured, FALSE),
    p_college_code,
    p_colleges,
    p_organization_name,
    p_university_logo_url,
    v_user_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_event_id;
  
  -- RLS is automatically restored after transaction ends
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_event_as_admin TO authenticated;

-- =============================================
-- VERIFICATION
-- =============================================
-- Check the function was created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'create_event_as_admin';

-- =============================================
-- DONE!
-- =============================================
-- The function now explicitly bypasses RLS using SET LOCAL row_security = off
-- This should eliminate the intermittent timeout issues
-- 
-- Test by creating an event from the admin dashboard
-- =============================================

