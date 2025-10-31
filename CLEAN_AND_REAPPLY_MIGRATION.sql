-- =====================================================
-- CLEAN UP AND REAPPLY MIGRATION
-- Run this if you get "policy already exists" errors
-- =====================================================

-- Step 1: Drop all existing policies that might conflict
DROP POLICY IF EXISTS "Management can view all scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can create scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can update scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Management can delete scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Authenticated users can view report history" ON report_history;
DROP POLICY IF EXISTS "Authenticated users can create report history entries" ON report_history;
DROP POLICY IF EXISTS "Users can update their own report history entries" ON report_history;

-- Step 2: Now run the APPLY_ALL_MIGRATIONS.sql script
-- The script will create everything fresh without conflicts

-- You can run this script first, then run APPLY_ALL_MIGRATIONS.sql
-- OR just run APPLY_ALL_MIGRATIONS.sql which already includes DROP POLICY statements
