-- ===== SECURITY FIX: Function Search Path =====
-- This migration fixes the security warnings about mutable search_path
-- Run this in Supabase SQL Editor after running supabase-schema.sql
-- 
-- This adds SET search_path to all functions to prevent search path injection attacks

-- ===== FIX 1: update_updated_at_column =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ===== FIX 2: handle_new_user (SECURITY DEFINER) =====
-- For SECURITY DEFINER functions, we use SET search_path = public, pg_catalog
-- This locks the function to only use objects in public schema and PostgreSQL built-ins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, avatar_url, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE -- Default to non-admin on signup
  );
  RETURN NEW;
END;
$$;

-- ===== FIX 3: update_event_times =====
CREATE OR REPLACE FUNCTION update_event_times()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Extract time from start_date and end_date
  NEW.start_time := NEW.start_date::TIME;
  NEW.end_time := NEW.end_date::TIME;
  RETURN NEW;
END;
$$;

-- ===== VERIFICATION =====
-- After running this, check Supabase Database Linter again
-- All three warnings should be resolved

