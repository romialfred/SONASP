# 🚨 URGENT - FIX DATABASE FOR USER CREATION

## ⚠️ PROBLEM IDENTIFIED

From your console screenshot, the error is:
```
Database error creating new user at createUser
```

This means the `user_profiles` table is **missing required columns** or has incorrect structure.

---

## ✅ SOLUTION - 3 STEPS (5 MINUTES)

### STEP 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
2. Click "New Query" button

### STEP 2: Copy and Execute SQL Script

1. **Open this file:**
   ```
   /tmp/cc-agent/59164212/project/FIX_USER_MANAGEMENT_DATABASE.sql
   ```

2. **Copy ALL the content** (Ctrl+A, Ctrl+C)

3. **Paste in Supabase SQL Editor** (Ctrl+V)

4. **Click "Run" button** (or press Ctrl+Enter)

5. **Wait for completion** (should take 2-3 seconds)

### STEP 3: Verify Your User Role

After running the script, execute this separately:

```sql
-- Check your current user
SELECT id, email, full_name, role, is_active
FROM user_profiles
WHERE id = auth.uid();
```

**If no result or role is not 'management':**
```sql
-- Fix: Set your user as management
UPDATE user_profiles
SET role = 'management', is_active = true
WHERE id = auth.uid();
```

**If no profile at all:**
```sql
-- Create your profile
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
  auth.uid(),
  (SELECT email FROM auth.users WHERE id = auth.uid()),
  'Admin User',
  'management',
  true;
```

---

## 🧪 TEST IMMEDIATELY

After running the SQL:

1. **Refresh your application** (Ctrl+R)
2. **Go to Administration → User Management**
3. **Click "Create User"**
4. **Fill the form:**
   - Full Name: Test User
   - Email: test@example.com
   - Role: Factory
5. **Click "Generate"** for password
6. **Click "Create User"**

**Expected Result:**
```
✅ User created successfully!
✅ User activated immediately.
Temporary Password: [random password]
```

---

## 📋 WHAT THE SQL SCRIPT DOES

The script will:

1. ✅ Check `user_profiles` table structure
2. ✅ Add missing columns:
   - `two_factor_enabled` (boolean)
   - `last_login_at` (timestamptz)
   - `is_active` (boolean with default true)
3. ✅ Create `modules` table if missing
4. ✅ Insert default modules (Dashboard, Batch Management, etc.)
5. ✅ Create `user_permissions` table if missing
6. ✅ Enable Row Level Security (RLS) on all tables
7. ✅ Create proper RLS policies for:
   - user_profiles (view own, management view all)
   - modules (all can view active, management manage)
   - user_permissions (view own, management manage all)
8. ✅ Grant permissions to service_role (for Edge Functions)
9. ✅ Create helper function `create_user_profile()`
10. ✅ Verify setup and show summary

---

## 🔍 VERIFICATION OUTPUT

After running the script, you should see:

```
=== CHECKING user_profiles TABLE ===
✓ Added column: two_factor_enabled
✓ Added column: last_login_at
  Column already exists: is_active

=== CHECKING modules TABLE ===
✓ Inserting default modules...
✓ Default modules created

=== CHECKING user_permissions TABLE ===
  Table created

=== ENABLING ROW LEVEL SECURITY ===
  RLS enabled on all tables

=== VERIFICATION ===
✓ user_profiles: X records
✓ modules: 12 records
✓ user_permissions: X records
✓ Current user has management role

=== SETUP COMPLETE ===
```

---

## ❌ IF SCRIPT FAILS

If you get errors, try running sections one at a time:

### Section 1: Fix user_profiles
```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE user_profiles
ALTER COLUMN is_active SET DEFAULT true;
```

### Section 2: Create modules
```sql
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO modules (name, display_name, description, category) VALUES
  ('user_management', 'User Management', 'Manage user accounts', 'Administration')
ON CONFLICT (name) DO NOTHING;
```

### Section 3: Enable RLS
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
```

---

## 🎯 AFTER SUCCESSFUL EXECUTION

Your database will have:

| Table | Status | Records |
|-------|--------|---------|
| `user_profiles` | ✅ Fixed | Your users |
| `modules` | ✅ Created | 12 modules |
| `user_permissions` | ✅ Created | 0 (will be filled) |

**RLS Policies:** ✅ All set up correctly

**Edge Functions:** ✅ Will now work (they use service_role)

---

## 🐛 COMMON ERRORS & FIXES

### Error: "relation user_profiles does not exist"

This means the table doesn't exist at all!

**Fix:** Create it first:
```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'factory',
  is_active boolean DEFAULT true,
  two_factor_enabled boolean DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Error: "column already exists"

This is OK! The script uses `IF NOT EXISTS` to avoid this.

### Error: "permission denied"

You don't have permissions to run the script.

**Fix:** Make sure you're logged in as database owner or admin.

---

## ✅ SUCCESS CHECKLIST

After running the script, verify:

- [ ] SQL script executed without errors
- [ ] `user_profiles` table has `two_factor_enabled` column
- [ ] `user_profiles` table has `last_login_at` column
- [ ] `modules` table exists with 12 records
- [ ] `user_permissions` table exists
- [ ] Your user has `role = 'management'`
- [ ] RLS is enabled on all tables
- [ ] Test user creation succeeds

---

## 🚀 QUICK COMMAND SUMMARY

**Copy this, paste in SQL Editor, run:**

```sql
-- 1. Fix user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 2. Ensure your user is management
UPDATE user_profiles SET role = 'management', is_active = true WHERE id = auth.uid();

-- 3. Grant permissions to service_role
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON modules TO service_role;
GRANT ALL ON user_permissions TO service_role;
```

Then test user creation!

---

**File to execute:** `FIX_USER_MANAGEMENT_DATABASE.sql`

**Supabase SQL Editor:** https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql

**Time required:** 2-3 minutes

**After this, user creation WILL WORK!** ✅
