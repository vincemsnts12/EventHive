-- ===== ADD UPDATE AND DELETE POLICIES FOR EVENTS TABLE =====
-- These policies allow only admins to update and delete events
-- Uses a centralized is_admin() helper function for better performance

-- 1) Optional helper function to centralize admin check
-- This is STABLE so PostgreSQL can cache results within a transaction
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER 
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = TRUE
  );
$$;

-- Revoke execute from public roles so only callers with explicit rights can use it
-- (Policies can still use it, but direct function calls are restricted)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;

-- 2) Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- 3) Create UPDATE policy: Only authenticated admins can update events
CREATE POLICY "Admins can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4) Create DELETE policy: Only authenticated admins can delete events
CREATE POLICY "Admins can delete events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Verify policies were created
-- You can run this query to check:
-- SELECT * FROM pg_policies WHERE tablename = 'events' AND (policyname LIKE '%update%' OR policyname LIKE '%delete%');

