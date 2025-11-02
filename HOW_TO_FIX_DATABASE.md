# 🔧 HOW TO FIX DATABASE - SIMPLE GUIDE

## 🚨 The Error You Got

```
ERROR: null value in column "id" of relation "user_profiles" violates not-null constraint
```

**Cause:** The previous script tried to create your user profile but `auth.uid()` was NULL because you weren't authenticated in the SQL Editor context.

---

## ✅ CORRECT SOLUTION - 2 SEPARATE SCRIPTS

### PART 1: Fix Database Structure (Run in SQL Editor)

This script only fixes tables, columns, and permissions. It does NOT touch user profiles.

**File:** `FIX_DATABASE_STRUCTURE_ONLY.sql`

**Steps:**
1. Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
2. Click "New Query"
3. Copy ALL content from `FIX_DATABASE_STRUCTURE_ONLY.sql`
4. Paste in editor
5. Click "Run"
6. Wait for success

**Expected output:**
```
✓ Added column: two_factor_enabled
✓ Added column: last_login_at
✓ Set default for is_active column
Modules count: 12
```

---

### PART 2: Set Your User as Management (Run in SQL Editor WHILE LOGGED IN)

This script creates/updates YOUR user profile with management role.

**File:** `SET_YOUR_USER_AS_MANAGEMENT.sql`

**IMPORTANT:** You must be LOGGED IN to your application first!

**Steps:**
1. **FIRST:** Log in to your application
2. Keep the app tab open
3. Go to: https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/sql
4. Click "New Query"
5. Copy ALL content from `SET_YOUR_USER_AS_MANAGEMENT.sql`
6. Paste in editor
7. Click "Run"

**Expected output:**
```
Authenticated as user: [your-uuid]
Profile exists. Current role: management
✓ Already management

OR

Authenticated as user: [your-uuid]
⚠ Profile does not exist!
Creating profile now...
✓ Profile created with management role
```

---

## 🔄 ALTERNATIVE: Manual Profile Update

If the second script doesn't work, manually update your profile:

### Step 1: Get Your User ID

While logged in to your app, open browser console (F12) and run:
```javascript
JSON.parse(localStorage.getItem('sb-boolqagzdqbahqnpawpb-auth-token')).user.id
```

Copy the UUID that appears.

### Step 2: Update in Supabase

Go to Supabase SQL Editor and run:
```sql
-- Replace YOUR_USER_ID with the UUID from step 1
UPDATE user_profiles
SET role = 'management', is_active = true
WHERE id = 'YOUR_USER_ID';
```

If no rows updated, create profile:
```sql
-- Replace YOUR_USER_ID and YOUR_EMAIL
INSERT INTO user_profiles (id, email, full_name, role, is_active, two_factor_enabled)
VALUES (
  'YOUR_USER_ID',
  'YOUR_EMAIL',
  'Admin User',
  'management',
  true,
  false
);
```

---

## 🔍 VERIFICATION

After running both scripts, verify everything:

### Check 1: Your Profile
```sql
-- In Supabase SQL Editor (while logged in)
SELECT id, email, full_name, role, is_active
FROM user_profiles
WHERE id = auth.uid();
```

**Expected:**
```
role: management
is_active: true
```

### Check 2: Columns Exist
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('two_factor_enabled', 'last_login_at');
```

**Expected:** 2 rows

### Check 3: Modules Exist
```sql
SELECT COUNT(*) FROM modules;
```

**Expected:** 12

---

## 🧪 TEST USER CREATION

After fixing database:

1. **Refresh your app** (F5)
2. Go to **Administration → User Management**
3. Click **"Create User"**
4. Fill:
   - Full Name: Test User
   - Email: test@example.com
   - Role: Factory
5. Click **"Generate"** for password
6. Click **"Create User"**

**Expected:**
```
✅ User created successfully!
✅ User activated immediately.
Temporary Password: [password shown]
```

---

## 📋 QUICK REFERENCE

| Issue | Solution |
|-------|----------|
| "null value in column id" | Script tried to create profile in wrong context |
| "Not authenticated" error | Run `SET_YOUR_USER_AS_MANAGEMENT.sql` while logged in |
| "Profile doesn't exist" | Script will create it automatically |
| "Can't create user" | Make sure Part 1 script ran successfully |
| "403 Forbidden" | Your user doesn't have management role |

---

## ⚠️ IMPORTANT NOTES

1. **Part 1 script** can be run anytime (not logged in is OK)
2. **Part 2 script** MUST be run while logged in to your app
3. If Part 2 fails, use the manual method with your user ID
4. Don't forget to refresh your app after fixing database

---

## 🎯 EXECUTION ORDER

```
1. Run FIX_DATABASE_STRUCTURE_ONLY.sql
   ↓
2. Login to your application
   ↓
3. Run SET_YOUR_USER_AS_MANAGEMENT.sql
   ↓
4. Refresh application (F5)
   ↓
5. Test user creation
```

---

## ✅ SUCCESS CRITERIA

You know it's working when:

1. ✅ Part 1 script runs without errors
2. ✅ Part 2 script shows "management" role
3. ✅ User creation shows success message
4. ✅ New user appears in list
5. ✅ Temporary password is displayed

---

**After these 2 scripts, everything will work!** 🚀
