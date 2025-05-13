/*
  # Add Admin Role Support

  1. Changes
    - Add admin role to users table
    - Update RLS policies to allow admins to view all calendar events
    - Add policy for admin-only operations

  2. Security
    - Maintain existing user permissions
    - Add admin-specific permissions
    - Ensure proper access control
*/

-- Ensure role column exists and has correct check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'user'::text]));

-- Update calendar_events policies to allow admin access
DROP POLICY IF EXISTS "Users can view their own events" ON calendar_events;
CREATE POLICY "Users and admins can view events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- Keep existing policies for non-admin operations
DROP POLICY IF EXISTS "Users can create their own events" ON calendar_events;
CREATE POLICY "Users can create their own events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'user'
  );

DROP POLICY IF EXISTS "Users can update their own events" ON calendar_events;
CREATE POLICY "Users can update their own events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'user'
  )
  WITH CHECK (
    user_id = auth.uid() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'user'
  );

DROP POLICY IF EXISTS "Users can delete their own events" ON calendar_events;
CREATE POLICY "Users can delete their own events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'user'
  );