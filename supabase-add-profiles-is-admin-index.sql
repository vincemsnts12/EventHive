-- ===== ADD INDEX ON PROFILES.IS_ADMIN =====
-- This speeds up RLS policy evaluation for UPDATE/DELETE operations
-- Even though SELECT policies shouldn't evaluate UPDATE/DELETE policies,
-- having this index helps overall database performance

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- Also add a composite index for the common RLS check pattern
-- This is used in UPDATE/DELETE policies: WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
CREATE INDEX IF NOT EXISTS idx_profiles_id_is_admin ON public.profiles(id, is_admin) WHERE is_admin = TRUE;

