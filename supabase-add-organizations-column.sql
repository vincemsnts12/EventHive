-- =============================================
-- ADD ORGANIZATIONS JSONB COLUMN TO EVENTS TABLE
-- =============================================
-- This adds support for multiple organizations per event
-- Similar to the existing 'colleges' JSONB column

-- Add the organizations column (array of organization names)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS organizations JSONB DEFAULT '[]'::jsonb;

-- Create an index for faster queries on organizations
CREATE INDEX IF NOT EXISTS idx_events_organizations ON events USING GIN (organizations);

-- Migrate existing organization_name data to the new organizations array
-- Only for events that have organization_name set but empty organizations array
UPDATE events 
SET organizations = jsonb_build_array(organization_name)
WHERE organization_name IS NOT NULL 
  AND organization_name != ''
  AND (organizations IS NULL OR organizations = '[]'::jsonb);

-- Verify the migration
SELECT id, title, organization_name, organizations 
FROM events 
LIMIT 10;

-- =============================================
-- DONE!
-- =============================================
-- The 'organizations' column now stores an array of organization names
-- Example: ["TUP USG Manila", "TUP Arts Society", "TUP CAFA Student Council"]
-- The first organization in the array is considered the "primary" one
-- =============================================

