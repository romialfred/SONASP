# Fix "Bucket Not Found" Error - Visual Guide

## ⚠️ SQL Migration Failed

The error you got:
```
ERROR: 42501: must be owner of table buckets
```

This means you don't have permission to create buckets via SQL. **Don't worry!** We'll create it through the Dashboard UI instead.

---

## ✅ Solution: Create Bucket via Dashboard

### 📍 STEP 1: Navigate to Storage

1. Open your **Supabase Dashboard**
2. Click **"Storage"** in the left sidebar
3. You'll see a list of existing buckets

---

### 📍 STEP 2: Create New Bucket

1. Click the **"New bucket"** button (top right corner)
2. A dialog will appear

Fill in these **EXACT** values:

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `license-documents` | ⚠️ Must be exact (lowercase, hyphen) |
| **Public bucket** | ❌ **OFF** | Keep it unchecked (private) |
| **File size limit** | `10 MB` | Or `10485760` bytes |
| **Allowed MIME types** | See below ⬇️ | Add each separately |

**Allowed MIME types** (click "Add" for each):
```
application/pdf
image/jpeg
image/jpg
image/png
```

3. Click **"Create bucket"**
4. ✅ You should now see "license-documents" in your bucket list

---

### 📍 STEP 3: Add Security Policies

**Option A: Use SQL (Recommended)**

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy the contents of `ADD_STORAGE_POLICIES_ONLY.sql`
3. Paste and click **"Run"**
4. ✅ Should see 4 policies created

**Option B: Manual Policy Creation**

If SQL doesn't work, create policies manually:

1. Click on **"license-documents"** bucket
2. Go to **"Policies"** tab
3. Click **"New Policy"** button

**Create these 4 policies:**

#### Policy 1: Upload Permission
```
Name: Allow authenticated upload to license-documents
Operation: INSERT
Role: authenticated
WITH CHECK: bucket_id = 'license-documents'
```

#### Policy 2: View Permission
```
Name: Allow authenticated view of license-documents
Operation: SELECT
Role: authenticated
USING: bucket_id = 'license-documents'
```

#### Policy 3: Update Own Files
```
Name: Allow users to update own license-documents
Operation: UPDATE
Role: authenticated
USING: bucket_id = 'license-documents' AND auth.uid() = owner
WITH CHECK: bucket_id = 'license-documents' AND auth.uid() = owner
```

#### Policy 4: Delete Own Files
```
Name: Allow users to delete own license-documents
Operation: DELETE
Role: authenticated
USING: bucket_id = 'license-documents' AND auth.uid() = owner
```

---

### 📍 STEP 4: Verify Bucket Exists

Run this query in **SQL Editor**:

```sql
SELECT name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'license-documents';
```

**Expected result:** 1 row showing your new bucket

---

### 📍 STEP 5: Test Upload

1. **Refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R)
2. Go to: **Licenses → Request New License**
3. Fill Step 1 (Request Details)
4. Click **"Next"**
5. Fill Step 2 (Documents):
   - Document Title: "Test Authorization"
   - Document Type: "Export Authorization"
   - Description: "Test upload"
   - **Upload a PDF file**
6. Click **"Next"**

**✅ Expected:** Should proceed to Step 3 without any "Bucket not found" error!

---

## 🎯 Quick Checklist

- [ ] Created bucket named `license-documents` (exact name)
- [ ] Set bucket to **private** (not public)
- [ ] Added allowed MIME types (PDF, JPG, PNG)
- [ ] Added 4 RLS policies (upload, view, update, delete)
- [ ] Verified bucket exists with SQL query
- [ ] Refreshed browser
- [ ] Tested document upload

---

## 📋 All Storage Buckets (After Fix)

You should now have these buckets:

| Bucket Name | Status |
|-------------|--------|
| `documents` | ✅ Exists |
| `reports` | ✅ Exists |
| `payment-proofs` | ✅ Exists |
| `batch-documents` | ✅ Exists |
| `assay-certificates` | ✅ Exists |
| **`license-documents`** | ⏳ **Create now** |

---

## ❓ Troubleshooting

### "Bucket not found" still appears after creation

**Fix:**
1. Check bucket name is EXACTLY `license-documents` (lowercase, with hyphen)
2. Clear browser cache and hard refresh (Ctrl+Shift+R)
3. Check browser console for errors (F12)

### "Permission denied" when uploading

**Fix:**
1. Make sure you added all 4 RLS policies
2. Run the SQL from `ADD_STORAGE_POLICIES_ONLY.sql`
3. Make sure bucket is created and visible in Storage section

### Can't see bucket in Storage list

**Fix:**
1. Refresh the Supabase Dashboard page
2. Check you're in the correct project
3. Try creating again with exact name `license-documents`

---

## 🎉 Summary

**Problem:** SQL migration failed with permission error

**Solution:** Create bucket via Dashboard UI instead

**Steps:**
1. ✅ Dashboard → Storage → New bucket
2. ✅ Name: `license-documents`
3. ✅ Add RLS policies via SQL or UI
4. ✅ Refresh browser
5. ✅ Test upload

**Result:** Document uploads will work! 🚀

---

## 📁 Helper Files

- `CREATE_LICENSE_BUCKET_VIA_DASHBOARD.txt` - Step-by-step text guide
- `ADD_STORAGE_POLICIES_ONLY.sql` - SQL for policies only
- `STORAGE_BUCKET_FIX_COMPLETE.md` - Full technical details

---

**Create the bucket now and test!** The error will be gone! ✅
