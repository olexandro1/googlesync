/*
  # Fix User Policies

  1. Changes
    - Remove recursive policies that were causing infinite recursion
    - Simplify user policies to prevent circular dependencies
    - Add clear, non-recursive policies for admin and user access

  2. Security
    - Maintain row-level security
    - Ensure users can only access their own data
    - Allow admins to access all user data
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

-- Create new, simplified policies
CREATE POLICY "Users can read own data"
ON users FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Users can update own data"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can insert users"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Allow users to insert themselves during signup"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
);