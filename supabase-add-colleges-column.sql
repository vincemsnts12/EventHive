-- Add colleges column to events table for multiple college support
-- This stores an array of college codes as JSON
-- Main college is still stored in college_code for backward compatibility and event card display

-- Add the colleges column
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS colleges JSONB;

-- Create index for JSON queries (optional, but helpful for filtering)
CREATE INDEX IF NOT EXISTS idx_events_colleges ON public.events USING GIN (colleges);

-- Update existing events to have colleges array from college_code
-- This ensures all existing events have at least one college in the array
UPDATE public.events 
SET colleges = jsonb_build_array(college_code)
WHERE colleges IS NULL AND college_code IS NOT NULL;

-- For events without a college_code, set to empty array
UPDATE public.events 
SET colleges = '[]'::jsonb
WHERE colleges IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.events.colleges IS 'Array of college codes (JSONB) for collaboration events. Main college is stored in college_code for backward compatibility and event card display.';

