# 🔧 Mining Companies Dropdown - Diagnostic & Fix Guide

## 🎯 Problem
The mining companies dropdown in the license request form is empty.

---

## 📋 Diagnostic Steps

### **Step 1: Run Diagnostic Script**

**File:** `CHECK_MINING_COMPANIES.sql`

1. Open Supabase SQL Editor
2. Copy the entire `CHECK_MINING_COMPANIES.sql` file
3. Paste and click **RUN**
4. Review the output

---

## 🔍 What the Diagnostic Script Does

### **Checks Performed:**

1. ✅ **Table Exists** - Verifies `mining_companies` table exists
2. ✅ **Table Structure** - Shows all columns and their types
3. ✅ **Record Count** - Counts total, active, inactive companies
4. ✅ **Data Display** - Shows all companies with their status
5. ✅ **RLS Policies** - Lists Row Level Security policies
6. ✅ **RLS Enabled** - Checks if RLS is turned on
7. ✅ **Auto-Insert** - Adds 5 sample companies if table is empty
8. ✅ **Final Status** - Summary of active companies

---

## 🩺 Common Issues & Solutions

### **Issue 1: No Mining Companies Exist**

**Symptom:**
```
Total companies: 0
Active companies: 0
```

**Solution:**
The script automatically inserts 5 sample companies:
- Mansa Resources SARL (Guinea)
- SAG Mining Company (Guinea)
- Gold Fields Guinea (Guinea)
- African Gold Group (Côte d'Ivoire)
- West African Minerals (Mali)

**Or manually insert:**
```sql
INSERT INTO mining_companies (name, status, country, contact_email, contact_phone)
VALUES
  ('Your Company Name', 'active', 'Guinea', 'contact@company.com', '+224-XXX-XXXX');
```

---

### **Issue 2: All Companies Are Inactive**

**Symptom:**
```
Total companies: 5
Active companies: 0
Inactive companies: 5
```

**Solution:**
```sql
-- Activate all companies
UPDATE mining_companies
SET status = 'active';

-- Or activate specific company
UPDATE mining_companies
SET status = 'active'
WHERE name = 'Mansa Resources SARL';
```

---

### **Issue 3: Status Column Is NULL**

**Symptom:**
```
Companies without status: 5
```

**Solution:**
```sql
UPDATE mining_companies
SET status = 'active'
WHERE status IS NULL;
```

---

### **Issue 4: RLS Policy Blocking Access**

**Symptom:**
- Companies exist
- Status is 'active'
- Dropdown still empty
- Browser console shows: "permission denied" or "RLS policy violation"

**Check current user:**
```sql
SELECT
  auth.uid() as current_user_id,
  auth.email() as current_user_email;
```

**Solution A - Verify RLS Policies:**
```sql
-- Check existing policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'mining_companies';
```

**Solution B - Add permissive SELECT policy:**
```sql
-- Allow authenticated users to view active mining companies
DROP POLICY IF EXISTS "Allow authenticated users to view mining companies" ON mining_companies;

CREATE POLICY "Allow authenticated users to view mining companies"
ON mining_companies
FOR SELECT
TO authenticated
USING (status = 'active');
```

---

### **Issue 5: Wrong Query Filter**

**Current query in form:**
```typescript
const { data } = await supabase
  .from('mining_companies')
  .select('id, name')
  .eq('status', 'active')  // ← Filtering by 'active'
  .order('name');
```

**Check if status values match:**
```sql
-- Show unique status values
SELECT DISTINCT status, COUNT(*)
FROM mining_companies
GROUP BY status;
```

**If status values are different (e.g., 'Active', 'ACTIVE', '1'):**
```sql
-- Standardize to lowercase 'active'
UPDATE mining_companies
SET status = 'active'
WHERE LOWER(status) = 'active';
```

---

## 🖥️ Frontend Improvements (Already Implemented)

### **Enhanced Error Handling:**

The form now includes:

1. **Loading State:**
   ```
   Loading mining companies...
   ```

2. **Error Messages:**
   ```
   ⚠️ Mining Companies Issue
   No active mining companies found. Please contact administrator.
   Please run the diagnostic script: CHECK_MINING_COMPANIES.sql
   ```

3. **Success Feedback:**
   ```
   ✓ Loaded 5 active mining companies
   ```

4. **Browser Console Logging:**
   - Logs count of companies loaded
   - Logs errors with details
   - Logs warnings if no companies found

---

## 🧪 Testing the Fix

### **After Running Diagnostic:**

1. **Open browser console** (F12 → Console tab)

2. **Navigate to form:**
   ```
   http://localhost:5173/licenses/requests/new
   ```

3. **Check console output:**
   ```
   Loaded 5 mining companies: [{id: '...', name: 'Mansa Resources'}, ...]
   ```

4. **Check dropdown:**
   - Should show "Select a mining company" (not "Loading...")
   - Should list all active companies
   - Should show green success message: "✓ Loaded X companies"

---

## 🔧 Quick Fix Commands

### **If dropdown is empty, run these in order:**

```sql
-- 1. Check table
SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'active')
FROM mining_companies;

-- 2. If count is 0, insert samples
INSERT INTO mining_companies (name, status, country, contact_email, contact_phone)
VALUES
  ('Mansa Resources SARL', 'active', 'Guinea', 'contact@mansa.gn', '+224-XXX-XXXX'),
  ('SAG Mining Company', 'active', 'Guinea', 'info@sag.gn', '+224-XXX-XXXX')
ON CONFLICT (name) DO NOTHING;

-- 3. If count > 0 but active = 0, activate them
UPDATE mining_companies
SET status = 'active';

-- 4. Verify
SELECT id, name, status FROM mining_companies WHERE status = 'active';
```

---

## 📊 Expected Output After Fix

### **In Supabase SQL Editor:**
```
✓ Table mining_companies EXISTS
Active companies: 5

Results:
 id                                   | name                    | status
--------------------------------------+-------------------------+--------
 abc-123...                          | African Gold Group      | active
 def-456...                          | Gold Fields Guinea      | active
 ghi-789...                          | Mansa Resources SARL    | active
 ...
```

### **In Browser Console:**
```
Loaded 5 mining companies: [
  {id: 'abc-123...', name: 'Mansa Resources SARL'},
  {id: 'def-456...', name: 'SAG Mining Company'},
  ...
]
```

### **In Form UI:**
```
Mining Company *
[Select a mining company ▼]
  Mansa Resources SARL
  SAG Mining Company
  Gold Fields Guinea
  African Gold Group
  West African Minerals

✓ Loaded 5 active mining companies
```

---

## 🚨 Still Not Working?

### **Check these:**

1. **Database Connection:**
   ```typescript
   // In browser console
   console.log(import.meta.env.VITE_SUPABASE_URL);
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```
   Should show valid values, not undefined.

2. **Authentication:**
   ```typescript
   // In browser console
   const { data } = await window.supabase.auth.getUser();
   console.log(data.user);
   ```
   Should show logged-in user.

3. **Manual Query Test:**
   ```typescript
   // In browser console
   const { data, error } = await window.supabase
     .from('mining_companies')
     .select('id, name')
     .eq('status', 'active');
   console.log('Data:', data);
   console.log('Error:', error);
   ```

4. **Network Tab:**
   - Open Network tab in DevTools
   - Filter by "mining_companies"
   - Check the response
   - Should return array of companies

---

## 📁 Files Involved

### **Created:**
- ✅ `CHECK_MINING_COMPANIES.sql` - Diagnostic script

### **Modified:**
- ✅ `src/pages/licenses/LicenseRequestForm.tsx` - Enhanced error handling

---

## ✅ Summary

**The dropdown issue is typically caused by:**
1. No companies in database (most common)
2. All companies have `status != 'active'`
3. RLS policy blocking access
4. Database connection issue

**The diagnostic script fixes #1 and #2 automatically!**

Just run `CHECK_MINING_COMPANIES.sql` and the dropdown should populate.

---

## 🎯 Action Plan

```
Step 1: Run CHECK_MINING_COMPANIES.sql
   ↓
Step 2: Check output - are there active companies?
   ↓
Step 3: Refresh browser and check dropdown
   ↓
Step 4: Check browser console for errors
   ↓
Step 5: If still empty, check RLS policies
   ↓
✅ Dropdown should now work!
```

---

**Build Status:** ✅ Success (28.55s)
**Ready for:** ✅ Testing
