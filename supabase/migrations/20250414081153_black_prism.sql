/*
  # Create calendar events table

  1. New Tables
    - `calendar_events`
      - `id` (uuid, primary key)
      - `google_event_id` (text, unique)
      - `summary` (text)
      - `description` (text)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `created_at` (timestamptz)
      - `calendar_id` (text)

  2. Security
    - Enable RLS on `calendar_events` table
    - Add policy for public access (since we're not using authentication)
*/

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id text UNIQUE NOT NULL,
  summary text,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  calendar_id text NOT NULL
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to calendar events"
  ON calendar_events
  FOR ALL
  TO public
  USING (true);