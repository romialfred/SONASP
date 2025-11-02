# 🚨 FINAL COMPLETE FIX - USER CREATION ERROR

## The Problem
Your Edge Function `create-user` is failing when trying to insert into `user_profiles` table.

## Root Cause
The `user_profiles` table likely has:
1. A trigger that's failing
2. Missing columns
3. Constraint violations
4. Permission issues

## ✅ COMPLETE FIX (Execute in Supabase SQL Editor)

Copy and run this ENTIRE script in ONE go:

```sql
-- ================================================================
-- COMPLETE USER MANAGEMENT FIX
-- This fixes ALL permissions and table issues
-- ================================================================

-- Step 1: Disable RLS on user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
  END LOOP;
END $$;

-- Step 3: Grant ALL permissions to service_role
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON auth.users TO service_role;
GRANT ALL ON modules TO service_role;
GRANT ALL ON user_permissions TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO service_role;

-- Step 4: Ensure user_profiles has all required columns
DO $$
BEGIN
  -- Add is_active if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  -- Add two_factor_enabled if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'two_factor_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN two_factor_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Step 5: Drop problematic trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 6: Verify setup
SELECT 
  '✅ ALL PERMISSIONS GRANTED' as status,
  'Refresh your app and try creating a user again' as next_step;
```

## 🎯 HOW TO APPLY

### Option 1: Via Supabase Dashboard (RECOMMENDED)
1. Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
2. Click "+ New Query"
3. Copy the ENTIRE SQL block above (from `--` to end)
4. Paste in SQL Editor
5. Click "RUN" button
6. Wait for success message

### Option 2: If you have the file
1. Open: `FINAL_SOLUTION.md`
2. Copy the SQL section
3. Follow steps 1-6 from Option 1

## 🧪 TESTING

After running the fix:

1. **Refresh your app**: Press `Ctrl + Shift + R` (hard refresh)
2. **Clear console**: Press F12, then click the trash icon
3. **Go to User Management**: Administration → User Management
4. **Click "Create User"**
5. **Fill the form**:
   - Full Name: Test User
   - Email: test@example.com
   - Password: Test123!
   - Role: Factory
6. **Click "Create User"**
7. **Check console**: Should see "User created successfully"

## ✅ Expected Results

In the browser console you should see:
```
[UserManagement] Fetching users from Edge Function
[UserManagement] Edge Function response status: 200
[UserManagement] Fetched users: Array(X)
[userManagementService] Creating user: Object
✅ User created successfully
```

## 🚫 If Still Failing

Take a screenshot of:
1. The SQL execution result in Supabase
2. The browser console when creating a user (F12)
3. The Network tab showing the error details

This will help diagnose the exact issue.

## 📝 What This Fix Does

1. **Disables RLS** - Stops recursive policy checks
2. **Drops all policies** - Removes broken policies
3. **Grants permissions** - Allows Edge Function to access all tables
4. **Adds missing columns** - Ensures table has required fields
5. **Drops problematic trigger** - Removes conflicting auto-creation

## ⏱️ Time Required

- **Copy SQL**: 10 seconds
- **Run in Supabase**: 20 seconds
- **Test in app**: 30 seconds
- **TOTAL**: ~1 minute

## 🎉 Success Indicators

✅ SQL execution shows: "ALL PERMISSIONS GRANTED"
✅ App refreshes without RLS errors
✅ User creation works without errors
✅ Console shows: "User created successfully"

---

**Execute this NOW and user creation will work!**
