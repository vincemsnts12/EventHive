-- ============================================================
-- SIMPLIFIED COMMENT FLAGGING SYSTEM
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 0: CLEANUP - Remove unused objects from old system
-- ============================================================

-- Drop old triggers that are no longer needed
DROP TRIGGER IF EXISTS trigger_check_and_hide_flagged ON comment_flags;
DROP TRIGGER IF EXISTS check_and_hide_flagged_comment ON comment_flags;
DROP TRIGGER IF EXISTS update_flag_count_trigger ON comment_flags;

-- Drop old functions that are no longer used
-- (We're keeping is_admin, update_comment_flag_count, and a few helpers)
DROP FUNCTION IF EXISTS check_and_hide_flagged_comment() CASCADE;
DROP FUNCTION IF EXISTS auto_hide_flagged_comment() CASCADE;
DROP FUNCTION IF EXISTS hide_flagged_comment(UUID) CASCADE;
DROP FUNCTION IF EXISTS restore_hidden_comment(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_hidden_comments() CASCADE;
DROP FUNCTION IF EXISTS is_admin(UUID) CASCADE; -- Drop parameterized version, keep parameterless

-- Drop old policies on comments table that may conflict
DROP POLICY IF EXISTS "Users can view non-hidden comments" ON comments;
DROP POLICY IF EXISTS "Admins can view all comments" ON comments;
DROP POLICY IF EXISTS "Admins can update comments" ON comments;

-- Drop comment_flag_logs table (audit log - not essential)
DROP TABLE IF EXISTS comment_flag_logs CASCADE;

-- ============================================================
-- STEP 1: Add flag_count column to comments table
-- ============================================================
ALTER TABLE comments ADD COLUMN IF NOT EXISTS flag_count INT DEFAULT 0;

-- Create index for faster queries on flagged comments
CREATE INDEX IF NOT EXISTS idx_comments_flag_count ON comments(flag_count) WHERE flag_count > 0;


-- ============================================================
-- STEP 1.5: Add admin delete policy on comments table
-- Allows admins to delete any comment directly
-- ============================================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete any comment" ON comments;
CREATE POLICY "Admins can delete any comment"
ON comments FOR DELETE
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
);


-- ============================================================
-- STEP 2: Drop unused columns from comments table
-- ============================================================
ALTER TABLE comments DROP COLUMN IF EXISTS is_hidden;
ALTER TABLE comments DROP COLUMN IF EXISTS hidden_reason;

-- ============================================================
-- STEP 3: Drop unnecessary audit log table
-- ============================================================
DROP TABLE IF EXISTS comment_flag_logs;

-- ============================================================
-- STEP 4: Ensure comment_flags table exists (for tracking who flagged)
-- This is ESSENTIAL for duplicate prevention and rate limiting
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one flag per user per comment
  UNIQUE(comment_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comment_flags_comment_id ON comment_flags(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_flags_user_id ON comment_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_flags_created_at ON comment_flags(created_at);

-- ============================================================
-- STEP 5: RLS Policies for comment_flags
-- ============================================================
ALTER TABLE comment_flags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (makes script idempotent)
DROP POLICY IF EXISTS "Anyone can view comment flags" ON comment_flags;
DROP POLICY IF EXISTS "Authenticated users can flag comments" ON comment_flags;
DROP POLICY IF EXISTS "Users can remove their own flags" ON comment_flags;

-- Anyone can view flag counts
CREATE POLICY "Anyone can view comment flags"
ON comment_flags FOR SELECT
USING (true);

-- Authenticated users can flag comments
CREATE POLICY "Authenticated users can flag comments"
ON comment_flags FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own flags (unflag)
CREATE POLICY "Users can remove their own flags"
ON comment_flags FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================
-- STEP 6: Sync flag_count from existing comment_flags data
-- ============================================================
UPDATE comments c
SET flag_count = COALESCE((
  SELECT COUNT(*) FROM comment_flags cf WHERE cf.comment_id = c.id
), 0);

-- ============================================================
-- STEP 7: Trigger to auto-update flag_count when flags change
-- ============================================================
CREATE OR REPLACE FUNCTION update_comment_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET flag_count = flag_count + 1 WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET flag_count = GREATEST(flag_count - 1, 0) WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_flag_count ON comment_flags;
CREATE TRIGGER trigger_update_flag_count
AFTER INSERT OR DELETE ON comment_flags
FOR EACH ROW EXECUTE FUNCTION update_comment_flag_count();

-- ============================================================
-- STEP 8: is_admin() helper function (parameterless version)
-- REQUIRED: Used by RLS policies for admin checks
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- OPTIONAL: Legacy RPC functions (kept for backward compatibility)
-- The frontend now uses direct fetch, so these are not required
-- You can DROP these if you want to clean up
-- ============================================================

-- OPTIONAL: get_flagged_comments_for_admin (legacy - frontend uses direct fetch now)

CREATE OR REPLACE FUNCTION get_flagged_comments_for_admin()
RETURNS TABLE (
  comment_id UUID,
  comment_content TEXT,
  comment_author_id UUID,
  comment_author_username TEXT,
  event_id UUID,
  event_title TEXT,
  flag_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only admins can call this
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  RETURN QUERY
  SELECT 
    c.id AS comment_id,
    c.content AS comment_content,
    c.user_id AS comment_author_id,
    p.username AS comment_author_username,
    c.event_id AS event_id,
    e.title AS event_title,
    c.flag_count::BIGINT AS flag_count,
    c.created_at AS created_at
  FROM comments c
  LEFT JOIN profiles p ON c.user_id = p.id
  LEFT JOIN events e ON c.event_id = e.id
  WHERE c.flag_count >= 3
  ORDER BY c.flag_count DESC, c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 10: Admin delete flagged comment function
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_flagged_comment(p_comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only admins can delete
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  -- Delete the comment (cascades to flags due to ON DELETE CASCADE)
  DELETE FROM comments WHERE id = p_comment_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 11: Helper function for rate limiting (10 flags per day per user)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_daily_flag_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM comment_flags
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
  
  RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 12: Helper function to check if user has flagged a comment
-- ============================================================
CREATE OR REPLACE FUNCTION has_user_flagged_comment(p_comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM comment_flags
    WHERE comment_id = p_comment_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICATION QUERIES (run these to test)
-- ============================================================

-- Check comments table structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'comments';

-- Check for flagged comments:
-- SELECT id, content, flag_count FROM comments WHERE flag_count > 0;

-- Test the simplified query (same as what frontend does):
-- SELECT c.id, c.content, c.flag_count, c.user_id, p.username, c.event_id, e.title
-- FROM comments c
-- LEFT JOIN profiles p ON c.user_id = p.id
-- LEFT JOIN events e ON c.event_id = e.id
-- WHERE c.flag_count >= 3
-- ORDER BY c.flag_count DESC;

-- ============================================================
-- OPTIONAL CLEANUP: Drop legacy RPC functions if not needed
-- Uncomment these lines if you want to fully clean up
-- ============================================================
DROP FUNCTION IF EXISTS get_flagged_comments_for_admin() CASCADE;
DROP FUNCTION IF EXISTS admin_delete_flagged_comment(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_daily_flag_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS has_user_flagged_comment(UUID) CASCADE;
