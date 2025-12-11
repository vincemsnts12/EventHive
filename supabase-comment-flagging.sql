-- ============================================================
-- PROFANITY CHECKING & COMMENT FLAGGING SYSTEM
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Add columns to comments table
-- ============================================================
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
-- Possible values: 'profanity', 'flagged', 'admin_hidden'

-- ============================================================
-- STEP 2: Create comment_flags table
-- Tracks who flagged which comment (one flag per user per comment)
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT, -- Optional reason from user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one flag per user per comment
  UNIQUE(comment_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comment_flags_comment_id ON comment_flags(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_flags_user_id ON comment_flags(user_id);

-- ============================================================
-- STEP 3: Create comment_flag_logs table
-- Audit trail for admin review
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_flag_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'flagged', 'auto_hidden', 'admin_hidden', 'restored', 'deleted'
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB, -- Additional info (flag count, reason, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_comment_flag_logs_comment_id ON comment_flag_logs(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_flag_logs_action ON comment_flag_logs(action);

-- ============================================================
-- STEP 4: RLS Policies for comment_flags
-- ============================================================

-- Enable RLS
ALTER TABLE comment_flags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (makes script idempotent)
DROP POLICY IF EXISTS "Anyone can view comment flags" ON comment_flags;
DROP POLICY IF EXISTS "Authenticated users can flag comments" ON comment_flags;
DROP POLICY IF EXISTS "Users can remove their own flags" ON comment_flags;

-- Anyone can view flag counts (for display purposes)
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
-- STEP 5: RLS Policies for comment_flag_logs
-- ============================================================

-- Enable RLS
ALTER TABLE comment_flag_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (makes script idempotent)
DROP POLICY IF EXISTS "Admins can view flag logs" ON comment_flag_logs;
DROP POLICY IF EXISTS "Authenticated users can insert flag logs" ON comment_flag_logs;

-- Only admins can view flag logs
CREATE POLICY "Admins can view flag logs"
ON comment_flag_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- System/authenticated users can insert logs
CREATE POLICY "Authenticated users can insert flag logs"
ON comment_flag_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 6: Function to check if user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = check_user_id AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 7: Function to auto-hide comment based on flags
-- Called after a new flag is inserted
-- ============================================================
CREATE OR REPLACE FUNCTION check_and_hide_flagged_comment()
RETURNS TRIGGER AS $$
DECLARE
  flag_count INTEGER;
  flagger_is_admin BOOLEAN;
BEGIN
  -- Check if the flagger is an admin
  SELECT is_admin(NEW.user_id) INTO flagger_is_admin;
  
  -- If admin flagged, hide immediately
  IF flagger_is_admin THEN
    UPDATE comments 
    SET is_hidden = TRUE, hidden_reason = 'admin_hidden'
    WHERE id = NEW.comment_id;
    
    -- Log the action
    INSERT INTO comment_flag_logs (comment_id, action, performed_by, details)
    VALUES (NEW.comment_id, 'admin_hidden', NEW.user_id, 
            jsonb_build_object('reason', NEW.reason));
    
    RETURN NEW;
  END IF;
  
  -- Count total flags for this comment
  SELECT COUNT(*) INTO flag_count
  FROM comment_flags
  WHERE comment_id = NEW.comment_id;
  
  -- If 3 or more flags, auto-hide
  IF flag_count >= 3 THEN
    UPDATE comments 
    SET is_hidden = TRUE, hidden_reason = 'flagged'
    WHERE id = NEW.comment_id AND is_hidden = FALSE;
    
    -- Log the action
    INSERT INTO comment_flag_logs (comment_id, action, performed_by, details)
    VALUES (NEW.comment_id, 'auto_hidden', NEW.user_id, 
            jsonb_build_object('flag_count', flag_count, 'reason', NEW.reason));
  ELSE
    -- Log the flag action
    INSERT INTO comment_flag_logs (comment_id, action, performed_by, details)
    VALUES (NEW.comment_id, 'flagged', NEW.user_id, 
            jsonb_build_object('flag_count', flag_count, 'reason', NEW.reason));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 8: Trigger to auto-hide after flag
-- ============================================================
DROP TRIGGER IF EXISTS trigger_check_flagged_comment ON comment_flags;

CREATE TRIGGER trigger_check_flagged_comment
AFTER INSERT ON comment_flags
FOR EACH ROW
EXECUTE FUNCTION check_and_hide_flagged_comment();

-- ============================================================
-- STEP 9: Function to get flag count for a comment
-- ============================================================
CREATE OR REPLACE FUNCTION get_comment_flag_count(p_comment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM comment_flags
  WHERE comment_id = p_comment_id;
  
  RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 10: Function to check if current user has flagged a comment
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
-- VERIFICATION: Check if tables were created
-- ============================================================
-- Run these queries to verify:
-- SELECT * FROM information_schema.columns WHERE table_name = 'comments' AND column_name IN ('is_hidden', 'hidden_reason');
-- SELECT * FROM information_schema.tables WHERE table_name IN ('comment_flags', 'comment_flag_logs');

-- ============================================================
-- STEP 11: DISABLE AUTO-HIDE TRIGGER
-- Flags are now metadata only - admin decides on deletion
-- ============================================================
DROP TRIGGER IF EXISTS trigger_check_flagged_comment ON comment_flags;

-- Keep the function in case we need to re-enable, but it won't be called
-- The trigger was: AFTER INSERT ON comment_flags EXECUTE FUNCTION check_and_hide_flagged_comment()

-- ============================================================
-- STEP 12: Daily Flag Rate Limiting (max 10 flags per user per day)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_daily_flag_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  flag_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO flag_count
  FROM comment_flags
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
  
  RETURN flag_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 13: Function to get flagged comments for admin (3+ flags)
-- Returns comments with their flag counts, ordered by count DESC
-- ============================================================
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
  IF NOT is_admin(auth.uid()) THEN
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
    COUNT(cf.id)::BIGINT AS flag_count,
    c.created_at AS created_at
  FROM comments c
  INNER JOIN comment_flags cf ON c.id = cf.comment_id
  LEFT JOIN profiles p ON c.user_id = p.id
  LEFT JOIN events e ON c.event_id = e.id
  GROUP BY c.id, c.content, c.user_id, p.username, c.event_id, e.title, c.created_at
  HAVING COUNT(cf.id) >= 3
  ORDER BY COUNT(cf.id) DESC, c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 14: Function for admin to delete a flagged comment
-- ============================================================
CREATE OR REPLACE FUNCTION admin_delete_flagged_comment(p_comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only admins can delete
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  -- Log the deletion
  INSERT INTO comment_flag_logs (comment_id, action, performed_by, details)
  VALUES (p_comment_id, 'admin_deleted', auth.uid(), 
          jsonb_build_object('deleted_at', NOW()));

  -- Delete the comment (cascades to flags)
  DELETE FROM comments WHERE id = p_comment_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
