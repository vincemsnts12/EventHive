-- ===== EVENTHIVE SECURITY OVERHAUL - SQL CHANGES =====
-- Run this in Supabase SQL Editor
-- 
-- This script adds:
-- 1. Forgot password rate limiting via security_logs
-- 2. RPC function to check forgot password limit (server-side)
-- =====================================================

-- =====================================================
-- PART 1: FORGOT PASSWORD RATE LIMITING RPC
-- =====================================================
-- This function counts password reset requests in the last hour
-- Returns: {allowed: boolean, count: number, next_allowed_at: timestamp}

CREATE OR REPLACE FUNCTION check_forgot_password_rate_limit(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_max_requests INTEGER := 3;
  v_window_hours INTEGER := 1;
  v_oldest_request TIMESTAMP WITH TIME ZONE;
  v_next_allowed TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Count password reset requests in the last hour
  SELECT COUNT(*), MIN(created_at)
  INTO v_count, v_oldest_request
  FROM security_logs
  WHERE event_type = 'PASSWORD_RESET_REQUESTED'
    AND metadata->>'email' = LOWER(p_email)
    AND created_at > NOW() - INTERVAL '1 hour';

  -- If under limit, allow
  IF v_count < v_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'count', v_count,
      'remaining', v_max_requests - v_count,
      'next_allowed_at', NULL
    );
  ELSE
    -- Calculate when next request will be allowed
    v_next_allowed := v_oldest_request + INTERVAL '1 hour';
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'remaining', 0,
      'next_allowed_at', v_next_allowed
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to both authenticated and anonymous users
-- (forgot password is used before authentication)
GRANT EXECUTE ON FUNCTION check_forgot_password_rate_limit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_forgot_password_rate_limit(TEXT) TO anon;

-- =====================================================
-- PART 2: RECORD FORGOT PASSWORD REQUEST RPC
-- =====================================================
-- This function records a password reset request

CREATE OR REPLACE FUNCTION record_forgot_password_request(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO security_logs (event_type, metadata, message)
  VALUES (
    'PASSWORD_RESET_REQUESTED',
    jsonb_build_object('email', LOWER(p_email)),
    'Password reset requested'
  );
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anonymous (used before auth)
GRANT EXECUTE ON FUNCTION record_forgot_password_request(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_forgot_password_request(TEXT) TO anon;

-- =====================================================
-- PART 3: UPDATE SECURITY_LOGS RLS FOR NEW EVENT TYPE
-- =====================================================
-- The existing policies should already allow inserts for PASSWORD_RESET_REQUESTED
-- because we added "Anyone can insert login security logs" policy
-- Let's update it to include the new event type

DROP POLICY IF EXISTS "Anyone can insert login security logs" ON security_logs;

CREATE POLICY "Anyone can insert security event logs"
  ON security_logs FOR INSERT
  WITH CHECK (
    event_type IN (
      'FAILED_LOGIN', 
      'SUCCESSFUL_LOGIN', 
      'ACCOUNT_LOCKED', 
      'SESSION_TIMEOUT',
      'PASSWORD_RESET_REQUESTED'
    )
  );

-- =====================================================
-- PART 4: VERIFY RPC FUNCTION FOR ADMIN CHECK EXISTS
-- =====================================================
-- The is_admin() function should already exist from nuclear-reset.sql
-- Let's just verify it can be called as RPC

-- Test query (uncomment to run):
-- SELECT is_admin();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'check_forgot_password_rate_limit', 'record_forgot_password_request');

-- Check security_logs policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'security_logs';
