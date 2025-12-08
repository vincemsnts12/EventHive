-- ===== EVENTHIVE DATABASE BACKUP EXPORT =====
-- Generated: Before database reset
-- Purpose: Capture current schema and policies for rollback if needed

-- =============================================
-- SECTION 1: EXPORT CURRENT TABLE STRUCTURES
-- =============================================
-- Run this query in Supabase SQL Editor to see current tables:

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- =============================================
-- SECTION 2: EXPORT CURRENT RLS POLICIES
-- =============================================
-- Run this query to see all current policies:

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================
-- SECTION 3: EXPORT CURRENT FUNCTIONS
-- =============================================
-- Run this query to see all custom functions:

SELECT 
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- =============================================
-- SECTION 4: EXPORT CURRENT TRIGGERS
-- =============================================
-- Run this query to see all triggers:

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =============================================
-- SECTION 5: EXPORT CURRENT INDEXES
-- =============================================
-- Run this query to see all indexes:

SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =============================================
-- SECTION 6: EXPORT FOREIGN KEY CONSTRAINTS
-- =============================================

SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public';

-- =============================================
-- SECTION 7: CURRENT DATA COUNTS
-- =============================================
-- Run these to see how much data exists:

SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'event_images', COUNT(*) FROM event_images
UNION ALL SELECT 'event_likes', COUNT(*) FROM event_likes
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'colleges', COUNT(*) FROM colleges
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'security_logs', COUNT(*) FROM security_logs;

-- =============================================
-- NOTE: This is a READ-ONLY export script
-- It only queries data, it does not modify anything
-- Run each section separately in Supabase SQL Editor
-- and save the results before proceeding with the reset
-- =============================================

