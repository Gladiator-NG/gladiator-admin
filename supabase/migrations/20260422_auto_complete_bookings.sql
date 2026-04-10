-- ── Auto-complete past bookings ──────────────────────────────────────────────
--
-- 1. Extend the status check constraint to allow 'completed'.
-- 2. Create a function that marks all non-cancelled/expired bookings whose
--    end_date is before today as 'completed'.
-- 3. Schedule it with pg_cron to run every hour so status always stays current.
--
-- If the Supabase CLI times out, run this manually in the SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Widen the status constraint
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'completed'));

-- Step 2: Function that performs the bulk update
CREATE OR REPLACE FUNCTION public.auto_complete_bookings()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET
    status     = 'completed',
    updated_at = now()
  WHERE
    status IN ('pending', 'confirmed')
    AND end_date < CURRENT_DATE;
END;
$$;

-- Allow the service-role and authenticated users to call the function
GRANT EXECUTE ON FUNCTION public.auto_complete_bookings() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_complete_bookings() TO authenticated;

-- Step 2b: Run it immediately so existing past bookings are marked completed now
SELECT public.auto_complete_bookings();

-- Step 3: Enable pg_cron and schedule the job
-- pg_cron is available on Supabase Pro/Team plans.
-- On the Free plan, the client-side call on page load handles this instead.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove any existing schedule before re-creating
SELECT cron.unschedule('auto-complete-bookings') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-bookings'
);

-- Run every hour at :05 past (avoids exact midnight edge cases)
SELECT cron.schedule(
  'auto-complete-bookings',
  '5 * * * *',
  $$SELECT public.auto_complete_bookings()$$
);
