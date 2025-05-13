/*
  # Simplify calendar events table structure

  1. Changes
    - Drop existing calendar_events table
    - Create new simplified calendar_events table with essential fields
    - Add proper indexes for performance
    - Update RLS policies

  2. New Table Structure
    - id (uuid, primary key)
    - user_id (uuid, references users)
    - title (text)
    - start_time (timestamptz)
    - end_time (timestamptz)
    - created_at (timestamptz)

  3. Security
    - Enable RLS
    - Add policies for user-specific access
*/

-- Drop existing table and its dependencies
DROP TABLE IF EXISTS calendar_events CASCADE;

-- Create new simplified table
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());