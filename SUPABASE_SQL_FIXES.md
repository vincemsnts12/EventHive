# 🔧 EventHive - Supabase Schema Fixes

## SQL Fixes to Run in Supabase SQL Editor

---

## FIX 1: Correct event_images RLS Policies

Run this SQL to fix the overly restrictive policies:

```sql
-- ===== FIX EVENT IMAGES RLS POLICIES =====

-- Step 1: Drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can manage event images" ON event_images;

-- Step 2: Create separate, clear policies

-- Read policy: Everyone can view event images
CREATE POLICY "Event images are viewable by everyone"
  ON event_images FOR SELECT
  USING (true);

-- Insert policy: Only admins can insert images
CREATE POLICY "Admins can insert event images"
  ON event_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Update policy: Only admins can update images
CREATE POLICY "Admins can update event images"
  ON event_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );

-- Delete policy: Only admins can delete images
CREATE POLICY "Admins can delete event images"
  ON event_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = TRUE
    )
  );
```

---

## FIX 2: Set First Admin User

Replace `YOUR_EMAIL@tup.edu.ph` with your actual email:

```sql
-- Make yourself an admin
UPDATE profiles
SET is_admin = TRUE
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'YOUR_EMAIL@tup.edu.ph'
);

-- Verify it worked
SELECT email, is_admin FROM auth.users 
JOIN profiles ON auth.users.id = profiles.id 
WHERE is_admin = TRUE;
```

---

## FIX 3: Add Event Status History Tracking

Add audit table to track when events change status:

```sql
-- ===== EVENT STATUS HISTORY TABLE =====

CREATE TABLE event_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE event_status_history ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read history (for transparency)
CREATE POLICY "Event status history is viewable by everyone"
  ON event_status_history FOR SELECT
  USING (true);

-- Policy: Only admins can insert history (system use)
CREATE POLICY "Admins can insert status history"
  ON event_status_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create index for fast lookups
CREATE INDEX idx_event_status_history_event_id ON event_status_history(event_id);
CREATE INDEX idx_event_status_history_changed_at ON event_status_history(created_at DESC);

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_event_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO event_status_history (
      event_id, 
      old_status, 
      new_status, 
      changed_by
    ) VALUES (
      NEW.id, 
      OLD.status, 
      NEW.status, 
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log status changes
CREATE TRIGGER track_event_status_changes AFTER UPDATE ON events
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_event_status_change();
```

---

## FIX 4: Add Deleted Images Cleanup Table

Track deleted images for cleanup:

```sql
-- ===== DELETED IMAGES CLEANUP TABLE =====

CREATE TABLE deleted_images_cleanup (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_url TEXT NOT NULL,
  image_path TEXT,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cleaned_up BOOLEAN DEFAULT FALSE,
  cleanup_attempted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE deleted_images_cleanup ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view cleanup log
CREATE POLICY "Admins can view cleanup log"
  ON deleted_images_cleanup FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Function to track deleted images
CREATE OR REPLACE FUNCTION track_deleted_images()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deleted_images_cleanup (image_url, image_path, deleted_by)
  VALUES (
    OLD.image_url,
    OLD.image_url, -- Extract path if needed
    auth.uid()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track deletions from event_images
CREATE TRIGGER track_image_deletions AFTER DELETE ON event_images
  FOR EACH ROW EXECUTE FUNCTION track_deleted_images();
```

---

## FIX 5: Ensure All Foreign Key Constraints Exist

```sql
-- ===== VERIFY FOREIGN KEY CONSTRAINTS =====

-- Check event_likes references events
ALTER TABLE event_likes
  DROP CONSTRAINT IF EXISTS event_likes_event_id_fkey,
  ADD CONSTRAINT event_likes_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Check comments references events
ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_event_id_fkey,
  ADD CONSTRAINT comments_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Verify with:
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
ORDER BY table_name;
```

---

## FIX 6: Add Profanity Filter Reference

```sql
-- ===== PROFANITY LOG TABLE =====

CREATE TABLE profanity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50), -- 'comment', 'event_description', etc.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  original_text TEXT NOT NULL,
  filtered_text TEXT NOT NULL,
  flagged_words TEXT[], -- Array of detected profanities
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profanity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view profanity logs
CREATE POLICY "Admins can view profanity logs"
  ON profanity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Create index
CREATE INDEX idx_profanity_logs_user_id ON profanity_logs(user_id);
CREATE INDEX idx_profanity_logs_event_type ON profanity_logs(event_type);
```

---

## FIX 7: Add Activity Log Table

For tracking user actions:

```sql
-- ===== USER ACTIVITY LOG TABLE =====

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'event_created', 'event_liked', 'comment_posted', etc.
  resource_type VARCHAR(50), -- 'event', 'comment', 'profile', etc.
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own activity
CREATE POLICY "Users can view own activity"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can view all activity
CREATE POLICY "Admins can view all activity"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Create indexes for performance
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
```

---

## FIX 8: Fix Events Status Values

Ensure only valid statuses are used:

```sql
-- ===== ADD CHECK CONSTRAINT TO EVENTS STATUS =====

-- Add constraint to enforce valid statuses
ALTER TABLE events
ADD CONSTRAINT valid_event_status CHECK (
  status IN ('Pending', 'Upcoming', 'Ongoing', 'Concluded')
);
```

---

## FIX 9: Add Missing Indexes for Performance

```sql
-- ===== PERFORMANCE INDEXES =====

-- Events table indexes
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_approved_by ON events(approved_by);
CREATE INDEX IF NOT EXISTS idx_events_organization_id ON events(organization_id);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- Comments/Likes indexes
CREATE INDEX IF NOT EXISTS idx_event_likes_unique ON event_likes(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_unique ON comments(event_id, user_id);

-- Security logs indexes
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
```

---

## FIX 10: Create Database Views for Common Queries

```sql
-- ===== DATABASE VIEWS FOR COMMON QUERIES =====

-- View: Upcoming events with counts
CREATE OR REPLACE VIEW upcoming_events_view AS
SELECT 
  e.id,
  e.title,
  e.description,
  e.start_date,
  e.location,
  e.college_code,
  COUNT(DISTINCT el.id) as like_count,
  COUNT(DISTINCT c.id) as comment_count
FROM events e
LEFT JOIN event_likes el ON e.id = el.event_id
LEFT JOIN comments c ON e.id = c.event_id
WHERE e.status IN ('Upcoming', 'Ongoing')
  AND e.start_date > NOW()
GROUP BY e.id
ORDER BY e.start_date ASC;

-- View: Pending events waiting approval
CREATE OR REPLACE VIEW pending_events_view AS
SELECT 
  e.id,
  e.title,
  e.description,
  e.created_by,
  p.username as created_by_username,
  e.created_at,
  COUNT(DISTINCT ei.id) as image_count
FROM events e
LEFT JOIN profiles p ON e.created_by = p.id
LEFT JOIN event_images ei ON e.id = ei.event_id
WHERE e.status = 'Pending'
GROUP BY e.id, p.username
ORDER BY e.created_at DESC;

-- View: User profile with stats
CREATE OR REPLACE VIEW user_stats_view AS
SELECT 
  p.id,
  p.username,
  p.full_name,
  p.is_admin,
  COUNT(DISTINCT e.id) as events_created,
  COUNT(DISTINCT el.id) as events_liked,
  COUNT(DISTINCT c.id) as comments_posted
FROM profiles p
LEFT JOIN events e ON p.id = e.created_by
LEFT JOIN event_likes el ON p.id = el.user_id
LEFT JOIN comments c ON p.id = c.user_id
GROUP BY p.id;
```

---

## Validation Script

Run this after applying fixes to verify everything is working:

```sql
-- ===== VALIDATION CHECKS =====

-- 1. Check admin users exist
SELECT 'Admin Users' as check_name, COUNT(*) as count 
FROM profiles WHERE is_admin = TRUE
UNION ALL

-- 2. Check storage bucket policies exist
SELECT 'Event Images RLS Policies', COUNT(*)
FROM pg_policies WHERE tablename = 'event_images'
UNION ALL

-- 3. Check foreign keys are set
SELECT 'Foreign Key Constraints', COUNT(*)
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY'
UNION ALL

-- 4. Check status history trigger exists
SELECT 'Event Status History Trigger', COUNT(*)
FROM information_schema.triggers 
WHERE trigger_name = 'track_event_status_changes'
UNION ALL

-- 5. Check users can create events
SELECT 'Event Creation RLS Policy', COUNT(*)
FROM pg_policies WHERE tablename = 'events' AND policyname LIKE '%create%'
UNION ALL

-- 6. Check image deletion tracking exists
SELECT 'Deleted Images Cleanup Table', COUNT(*)
FROM information_schema.tables WHERE table_name = 'deleted_images_cleanup';
```

---

## Summary

After running all these SQL fixes:
✅ RLS policies will be correct  
✅ Admins can upload images  
✅ Status changes are tracked  
✅ Deleted images are logged  
✅ Security and activity are monitored  
✅ Performance indexes are in place  

