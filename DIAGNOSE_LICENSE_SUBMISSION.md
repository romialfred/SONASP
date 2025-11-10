# 🔍 License Submission Issue - No Data Recorded

## 🚨 Problem
You see "registration done" success message, but no data is saved to the database.

---

## 🎯 Possible Causes

### 1. **Silent Error (Most Likely)**
The success message shows even if the database INSERT fails because the error is caught but not properly handled.

### 2. **RLS Policy Still Blocking**
Even after running the fix SQL, there might be an issue with the policies.

### 3. **Missing `created_by` Field**
The INSERT might fail because `created_by` is not being set properly.

---

## 🔧 Diagnostic Steps

### **STEP 1: Check Browser Console**

1. Open your browser
2. Press **F12** to open Developer Tools
3. Click **Console** tab
4. Clear the console (trash icon)
5. Submit a license request
6. **Look for RED errors** in console
7. Take a screenshot and share it

---

### **STEP 2: Check Database**

Run this SQL in Supabase SQL Editor:

```sql
-- Check if any license requests exist
SELECT
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_count,
  COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted_count
FROM license_requests;

-- Show recent requests
SELECT
  id,
  request_number,
  mine_name,
  title,
  status,
  created_at
FROM license_requests
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- If `total_requests` = 0 → Data is NOT being saved
- If `total_requests` > 0 → Data IS being saved, but not showing in UI

---

### **STEP 3: Check RLS Policies**

Run this in SQL Editor:

```sql
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'license_requests'
ORDER BY policyname;
```

**Expected Policies:**
- ✅ Authenticated users can create license requests (INSERT)
- ✅ Authenticated users can view license requests (SELECT)
- ✅ Users can update their own draft license requests (UPDATE)
- ✅ Management can delete license requests (DELETE)

---

## 🛠️ Quick Fix Attempts

### **Fix 1: Check User Authentication**

Run this in SQL Editor to see your user:

```sql
SELECT
  auth.uid() as my_user_id,
  auth.email() as my_email;

SELECT
  id,
  email,
  role,
  full_name
FROM user_profiles
WHERE id = auth.uid();
```

**If you see:**
- `my_user_id` is NULL → You're not logged in (re-login)
- `my_user_id` exists but no user_profile → Need to create profile

---

### **Fix 2: Verify RLS Policies Are Applied**

If you already ran `FIX_LICENSE_REQUESTS_RLS.sql`, run it again to ensure:

```sql
-- Drop and recreate policies
DROP POLICY IF EXISTS "Authenticated users can create license requests" ON license_requests;

CREATE POLICY "Authenticated users can create license requests"
  ON license_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by OR created_by IS NULL
  );
```

---

### **Fix 3: Add Debug Logging**

I'll create a version of the service with better error logging.

---

## 📊 Test Procedure

After applying fixes:

1. **Open Browser Console** (F12 → Console)
2. **Clear Console**
3. **Go to:** Licenses → Request New License
4. **Fill Step 1:**
   - Title: "Test License"
   - Mining Company: Select any
   - Quantity: 100
   - Start Date: Today
   - End Date: Tomorrow
   - Click "Next" or "Save Draft"
5. **Watch Console** for errors
6. **Check Database:**
   ```sql
   SELECT * FROM license_requests
   ORDER BY created_at DESC
   LIMIT 1;
   ```

---

## 🎯 Expected Behavior

### **When Saving Draft:**
1. Form validates (Step 1)
2. API call to Supabase: `INSERT INTO license_requests`
3. Database returns the new record with ID
4. `setRequestId(request.id)` stores the ID
5. Success notification shows
6. User can proceed to Step 2

### **When Submitting (Step 3):**
1. Form validates signature
2. API call: `UPDATE license_requests SET status='SUBMITTED'`
3. Database updates the record
4. Success notification shows
5. User is redirected to listing page

---

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Success message but no data | Silent error catch | Check browser console |
| "Not authenticated" error | Session expired | Re-login |
| "violates RLS policy" | Policies not applied | Re-run FIX_LICENSE_REQUESTS_RLS.sql |
| No error, no data | INSERT fails silently | Add console.log to catch error |
| Draft saves but submit fails | UPDATE policy issue | Check UPDATE policy exists |

---

## 🔍 Next Steps

**Please provide:**
1. Screenshot of **browser console** when you submit
2. Result of running: `SELECT COUNT(*) FROM license_requests;`
3. Result of running: `SELECT * FROM pg_policies WHERE tablename = 'license_requests';`

With this info, I can pinpoint the exact issue and provide a targeted fix.

---

## 📁 Files to Use

| File | Purpose |
|------|---------|
| **CHECK_LICENSE_DATA.sql** | Run to check if data exists |
| **FIX_LICENSE_REQUESTS_RLS.sql** | Re-run if RLS is still blocking |
| **DIAGNOSE_LICENSE_SUBMISSION.md** | This file - diagnostic guide |

---

## 💡 Quick Test

**Simplest test to isolate the issue:**

Open browser console and run:

```javascript
// Test if you can insert data directly
const { data, error } = await supabase
  .from('license_requests')
  .insert({
    mine_id: '00000000-0000-0000-0000-000000000000',
    mine_name: 'Test Mine',
    title: 'Console Test',
    planned_quantity_oz: 100,
    request_date: '2025-11-10',
    status: 'DRAFT',
    created_by: (await supabase.auth.getUser()).data.user.id
  })
  .select();

console.log('Result:', data);
console.log('Error:', error);
```

**If this works:** The issue is in the form/service code
**If this fails:** The issue is in RLS policies or database setup

---

Let me know the results and I'll provide a specific fix! 🚀
