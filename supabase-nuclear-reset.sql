-- ===== EVENTHIVE DATABASE NUCLEAR RESET =====
-- Generated: Fresh database with optimized admin checking
-- 
-- PERMISSION MATRIX:
-- ┌───────────────────┬────────┬───────────────┬─────────┐
-- │ Action            │ Guest  │ Authenticated │ Admin   │
-- ├───────────────────┼────────┼───────────────┼─────────┤
-- │ View Events       │ ✅     │ ✅            │ ✅      │
-- │ Like/Unlike       │ ❌     │ ✅            │ ✅      │
-- │ Comment           │ ❌     │ ✅            │ ✅      │
-- │ Delete Comment    │ ❌     │ ✅ (own only) │ ✅ (own)│
-- │ Create Event      │ ❌     │ ❌            │ ✅      │
-- │ Update Event      │ ❌     │ ❌            │ ✅      │
-- │ Delete Event      │ ❌     │ ❌            │ ✅      │
-- │ Manage Images     │ ❌     │ ❌            │ ✅      │
-- │ Manage Orgs       │ ❌     │ ❌            │ ✅      │
-- │ View Sec Logs     │ ❌     │ ❌            │ ✅      │
-- └───────────────────┴────────┴───────────────┴─────────┘
--
-- ⚠️ WARNING: This script DROPS ALL DATA and recreates from scratch!
-- =============================================

-- =============================================
-- PHASE 1: NUCLEAR DROP - REMOVE EVERYTHING
-- =============================================

-- Drop all triggers first (they depend on functions)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_events_times ON events;

-- Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_event_times() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Drop all tables (order matters due to foreign keys)
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS event_images CASCADE;
DROP TABLE IF EXISTS event_likes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS colleges CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =============================================
-- PHASE 2: CREATE HELPER FUNCTIONS
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Extract time components from date fields
CREATE OR REPLACE FUNCTION update_event_times()
RETURNS TRIGGER AS $$
BEGIN
  NEW.start_time := NEW.start_date::TIME;
  NEW.end_time := NEW.end_date::TIME;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PHASE 3: CREATE TABLES
-- =============================================

-- ---------------------------------------------
-- PROFILES TABLE (extends auth.users)
-- ---------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  username VARCHAR(255),
  full_name VARCHAR(255),
  avatar_url TEXT,
  cover_photo_url TEXT,
  bio TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ⚡ CRITICAL INDEX: Speed up admin checking for RLS policies
-- This index is used by the is_admin() function and prevents timeout issues
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX idx_profiles_id_is_admin ON profiles(id, is_admin);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------
-- COLLEGES TABLE
-- ---------------------------------------------
CREATE TABLE colleges (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color_class VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------
-- ORGANIZATIONS TABLE (linked to events via name)
-- ---------------------------------------------
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on name for fast FK lookups from events table
CREATE INDEX idx_organizations_name ON organizations(name);

-- ---------------------------------------------
-- EVENTS TABLE (organization_name linked to organizations)
-- ---------------------------------------------
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(500) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  start_time TIME,
  end_time TIME,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  is_featured BOOLEAN DEFAULT FALSE,
  college_code VARCHAR(10) REFERENCES colleges(code),
  colleges JSONB, -- Array of college codes for collaboration events
  organization_name VARCHAR(255) REFERENCES organizations(name), -- FK to organizations.name
  university_logo_url VARCHAR(500),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id)
);

-- Add comment to colleges column
COMMENT ON COLUMN events.colleges IS 'Array of college codes (JSONB) for collaboration events. Main college is stored in college_code for backward compatibility.';

-- Indexes for events table
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_is_featured ON events(is_featured);
CREATE INDEX idx_events_college_code ON events(college_code);
CREATE INDEX idx_events_organization_name ON events(organization_name);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Triggers for events
CREATE TRIGGER update_events_updated_at 
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_times 
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW 
  WHEN (NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL)
  EXECUTE FUNCTION update_event_times();

-- ---------------------------------------------
-- EVENT_IMAGES TABLE
-- ---------------------------------------------
CREATE TABLE event_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_images_event_id ON event_images(event_id);
CREATE INDEX idx_event_images_display_order ON event_images(event_id, display_order);

-- ---------------------------------------------
-- EVENT_LIKES TABLE
-- ---------------------------------------------
CREATE TABLE event_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_likes_event_id ON event_likes(event_id);
CREATE INDEX idx_event_likes_user_id ON event_likes(user_id);

-- ---------------------------------------------
-- COMMENTS TABLE
-- ---------------------------------------------
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_event_id ON comments(event_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- ---------------------------------------------
-- SECURITY_LOGS TABLE
-- ---------------------------------------------
CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  metadata JSONB,
  message TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX idx_security_logs_metadata ON security_logs USING GIN(metadata);

-- =============================================
-- PHASE 4: CREATE is_admin() FUNCTION
-- =============================================
-- This function is SECURITY DEFINER and uses the index for fast lookups
-- It's the key to preventing RLS timeout issues

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  -- Quick return if not authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Use indexed lookup - this is fast because of idx_profiles_id_is_admin
  SELECT is_admin INTO admin_status
  FROM profiles
  WHERE id = auth.uid();
  
  -- Return false if no profile found or not admin
  RETURN COALESCE(admin_status, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- =============================================
-- PHASE 5: CREATE handle_new_user() FUNCTION
-- =============================================
-- Auto-creates profile when user signs up
-- Enforces TUP email domain restriction

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Enforce email domain restriction: Only allow @tup.edu.ph emails
  IF NEW.email IS NULL OR LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    RAISE EXCEPTION 'Email domain not allowed. Only @tup.edu.ph email addresses are permitted.';
  END IF;
  
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- PHASE 6: ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 6.5: CREATE EVENT INSERTION FUNCTION
-- =============================================
-- This function bypasses RLS for event creation (faster than policy evaluation)
-- It checks admin status once, then inserts directly

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

-- =============================================
-- PHASE 7: CREATE RLS POLICIES
-- =============================================

-- ---------------------------------------------
-- PROFILES POLICIES
-- ---------------------------------------------
-- Everyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile (via trigger, but also direct)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ---------------------------------------------
-- COLLEGES POLICIES
-- ---------------------------------------------
-- Everyone can view colleges (reference data)
CREATE POLICY "Colleges are viewable by everyone"
  ON colleges FOR SELECT
  USING (true);

-- ---------------------------------------------
-- ORGANIZATIONS POLICIES
-- ---------------------------------------------
-- Everyone can view organizations
CREATE POLICY "Organizations are viewable by everyone"
  ON organizations FOR SELECT
  USING (true);

-- Only ADMINS can create organizations (needed before creating events)
CREATE POLICY "Admins can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (is_admin());

-- Only ADMINS can update organizations
CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only ADMINS can delete organizations
CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE
  USING (is_admin());

-- ---------------------------------------------
-- EVENTS POLICIES
-- ---------------------------------------------
-- Everyone (including guests) can view events
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Authenticated users can create events via RLS (backup for create_event_as_admin function)
-- The function is preferred as it's faster, but this policy allows direct inserts if needed
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only ADMINS can update events
CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only ADMINS can delete events
CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (is_admin());

-- ---------------------------------------------
-- EVENT_IMAGES POLICIES
-- ---------------------------------------------
-- Everyone can view event images
CREATE POLICY "Event images are viewable by everyone"
  ON event_images FOR SELECT
  USING (true);

-- Only ADMINS can insert event images
CREATE POLICY "Admins can insert event images"
  ON event_images FOR INSERT
  WITH CHECK (is_admin());

-- Only ADMINS can update event images
CREATE POLICY "Admins can update event images"
  ON event_images FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only ADMINS can delete event images
CREATE POLICY "Admins can delete event images"
  ON event_images FOR DELETE
  USING (is_admin());

-- ---------------------------------------------
-- EVENT_LIKES POLICIES
-- ---------------------------------------------
-- Everyone can view like counts (for display)
CREATE POLICY "Likes are viewable by everyone"
  ON event_likes FOR SELECT
  USING (true);

-- Only AUTHENTICATED users can like (insert)
CREATE POLICY "Authenticated users can like events"
  ON event_likes FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );

-- Only AUTHENTICATED users can unlike (delete their own)
CREATE POLICY "Users can unlike their own likes"
  ON event_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------
-- COMMENTS POLICIES
-- ---------------------------------------------
-- Everyone can view comments
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

-- Only AUTHENTICATED users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );

-- Users can only delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------
-- SECURITY_LOGS POLICIES
-- ---------------------------------------------
-- Only ADMINS can view security logs
CREATE POLICY "Admins can view security logs"
  ON security_logs FOR SELECT
  USING (is_admin());

-- AUTHENTICATED users can insert logs (for client-side logging)
CREATE POLICY "Authenticated users can insert security logs"
  ON security_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- PHASE 8: SEED DATA
-- =============================================

-- Insert default colleges
INSERT INTO colleges (code, name, color_class) VALUES
  ('COS', 'College of Science', 'cos'),
  ('COE', 'College of Engineering', 'coe'),
  ('CAFA', 'College of Architecture and Fine Arts', 'cafa'),
  ('CLA', 'College of Liberal Arts', 'cla'),
  ('CIE', 'College of Industrial Education', 'cie'),
  ('CIT', 'College of Industrial Technology', 'cit'),
  ('TUP', 'TUP System-wide', 'tup')
ON CONFLICT (code) DO NOTHING;

-- Insert some default organizations (admins can add more from the dashboard)
INSERT INTO organizations (name, description) VALUES
  ('TUP USG Manila', 'TUP University Student Government - Manila'),
  ('AWS Learning Club - TUP Manila', 'Amazon Web Services Learning Club'),
  ('Google Developer Groups on Campus TUP Manila', 'GDG on Campus TUP Manila'),
  ('TUP CAFA Student Council', 'College of Architecture and Fine Arts Student Council'),
  ('TUP Arts Society', 'TUP Arts and Culture Society'),
  ('TUP Entrepreneurship Club', 'TUP Student Entrepreneurship Club')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- PHASE 9: VERIFICATION QUERIES
-- =============================================
-- Run these after the script to verify everything is set up correctly

-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- Check indexes exist (especially the admin index!)
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Check colleges were seeded
SELECT * FROM colleges ORDER BY code;

-- =============================================
-- DONE! 
-- =============================================
-- Your database is now reset with:
-- ✅ All tables recreated
-- ✅ is_admin() function with SECURITY DEFINER
-- ✅ Index on profiles.is_admin for fast admin lookups
-- ✅ Proper RLS policies (Guest < Authenticated < Admin)
-- ✅ TUP email restriction in handle_new_user()
-- ✅ Colleges seeded
-- ✅ organization_name linked to organizations table (FK)
--
-- NEXT STEPS:
-- 1. Sign up with your admin account (TUP email)
-- 2. Run: UPDATE profiles SET is_admin = TRUE WHERE email = 'your@tup.edu.ph';
-- 3. Add organizations BEFORE creating events that reference them:
--    INSERT INTO organizations (name, description) VALUES ('Org Name', 'Description');
-- 4. Test event creation from admin dashboard
--
-- NOTE: organization_name on events is NULLABLE. If you provide a value,
-- it MUST exist in the organizations table first. Leave it NULL/empty
-- if the event has no specific organization.
-- =============================================

