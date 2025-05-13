/*
  # Update calendar events table structure

  1. Changes
    - Remove unnecessary columns
    - Add email column with proper NULL handling
    - Create index for email lookups

  2. Security
    - Maintain existing RLS policies
*/

-- First, add email column as nullable
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS email text;

-- Update existing records with email from users table
UPDATE calendar_events
SET email = users.email
FROM users
WHERE calendar_events.user_id = users.id
AND calendar_events.email IS NULL;

-- Now make the email column NOT NULL
ALTER TABLE calendar_events
ALTER COLUMN email SET NOT NULL;

-- Remove unnecessary columns
ALTER TABLE calendar_events
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS google_event_id;

-- Create index on email for faster queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_email ON calendar_events(email);