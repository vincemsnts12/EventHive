-- ===== EVENTHIVE SUPABASE DATABASE SCHEMA =====
-- Run this SQL in your Supabase SQL Editor to create all necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== PROFILES TABLE =====
-- Stores user profile information (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(255),
  full_name VARCHAR(255),
  avatar_url TEXT,
  cover_photo_url TEXT,
  bio TEXT,
  is_admin BOOLEAN DEFAULT FALSE, -- Admin/checker role for dashboard access
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ===== EVENT LIKES TABLE =====
-- Junction table for tracking which users liked which events
CREATE TABLE event_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL, -- Will reference events table when created
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- Prevent duplicate likes
);

-- Enable RLS
ALTER TABLE event_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read likes
CREATE POLICY "Likes are viewable by everyone"
  ON event_likes FOR SELECT
  USING (true);

-- Policy: Authenticated users can like/unlike
CREATE POLICY "Users can like/unlike events"
  ON event_likes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX idx_event_likes_event_id ON event_likes(event_id);
CREATE INDEX idx_event_likes_user_id ON event_likes(user_id);
CREATE INDEX idx_event_likes_created_at ON event_likes(created_at);

-- ===== COMMENTS TABLE =====
-- Stores comments on events
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL, -- Will reference events table when created
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read comments
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

-- Policy: Authenticated users can create comments
CREATE POLICY "Users can create comments"
  ON comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_comments_event_id ON comments(event_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- ===== FUNCTION: Update updated_at timestamp =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for profiles
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for comments
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== FUNCTION: Create profile on user signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE -- Default to non-admin on signup
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== COLLEGES TABLE =====
-- Stores college information
CREATE TABLE colleges (
  code VARCHAR(10) PRIMARY KEY, -- 'COS', 'COE', 'CAFA', 'CLA', 'CIE', 'CIT', 'TUP'
  name VARCHAR(255) NOT NULL,
  color_class VARCHAR(50) NOT NULL, -- 'cos', 'coe', 'cafa', 'cla', 'cie', 'cit', 'tup'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read colleges
CREATE POLICY "Colleges are viewable by everyone"
  ON colleges FOR SELECT
  USING (true);

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

-- ===== ORGANIZATIONS TABLE =====
-- Stores organization information
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read organizations
CREATE POLICY "Organizations are viewable by everyone"
  ON organizations FOR SELECT
  USING (true);

-- Policy: Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ===== EVENTS TABLE =====
-- Stores event information
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(500) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  start_time TIME, -- Time component (HH:MM:SS) - extracted from start_date for convenience
  end_time TIME, -- Time component (HH:MM:SS) - extracted from end_date for convenience
  status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Upcoming', 'Ongoing', 'Concluded'
  is_featured BOOLEAN DEFAULT FALSE,
  college_code VARCHAR(10) REFERENCES colleges(code),
  organization_id UUID REFERENCES organizations(id),
  organization_name VARCHAR(255), -- Fallback if organization doesn't exist in table
  university_logo_url VARCHAR(500),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE, -- When admin approved (for pending events)
  approved_by UUID REFERENCES auth.users(id) -- Admin who approved
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read events
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Policy: Authenticated users can create events (pending by default)
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

-- Policy: Only admins can update events
CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Policy: Only admins can delete events
CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Indexes for performance
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_is_featured ON events(is_featured);
CREATE INDEX idx_events_college_code ON events(college_code);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_approved_at ON events(approved_at);

-- Trigger for updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically extract and store time components from timestamps
CREATE OR REPLACE FUNCTION update_event_times()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract time from start_date and end_date
  NEW.start_time := NEW.start_date::TIME;
  NEW.end_time := NEW.end_date::TIME;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update time fields when dates change
CREATE TRIGGER update_events_times BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW 
  WHEN (NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL)
  EXECUTE FUNCTION update_event_times();

-- ===== EVENT IMAGES TABLE =====
-- Stores images for events
CREATE TABLE event_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  display_order INTEGER DEFAULT 0, -- Order of images (0 = first/thumbnail)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read event images
CREATE POLICY "Event images are viewable by everyone"
  ON event_images FOR SELECT
  USING (true);

-- Policy: Only admins can manage event images
CREATE POLICY "Admins can manage event images"
  ON event_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
    )
  );

-- Index for performance
CREATE INDEX idx_event_images_event_id ON event_images(event_id);
CREATE INDEX idx_event_images_display_order ON event_images(event_id, display_order);

-- ===== UPDATE FOREIGN KEY REFERENCES =====
-- Now that events table exists, update event_likes and comments to reference it
ALTER TABLE event_likes
  DROP CONSTRAINT IF EXISTS event_likes_event_id_fkey,
  ADD CONSTRAINT event_likes_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_event_id_fkey,
  ADD CONSTRAINT comments_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

