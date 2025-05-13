/*
  # Update schema for Google Calendar integration

  1. Changes to Users Table
    - Add Google OAuth fields (refresh token, access token, token expiry)
    - Add name field for user display

  2. Changes to Calendar Events Table
    - Add user_id for ownership
    - Add location field
    - Remove calendar_id (no longer needed)
    - Remove unique constraint on google_event_id
    - Rename summary to title (if exists)

  3. Security Updates
    - Drop all existing calendar_events policies
    - Add new RLS policies for user-specific access
*/

-- Add Google OAuth fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz,
ADD COLUMN IF NOT EXISTS name text;

-- Update calendar_events table
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS location text;

-- Drop calendar_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'calendar_id'
  ) THEN
    ALTER TABLE calendar_events DROP COLUMN calendar_id;
  END IF;
END $$;

-- Drop unique constraint on google_event_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calendar_events_google_event_id_key' 
    AND table_name = 'calendar_events'
  ) THEN
    ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_google_event_id_key;
  END IF;
END $$;

-- Rename summary to title if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' AND column_name = 'summary'
  ) THEN
    ALTER TABLE calendar_events RENAME COLUMN summary TO title;
  END IF;
END $$;

-- Drop all existing calendar_events policies
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'calendar_events')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON calendar_events;', policy_name);
    END LOOP;
END $$;

-- Create new policies for calendar_events if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' AND policyname = 'Users can view their own events'
  ) THEN
    CREATE POLICY "Users can view their own events"
      ON calendar_events FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' AND policyname = 'Users can insert their own events'
  ) THEN
    CREATE POLICY "Users can insert their own events"
      ON calendar_events FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' AND policyname = 'Users can update their own events'
  ) THEN
    CREATE POLICY "Users can update their own events"
      ON calendar_events FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'calendar_events' AND policyname = 'Users can delete their own events'
  ) THEN
    CREATE POLICY "Users can delete their own events"
      ON calendar_events FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;