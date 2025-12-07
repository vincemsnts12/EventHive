-- ===== TEST SIMPLE INSERT =====
-- Run this to test if a basic INSERT works without the function
-- This helps diagnose if the issue is with the function or the INSERT itself

-- Test INSERT with minimal data (bypass function, test direct INSERT)
-- Replace the UUID with your actual user ID
INSERT INTO events (
  title,
  description,
  location,
  start_date,
  end_date,
  college_code,
  created_by,
  status
) VALUES (
  'Test Event',
  'Test Description',
  'Test Location',
  NOW(),
  NOW() + INTERVAL '1 hour',
  'TUP',
  '98ebde80-7e1f-4cd0-bb94-99d2c0de4a31'::UUID,  -- Replace with your user ID
  'Pending'
) RETURNING id, title, created_at;

-- If this works instantly, the issue is with the function call
-- If this also times out, the issue is with the INSERT itself (foreign keys, triggers, etc.)

