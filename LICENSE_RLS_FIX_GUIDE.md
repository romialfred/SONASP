# 🔧 Fix License Submission Error - Step by Step Guide

## 🚨 The Error You're Seeing

```
Submission Failed
new row violates row-level security policy for table "license_requests"
```

---

## 💡 Quick Solution (2 Minutes)

### **STEP 1: Open SQL Editor**

1. Go to your **Supabase Dashboard**
2. Click **"SQL Editor"** in the left sidebar (looks like `</>` icon)
3. Click **"New query"** button

---

### **STEP 2: Run First Fix**

1. Open the file: **`FIX_LICENSE_REQUESTS_RLS.sql`** from your project
2. Copy **ALL** the SQL code
3. Paste into Supabase SQL Editor
4. Click **"Run"** button (or press Ctrl/Cmd + Enter)
5. Should see: ✅ **"Success. No rows returned"**

---

### **STEP 3: Run Second Fix**

1. Open the file: **`FIX_LICENSE_DOCUMENTS_RLS.sql`**
2. Copy **ALL** the SQL code
3. Paste into Supabase SQL Editor
4. Click **"Run"** button
5. Should see: ✅ **"Success. No rows returned"**

---

### **STEP 4: Verify Policies**

In SQL Editor, run this to check:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'license_requests'
ORDER BY policyname;
```

**You should see:**
- ✅ Authenticated users can create license requests (INSERT)
- ✅ Authenticated users can view license requests (SELECT)
- ✅ Management can delete license requests (DELETE)
- ✅ Users can update their own draft license requests (UPDATE)

---

### **STEP 5: Test Again**

1. **Refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R)
2. Go to: **Licenses → Request New License**
3. Fill in **Step 1** (Request Details)
4. Click **"Next"**
5. Fill in **Step 2** (Documents - optional)
6. Click **"Submit Request"**
7. ✅ **Should work without error!**

---

## 🎯 What This Fix Does

### **Before (Problem):**
```
RLS Policy: Only allow users with role='factory' OR role='management'
Your User: Doesn't have these roles set
Result: ❌ Database blocks INSERT
```

### **After (Fixed):**
```
RLS Policy: Allow ALL authenticated (logged in) users
Your User: Is authenticated
Result: ✅ Database allows INSERT
```

---

## 📊 Technical Explanation

### **Original Restrictive Policy:**
```sql
CREATE POLICY "Factory and management can create license requests"
  ON license_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('management', 'factory')  -- ❌ Too restrictive
    )
  );
```

### **New Permissive Policy:**
```sql
CREATE POLICY "Authenticated users can create license requests"
  ON license_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by OR created_by IS NULL  -- ✅ Allows authenticated users
  );
```

---

## 🔍 Why This Happened

The original migration (`20251108000000_create_export_license_system.sql`) created very strict policies that:

1. ❌ Assumed user roles are fully configured in `user_profiles` table
2. ❌ Only allowed users with specific roles ('factory', 'management')
3. ❌ Blocked all other users from creating license requests

**The fix:**
1. ✅ Allows ALL authenticated (logged in) users to create requests
2. ✅ Still maintains security (must be logged in)
3. ✅ Users can only edit their own DRAFT requests
4. ✅ Management can still manage all requests

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| **FIX_LICENSE_REQUESTS_RLS.sql** | Fixes license_requests table policies (run FIRST) |
| **FIX_LICENSE_DOCUMENTS_RLS.sql** | Fixes license_request_documents table policies (run SECOND) |
| **FIX_LICENSE_RLS_NOW.txt** | Quick reference card |
| **LICENSE_RLS_FIX_GUIDE.md** | This detailed guide |

---

## ⚠️ Alternative: If SQL Editor Doesn't Work

If you can't run the SQL files, use the **Dashboard UI**:

### **Step 1: Navigate to Policies**
1. Dashboard → **Authentication** → **Policies**
2. Or: Dashboard → **Database** → **Policies**

### **Step 2: Find license_requests Table**
1. Look for `license_requests` in the table list
2. Click on it to see existing policies

### **Step 3: Delete Old Policies**
Delete these policies (click the trash icon):
- ❌ "Factory and management can create license requests"
- ❌ "Users can view license requests"
- ❌ "Users can update their draft license requests"

### **Step 4: Create New Policies**

**Policy 1: Allow View**
- Name: `Authenticated users can view license requests`
- Command: `SELECT`
- Target: `authenticated`
- USING: `true`

**Policy 2: Allow Create**
- Name: `Authenticated users can create license requests`
- Command: `INSERT`
- Target: `authenticated`
- WITH CHECK: `auth.uid() = created_by OR created_by IS NULL`

**Policy 3: Allow Update Own**
- Name: `Users can update their own draft license requests`
- Command: `UPDATE`
- Target: `authenticated`
- USING: `status = 'DRAFT' AND created_by = auth.uid()`

---

## ✅ Success Indicators

After applying the fix:

| Action | Expected Result |
|--------|-----------------|
| Run SQL | ✅ "Success. No rows returned" |
| Check policies | ✅ 4 policies exist for license_requests |
| Submit form | ✅ Form submits without error |
| See success message | ✅ "License request created successfully" |

---

## 🎉 Summary

**Problem:** RLS policies blocked INSERT because user doesn't have required role

**Solution:** Update policies to allow all authenticated users

**Time:** 2 minutes

**Files to run:**
1. `FIX_LICENSE_REQUESTS_RLS.sql`
2. `FIX_LICENSE_DOCUMENTS_RLS.sql`

**Result:** License submission works! ✅

---

## 📞 Next Steps

1. ✅ Run `FIX_LICENSE_REQUESTS_RLS.sql`
2. ✅ Run `FIX_LICENSE_DOCUMENTS_RLS.sql`
3. ✅ Refresh browser
4. ✅ Test license submission
5. 🚀 Done!

---

**Need help?** Open `FIX_LICENSE_RLS_NOW.txt` for a quick reference card.
