/*
  # Fix RLS policies for users table

  1. Changes
    - Remove circular dependencies in RLS policies
    - Simplify policy structure
    - Add basic policies for authentication flow

  2. Security
    - Maintain secure access control
    - Allow users to manage their own data
    - Enable signup flow
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view all user data" ON users;
DROP POLICY IF EXISTS "Only admins can insert users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own user data" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can view their own user data" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Allow users to insert themselves during signup" ON users;

-- Create new policies without circular dependencies
CREATE POLICY "Enable read access for authenticated users"
ON users FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

CREATE POLICY "Enable self-update for users"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Enable insert for authentication"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);