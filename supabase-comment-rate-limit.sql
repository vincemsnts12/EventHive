-- ============================================================
-- COMMENT RATE LIMITING
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- Rate Limit Function
-- Returns: { can_comment: boolean, wait_seconds: int, message: string, next_allowed_at: timestamptz }
-- Rules:
--   1. Max 50 comments per day (resets at midnight)
--   2. Every 10 comments = 5 minute wait before next comment
-- ============================================================

CREATE OR REPLACE FUNCTION check_comment_rate_limit()
RETURNS JSON AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today_start TIMESTAMPTZ;
  v_today_count INT;
  v_last_comment_time TIMESTAMPTZ;
  v_wait_seconds INT;
  v_midnight TIMESTAMPTZ;
  v_next_allowed_at TIMESTAMPTZ;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'can_comment', false,
      'wait_seconds', 0,
      'message', 'Authentication required',
      'next_allowed_at', NULL
    );
  END IF;

  -- Get today's start (midnight in UTC - frontend will handle timezone)
  v_today_start := date_trunc('day', NOW());
  v_midnight := v_today_start + INTERVAL '1 day';

  -- Count today's comments
  SELECT COUNT(*), MAX(created_at)
  INTO v_today_count, v_last_comment_time
  FROM comments
  WHERE user_id = v_user_id
    AND created_at >= v_today_start;

  -- Rule 1: Max 50 comments per day
  IF v_today_count >= 50 THEN
    RETURN json_build_object(
      'can_comment', false,
      'wait_seconds', EXTRACT(EPOCH FROM (v_midnight - NOW()))::INT,
      'message', 'Daily comment limit reached (50 comments). Try again after midnight.',
      'next_allowed_at', v_midnight,
      'limit_type', 'daily'
    );
  END IF;

  -- Rule 2: Every 10 comments = 5 minute wait
  -- Check if current count is a multiple of 10 (10, 20, 30, 40)
  IF v_today_count > 0 AND v_today_count % 10 = 0 THEN
    -- Must wait 5 minutes from last comment
    v_next_allowed_at := v_last_comment_time + INTERVAL '5 minutes';
    v_wait_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_next_allowed_at - NOW()))::INT);
    
    IF v_wait_seconds > 0 THEN
      RETURN json_build_object(
        'can_comment', false,
        'wait_seconds', v_wait_seconds,
        'message', 'Please wait before posting another comment.',
        'next_allowed_at', v_next_allowed_at,
        'limit_type', 'interval',
        'comments_today', v_today_count
      );
    END IF;
  END IF;

  -- Can comment
  RETURN json_build_object(
    'can_comment', true,
    'wait_seconds', 0,
    'message', NULL,
    'next_allowed_at', NULL,
    'comments_today', v_today_count,
    'comments_until_wait', 10 - (v_today_count % 10)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Grant execute permission to authenticated users
-- ============================================================
GRANT EXECUTE ON FUNCTION check_comment_rate_limit() TO authenticated;

-- ============================================================
-- Optional: RLS Policy to enforce rate limit on INSERT
-- This provides server-side enforcement
-- ============================================================

-- First, create a helper function for RLS that returns boolean
CREATE OR REPLACE FUNCTION can_user_comment()
RETURNS BOOLEAN AS $$
DECLARE
  v_result JSON;
BEGIN
  v_result := check_comment_rate_limit();
  RETURN (v_result->>'can_comment')::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for comment inserts (uncomment if you want strict server-side enforcement)
-- Note: This will block inserts at DB level, frontend should still check first for better UX

-- DROP POLICY IF EXISTS "Rate limit comment inserts" ON comments;
-- CREATE POLICY "Rate limit comment inserts"
-- ON comments FOR INSERT
-- WITH CHECK (can_user_comment());

-- ============================================================
-- Test the function (run after creating)
-- ============================================================
-- SELECT check_comment_rate_limit();
