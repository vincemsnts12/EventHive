-- ================================================================
-- SUPABASE DATABASE TRIGGER: Block Non-TUP Email Signups
-- ================================================================
-- This trigger runs IMMEDIATELY when a new user is created in auth.users
-- If the email does NOT end with @tup.edu.ph, it blocks the signup
--
-- IMPORTANT: Run this in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste this > Run
-- ================================================================

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION public.enforce_tup_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email ends with @tup.edu.ph (case-insensitive)
  IF LOWER(NEW.email) NOT LIKE '%@tup.edu.ph' THEN
    -- Log the blocked attempt (optional - for debugging)
    RAISE NOTICE 'Blocked non-TUP email signup attempt: %', NEW.email;
    
    -- Raise an exception to prevent the insert
    RAISE EXCEPTION 'Only TUP email addresses (@tup.edu.ph) are allowed to register.'
      USING ERRCODE = 'check_violation';
  END IF;
  
  -- Allow the insert for TUP emails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger on auth.users table
-- This runs BEFORE INSERT, so non-TUP users never get saved
DROP TRIGGER IF EXISTS enforce_tup_email_on_signup ON auth.users;

CREATE TRIGGER enforce_tup_email_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tup_email_domain();

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.enforce_tup_email_domain() TO service_role;

-- ================================================================
-- VERIFICATION: Test that the trigger works
-- ================================================================
-- After running the above, try:
-- 1. Sign up with a non-TUP email via Google OAuth
-- 2. You should see an error and the user should NOT appear in auth.users
--
-- To check existing non-TUP users (optional cleanup):
-- SELECT id, email FROM auth.users WHERE email NOT LIKE '%@tup.edu.ph';
--
-- To delete existing non-TUP users (BE CAREFUL - only run if needed):
-- DELETE FROM auth.users WHERE email NOT LIKE '%@tup.edu.ph';
-- ================================================================
