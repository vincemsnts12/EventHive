-- ============================================================
-- EVENTHIVE PROFANITY ENFORCEMENT (SERVER-SIDE)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PROFANITY WORD LIST TABLE
-- Allows dynamic word management without code changes
-- ============================================================
CREATE TABLE IF NOT EXISTS profanity_words (
    id SERIAL PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL CHECK (severity IN ('severe', 'moderate', 'mild')),
    language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fil', 'both')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profanity_words_active ON profanity_words(is_active) WHERE is_active = true;

-- ============================================================
-- 2. PROFANITY LOGS TABLE
-- Tracks all profanity violations for admin review
-- ============================================================
CREATE TABLE IF NOT EXISTS profanity_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('comment', 'username', 'bio', 'event')),
    content TEXT NOT NULL,
    flagged_words TEXT[] DEFAULT '{}',
    severity TEXT CHECK (severity IN ('severe', 'moderate', 'mild')),
    action_taken TEXT CHECK (action_taken IN ('blocked', 'warned', 'allowed')),
    source TEXT CHECK (source IN ('client', 'server', 'ai')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profanity_logs_user ON profanity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_profanity_logs_severity ON profanity_logs(severity);
CREATE INDEX IF NOT EXISTS idx_profanity_logs_created ON profanity_logs(created_at DESC);

-- ============================================================
-- 3. PROFANITY CHECK FUNCTION
-- Server-side validation using word list table
-- ============================================================
CREATE OR REPLACE FUNCTION check_profanity(
    p_text TEXT,
    OUT has_profanity BOOLEAN,
    OUT severity TEXT,
    OUT flagged_words TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    normalized_text TEXT;
    word_record RECORD;
    found_words TEXT[] := '{}';
    highest_severity TEXT := NULL;
    severity_rank INTEGER := 0;
BEGIN
    has_profanity := false;
    severity := NULL;
    flagged_words := '{}';
    
    IF p_text IS NULL OR TRIM(p_text) = '' THEN
        RETURN;
    END IF;
    
    -- Normalize text: lowercase, remove leet speak
    normalized_text := LOWER(p_text);
    normalized_text := REPLACE(normalized_text, '0', 'o');
    normalized_text := REPLACE(normalized_text, '1', 'i');
    normalized_text := REPLACE(normalized_text, '3', 'e');
    normalized_text := REPLACE(normalized_text, '4', 'a');
    normalized_text := REPLACE(normalized_text, '5', 's');
    normalized_text := REPLACE(normalized_text, '@', 'a');
    normalized_text := REPLACE(normalized_text, '$', 's');
    normalized_text := REPLACE(normalized_text, '!', 'i');
    -- Remove separators
    normalized_text := REGEXP_REPLACE(normalized_text, '[\s\-_\.\/\\*]+', '', 'g');
    
    -- Check against word list
    FOR word_record IN 
        SELECT word, severity AS word_severity 
        FROM profanity_words 
        WHERE is_active = true
    LOOP
        IF normalized_text LIKE '%' || LOWER(word_record.word) || '%' THEN
            found_words := array_append(found_words, word_record.word);
            
            -- Track highest severity
            IF word_record.word_severity = 'severe' AND severity_rank < 3 THEN
                severity_rank := 3;
                highest_severity := 'severe';
            ELSIF word_record.word_severity = 'moderate' AND severity_rank < 2 THEN
                severity_rank := 2;
                highest_severity := 'moderate';
            ELSIF word_record.word_severity = 'mild' AND severity_rank < 1 THEN
                severity_rank := 1;
                highest_severity := 'mild';
            END IF;
        END IF;
    END LOOP;
    
    has_profanity := array_length(found_words, 1) > 0;
    severity := highest_severity;
    flagged_words := found_words;
END;
$$;

-- ============================================================
-- 4. COMMENT CONTENT VALIDATION TRIGGER
-- Blocks severe profanity, logs all violations
-- ============================================================
CREATE OR REPLACE FUNCTION validate_comment_content()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    check_result RECORD;
BEGIN
    -- Check profanity
    SELECT * INTO check_result FROM check_profanity(NEW.content);
    
    IF check_result.has_profanity THEN
        -- Log the violation
        INSERT INTO profanity_logs (user_id, content_type, content, flagged_words, severity, action_taken, source)
        VALUES (NEW.user_id, 'comment', NEW.content, check_result.flagged_words, check_result.severity,
                CASE WHEN check_result.severity = 'severe' THEN 'blocked' ELSE 'allowed' END,
                'server');
        
        -- Block severe content
        IF check_result.severity = 'severe' THEN
            RAISE EXCEPTION 'Comment contains inappropriate content and cannot be posted.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create or replace trigger on comments table
DROP TRIGGER IF EXISTS validate_comment_content_trigger ON comments;
CREATE TRIGGER validate_comment_content_trigger
    BEFORE INSERT OR UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION validate_comment_content();

-- ============================================================
-- 5. PROFILE CONTENT VALIDATION TRIGGER
-- Validates username and bio
-- ============================================================
CREATE OR REPLACE FUNCTION validate_profile_content()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    username_check RECORD;
    bio_check RECORD;
BEGIN
    -- Check username for profanity
    IF NEW.username IS DISTINCT FROM COALESCE(OLD.username, '') THEN
        SELECT * INTO username_check FROM check_profanity(NEW.username);
        
        IF username_check.has_profanity AND username_check.severity IN ('severe', 'moderate') THEN
            -- Log the violation
            INSERT INTO profanity_logs (user_id, content_type, content, flagged_words, severity, action_taken, source)
            VALUES (NEW.id, 'username', NEW.username, username_check.flagged_words, username_check.severity, 'blocked', 'server');
            
            RAISE EXCEPTION 'Username contains inappropriate content.';
        END IF;
    END IF;
    
    -- Check bio for profanity
    IF NEW.bio IS DISTINCT FROM COALESCE(OLD.bio, '') THEN
        SELECT * INTO bio_check FROM check_profanity(NEW.bio);
        
        IF bio_check.has_profanity AND bio_check.severity = 'severe' THEN
            -- Log the violation
            INSERT INTO profanity_logs (user_id, content_type, content, flagged_words, severity, action_taken, source)
            VALUES (NEW.id, 'bio', NEW.bio, bio_check.flagged_words, bio_check.severity, 'blocked', 'server');
            
            RAISE EXCEPTION 'Bio contains inappropriate content.';
        END IF;
        
        -- Log moderate/mild but allow
        IF bio_check.has_profanity THEN
            INSERT INTO profanity_logs (user_id, content_type, content, flagged_words, severity, action_taken, source)
            VALUES (NEW.id, 'bio', NEW.bio, bio_check.flagged_words, bio_check.severity, 'allowed', 'server');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create or replace trigger on profiles table
DROP TRIGGER IF EXISTS validate_profile_content_trigger ON profiles;
CREATE TRIGGER validate_profile_content_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION validate_profile_content();

-- ============================================================
-- 6. SEED BASIC PROFANITY WORDS
-- Add initial word list (add more as needed)
-- ============================================================
INSERT INTO profanity_words (word, severity, language) VALUES
-- Severe (Filipino)
('putangina', 'severe', 'fil'),
('tangina', 'severe', 'fil'),
('gago', 'moderate', 'fil'),
('bobo', 'moderate', 'fil'),
('tanga', 'moderate', 'fil'),
-- Severe (English)
('fuck', 'severe', 'en'),
('shit', 'moderate', 'en'),
('bitch', 'moderate', 'en'),
('asshole', 'severe', 'en'),
('nigger', 'severe', 'en'),
('faggot', 'severe', 'en')
ON CONFLICT (word) DO NOTHING;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================
-- Enable RLS on profanity_logs (admins only)
ALTER TABLE profanity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view profanity logs"
    ON profanity_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- System can insert logs (via triggers)
CREATE POLICY "System can insert profanity logs"
    ON profanity_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Enable RLS on profanity_words (admins only)
ALTER TABLE profanity_words ENABLE ROW LEVEL SECURITY;

-- Anyone can read words (for client-side sync if needed)
CREATE POLICY "Anyone can read profanity words"
    ON profanity_words FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only admins can modify words
CREATE POLICY "Admins can manage profanity words"
    ON profanity_words FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Test the check_profanity function:
-- SELECT * FROM check_profanity('This is a test with fuck and gago');
-- Expected: has_profanity=true, severity='severe', flagged_words=['fuck', 'gago']
