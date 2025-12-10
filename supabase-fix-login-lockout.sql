-- ===== FIX SECURITY_LOGS FOR LOGIN LOCKOUT SYSTEM =====
-- This script adds necessary policies for the server-side login lockout system
-- to work properly. The issue is that failed login attempts happen BEFORE
-- authentication, so anonymous users need to be able to:
-- 1. INSERT security logs (for FAILED_LOGIN events)
-- 2. SELECT security logs (to check lockout status)
--
-- Run this in Supabase SQL Editor
-- =====================================================

-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Authenticated users can insert security logs" ON security_logs;
DROP POLICY IF EXISTS "Admins can view security logs" ON security_logs;
DROP POLICY IF EXISTS "Anyone can insert login security logs" ON security_logs;
DROP POLICY IF EXISTS "Anyone can check lockout status" ON security_logs;

-- Allow ANYONE (including anonymous) to INSERT security logs
-- This is needed because failed login attempts happen before authentication
-- We should still validate event_type to only allow safe log types
CREATE POLICY "Anyone can insert login security logs"
  ON security_logs FOR INSERT
  WITH CHECK (
    event_type IN ('FAILED_LOGIN', 'SUCCESSFUL_LOGIN', 'ACCOUNT_LOCKED', 'SESSION_TIMEOUT')
  );

-- Allow ANYONE to SELECT security logs for lockout checking
-- This is limited to only read FAILED_LOGIN and ACCOUNT_LOCKED events
-- to prevent information disclosure of other security events
CREATE POLICY "Anyone can check lockout status"
  ON security_logs FOR SELECT
  USING (
    event_type IN ('FAILED_LOGIN', 'ACCOUNT_LOCKED')
  );

-- Admins can view ALL security logs (broader access)
CREATE POLICY "Admins can view all security logs"
  ON security_logs FOR SELECT
  USING (is_admin());

-- =====================================================
-- Add index for faster lockout queries on metadata->>'email'
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_security_logs_metadata_email 
  ON security_logs((metadata->>'email'));

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'security_logs';
