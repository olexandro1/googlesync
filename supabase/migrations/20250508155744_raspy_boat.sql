/*
  # Add webhook-related fields to users table

  1. Changes
    - Add calendar_id for Google Calendar identification
    - Add webhook_channel_id for Google Push Notifications
    - Add webhook_expiry to track webhook expiration

  2. Security
    - Maintain existing RLS policies
    - No changes to access control
*/

ALTER TABLE users
ADD COLUMN IF NOT EXISTS calendar_id text,
ADD COLUMN IF NOT EXISTS webhook_channel_id text,
ADD COLUMN IF NOT EXISTS webhook_expiry timestamptz;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_calendar_id ON users(calendar_id);
CREATE INDEX IF NOT EXISTS idx_users_webhook_channel_id ON users(webhook_channel_id);