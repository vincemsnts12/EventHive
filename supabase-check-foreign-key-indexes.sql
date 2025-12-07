-- ===== CHECK FOREIGN KEY INDEXES =====
-- Foreign keys without indexes can cause slow INSERTs
-- Run this to see if foreign key columns have indexes

-- Check indexes on events table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'events'
ORDER BY indexname;

-- Check if foreign key columns have indexes
-- college_code
SELECT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'events' 
  AND indexdef LIKE '%college_code%'
) as has_college_code_index;

-- created_by
SELECT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'events' 
  AND indexdef LIKE '%created_by%'
) as has_created_by_index;

-- Check foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'events';

