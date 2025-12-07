-- ===== OPTIMIZE EVENT INSERTS =====
-- Add indexes on foreign key columns to speed up INSERT validation
-- Foreign keys without indexes can cause slow INSERTs

-- Add index on college_code (if it doesn't exist)
-- Note: There's already idx_events_college_code, but verify it exists
CREATE INDEX IF NOT EXISTS idx_events_college_code_fk ON events(college_code);

-- Add index on created_by (if it doesn't exist)
-- Note: There's already idx_events_created_by, but verify it exists
CREATE INDEX IF NOT EXISTS idx_events_created_by_fk ON events(created_by);

-- Add index on organization_id (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_events_organization_id_fk ON events(organization_id) WHERE organization_id IS NOT NULL;

-- Verify indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'events'
  AND (indexname LIKE '%college_code%' 
    OR indexname LIKE '%created_by%' 
    OR indexname LIKE '%organization_id%')
ORDER BY indexname;

