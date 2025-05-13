/*
  # Restore Calendar Events Schema

  1. Changes
    - Add back necessary fields for Google Calendar integration
    - Restore description and location fields
    - Add google_event_id field
    - Maintain existing RLS policies

  2. Security
    - Maintain existing RLS policies
    - Keep user-specific access controls
*/

-- Add back necessary columns
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS google_event_id text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS location text;

-- Create composite unique constraint for user_id and google_event_id
-- This allows the same Google event to exist for different users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calendar_events_user_id_google_event_id_key'
  ) THEN
    ALTER TABLE calendar_events
    ADD CONSTRAINT calendar_events_user_id_google_event_id_key 
    UNIQUE (user_id, google_event_id);
  END IF;
END $$;