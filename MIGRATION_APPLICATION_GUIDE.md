# 🎯 COMPLETE MIGRATION APPLICATION GUIDE

## ❌ WHY SCRIPT 2 FAILED

The error you got:
```
ERROR: Not authenticated! You must be logged in to run this script.
```

**Cause:** Supabase SQL Editor does NOT have user authentication context. The function `auth.uid()` always returns `NULL` in the SQL Editor, even if you're logged in to the dashboard.

---

## ✅ CORRECT SOLUTION - 3 STEPS

### STEP 1: Run Database Structure Fix ✅

**File:** `FIX_DATABASE_STRUCTURE_ONLY.sql`

1. Open: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
2. Click "New Query"
3. Copy content from `FIX_DATABASE_STRUCTURE_ONLY.sql`
4. Paste and click "Run"

This should complete successfully.

---

### STEP 2: Find Your User ID

**File:** `CHECK_USER_SCHEMA.sql`

1. In same SQL Editor, click "New Query"
2. Copy content from `CHECK_USER_SCHEMA.sql`
3. Paste and click "Run"

You'll see output like:
```
=== AUTH USERS ===
id: 12345678-1234-1234-1234-123456789abc
email: your@email.com
created_at: 2024-11-01

=== USER PROFILES ===
id: 12345678-1234-1234-1234-123456789abc
email: your@email.com
role: factory  ← Need to change this!
```

**COPY YOUR USER ID** (the UUID from auth.users or user_profiles matching your email)

---

### STEP 3: Manually Set as Management

Now that you have your user ID, create a new query:

```sql
-- Replace YOUR_USER_ID with the UUID you copied
UPDATE user_profiles
SET 
  role = 'management',
  is_active = true
WHERE id = 'YOUR_USER_ID';

-- Verify the change
SELECT id, email, full_name, role, is_active
FROM user_profiles
WHERE id = 'YOUR_USER_ID';
```

**If the UPDATE returns "0 rows updated"**, your profile doesn't exist. Create it:

```sql
-- Replace YOUR_USER_ID and YOUR_EMAIL with actual values
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  two_factor_enabled
) VALUES (
  'YOUR_USER_ID',
  'YOUR_EMAIL@example.com',
  'Admin User',
  'management',
  true,
  false
);

-- Verify
SELECT id, email, full_name, role, is_active
FROM user_profiles
WHERE id = 'YOUR_USER_ID';
```

---

## 🔍 ALTERNATIVE: Get User ID from Browser

If you can't see users in SQL query results:

1. **Log in to your application**
2. Open browser console (F12)
3. Run this code:
```javascript
// Get user ID from localStorage
const token = localStorage.getItem('sb-boolqagzdqbahqnpawpb-auth-token');
if (token) {
  const data = JSON.parse(token);
  console.log('Your User ID:', data.user.id);
  console.log('Your Email:', data.user.email);
} else {
  console.log('Not logged in');
}
```

4. Copy the User ID shown
5. Use it in Step 3 above

---

## 🧪 COMPLETE VERIFICATION

After Step 3, verify everything:

### Check 1: Your Profile is Management
```sql
SELECT id, email, role, is_active
FROM user_profiles
WHERE role = 'management';
```

Should show your user with `role = 'management'`.

### Check 2: Database Structure is Fixed
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('two_factor_enabled', 'last_login_at');
```

Should return 2 rows.

### Check 3: Modules Exist
```sql
SELECT COUNT(*) FROM modules;
```

Should return 12.

### Check 4: Permissions Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'modules', 'user_permissions');
```

Should return 3 rows.

---

## 🚀 TEST USER CREATION

After completing all 3 steps:

1. **Refresh your application** (F5 or Ctrl+R)
2. **Go to Administration → User Management**
3. **Click "Create User"**
4. **Fill the form:**
   - Full Name: Test User
   - Email: test@example.com
   - Phone: +1234567890 (optional)
   - Role: Factory
5. **Click "Generate"** for temporary password
6. **Click "Create User"**

### Expected Success:
```
✅ User created successfully!
✅ User activated immediately.
Temporary Password: Abc123XYZ!@#
```

The new user should appear in the list below.

### If It Still Fails:

Check browser console (F12) for errors. Common issues:

1. **"403 Forbidden"**: Your user is not management
   - Solution: Re-run Step 3 with correct user ID

2. **"Database error"**: Missing columns
   - Solution: Re-run Step 1 (FIX_DATABASE_STRUCTURE_ONLY.sql)

3. **"Edge function error"**: Function not deployed
   - Solution: Deploy create-user edge function

4. **"modules not found"**: Modules table empty
   - Solution: Re-run Step 1

---

## 📋 QUICK REFERENCE - SQL COMMANDS

### Find Your User ID:
```sql
SELECT id, email FROM auth.users;
```

### Set User as Management:
```sql
UPDATE user_profiles
SET role = 'management', is_active = true
WHERE email = 'your@email.com';
```

### Create Profile if Missing:
```sql
INSERT INTO user_profiles (id, email, full_name, role, is_active, two_factor_enabled)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', 'Admin User'),
  'management',
  true,
  false
FROM auth.users
WHERE email = 'your@email.com'
ON CONFLICT (id) DO UPDATE
SET role = 'management', is_active = true;
```

### Verify Everything:
```sql
-- Check your profile
SELECT * FROM user_profiles WHERE email = 'your@email.com';

-- Check columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('two_factor_enabled', 'last_login_at');

-- Check modules
SELECT COUNT(*) FROM modules;
```

---

## ✅ SUCCESS CHECKLIST

Before testing user creation:

- [ ] Step 1: `FIX_DATABASE_STRUCTURE_ONLY.sql` executed successfully
- [ ] Step 2: Found your user ID from `CHECK_USER_SCHEMA.sql` or browser
- [ ] Step 3: Set your user as management with correct UUID
- [ ] Verification: Your user shows `role = 'management'`
- [ ] Verification: Columns `two_factor_enabled` and `last_login_at` exist
- [ ] Verification: 12 modules exist in `modules` table
- [ ] Application refreshed (F5)
- [ ] Edge functions deployed (create-user, get-users, reset-user-password)

After checklist complete:
- [ ] User creation test successful
- [ ] New user appears in list
- [ ] Temporary password displayed

---

## 🎯 EXECUTION SUMMARY

```
1. FIX_DATABASE_STRUCTURE_ONLY.sql ✅
   ↓
2. CHECK_USER_SCHEMA.sql (get your UUID)
   ↓
3. Manual UPDATE or INSERT with your UUID
   ↓
4. Refresh app
   ↓
5. Test user creation
```

**Time required:** 5-10 minutes
**Difficulty:** Medium (requires copy-paste UUID correctly)

---

## 🐛 TROUBLESHOOTING

### Problem: Can't see auth.users table
**Solution:** Use this query instead:
```sql
SELECT 
  id::text as user_id,
  email,
  created_at
FROM auth.users;
```

### Problem: Profile exists but role is wrong
**Solution:**
```sql
UPDATE user_profiles
SET role = 'management'
WHERE email = 'your@email.com';
```

### Problem: Profile doesn't exist at all
**Solution:** Create it with INSERT shown in Step 3

### Problem: User creation still fails after everything
**Solution:** Check Edge Functions are deployed:
- https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions

Should see:
- create-user ✅
- get-users ✅
- reset-user-password ✅

If missing, deploy them from `supabase/functions/` directory.

---

**Follow this guide step-by-step and user creation WILL work!** 🎊
