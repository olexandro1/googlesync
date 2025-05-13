/*
  # Fix Google Authentication Schema

  1. Changes
    - Add Google OAuth fields to users table
    - Ensure calendar_events table has correct structure
    - Set up proper constraints and indexes

  2. Security
    - Maintain RLS policies
    - Keep user data secure
*/

-- Ensure users table has necessary columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz,
ADD COLUMN IF NOT EXISTS name text;

-- Ensure calendar_events table has correct structure
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  google_event_id text,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT calendar_events_user_id_google_event_id_key UNIQUE (user_id, google_event_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own events' AND tablename = 'calendar_events') THEN
    CREATE POLICY "Users can view their own events"
      ON calendar_events FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own events' AND tablename = 'calendar_events') THEN
    CREATE POLICY "Users can create their own events"
      ON calendar_events FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own events' AND tablename = 'calendar_events') THEN
    CREATE POLICY "Users can update their own events"
      ON calendar_events FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own events' AND tablename = 'calendar_events') THEN
    CREATE POLICY "Users can delete their own events"
      ON calendar_events FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;