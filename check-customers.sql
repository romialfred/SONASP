-- Quick check for customers in database
-- Run this in Supabase SQL Editor to verify customers exist

-- Check if customers table exists and show count
SELECT COUNT(*) as total_customers FROM customers;

-- Show all customers with their status
SELECT
  id,
  name,
  email,
  country,
  status,
  created_at
FROM customers
ORDER BY name;

-- Check RLS policies on customers table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'customers';
