-- ============================================================
-- EVENTHIVE DEVICE-BASED MFA
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TRUSTED DEVICES TABLE
-- Stores devices that have been verified and trusted by users
-- ============================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_name TEXT, -- Optional: "Chrome on Windows", etc.
    trusted_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint: one fingerprint per user
    UNIQUE(user_id, device_fingerprint)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expiry ON trusted_devices(trusted_until);

-- ============================================================
-- 2. MFA CODES TABLE
-- Stores pending verification codes
-- ============================================================
CREATE TABLE IF NOT EXISTS mfa_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mfa_codes_user ON mfa_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_codes_expiry ON mfa_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_mfa_codes_verified ON mfa_codes(verified);

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES - TRUSTED DEVICES
-- ============================================================
-- Users can view their own trusted devices
CREATE POLICY "Users can view own trusted devices"
    ON trusted_devices FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own trusted devices
CREATE POLICY "Users can add trusted devices"
    ON trusted_devices FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own trusted devices
CREATE POLICY "Users can update own trusted devices"
    ON trusted_devices FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can delete their own trusted devices
CREATE POLICY "Users can remove trusted devices"
    ON trusted_devices FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================
-- 5. RLS POLICIES - MFA CODES
-- ============================================================
-- Users can view their own MFA codes
CREATE POLICY "Users can view own MFA codes"
    ON mfa_codes FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert MFA codes for themselves
CREATE POLICY "Users can create MFA codes"
    ON mfa_codes FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own MFA codes (for attempts/verified)
CREATE POLICY "Users can update own MFA codes"
    ON mfa_codes FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can delete their own MFA codes
CREATE POLICY "Users can delete own MFA codes"
    ON mfa_codes FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================================
-- 6. CLEANUP FUNCTION - Remove expired codes and devices
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_data()
RETURNS void AS $$
BEGIN
    -- Delete expired MFA codes
    DELETE FROM mfa_codes WHERE expires_at < NOW();
    
    -- Delete expired trusted devices
    DELETE FROM trusted_devices WHERE trusted_until < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_mfa_data() TO authenticated;

-- ============================================================
-- 7. HELPER FUNCTION - Check if device is trusted
-- ============================================================
CREATE OR REPLACE FUNCTION is_device_trusted(
    p_user_id UUID,
    p_fingerprint TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    is_trusted BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM trusted_devices
        WHERE user_id = p_user_id
        AND device_fingerprint = p_fingerprint
        AND trusted_until > NOW()
    ) INTO is_trusted;
    
    -- Update last_used_at if trusted
    IF is_trusted THEN
        UPDATE trusted_devices
        SET last_used_at = NOW()
        WHERE user_id = p_user_id
        AND device_fingerprint = p_fingerprint;
    END IF;
    
    RETURN is_trusted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_device_trusted(UUID, TEXT) TO authenticated;

-- ============================================================
-- DONE!
-- ============================================================
-- Tables created:
-- ✅ trusted_devices - Stores verified devices (7-day trust)
-- ✅ mfa_codes - Stores pending verification codes
-- 
-- Functions created:
-- ✅ cleanup_expired_mfa_data() - Remove expired records
-- ✅ is_device_trusted() - Check if device is trusted
--
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Deploy Vercel API for email sending
-- 3. Add frontend JavaScript and modal
-- ============================================================
