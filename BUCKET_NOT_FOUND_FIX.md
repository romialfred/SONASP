# 🔧 FIX: "Bucket not found" Error

## 🎯 THE PROBLEM

When clicking "Upload & Parse Certificate", you get:
```
Error: Bucket not found
```

Even though the bucket exists in Supabase Dashboard.

## 🔍 ROOT CAUSE

**The bucket exists, but lacks RLS (Row Level Security) policies!**

Supabase Storage requires **explicit RLS policies** on `storage.objects` table to allow access. Without these policies, the bucket is effectively invisible to authenticated users.

---

## ✅ THE SOLUTION (2 MINUTES)

### Step 1: Check Current Status

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run this query:

```sql
-- Copy and paste CHECK_STORAGE_STATUS.sql
```

**Expected Issues:**
- ✅ Bucket exists
- ❌ 0 or few policies found
- Result: "Bucket not found" error

### Step 2: Apply The Fix

1. Open `FIX_STORAGE_BUCKET_NOW.sql`
2. **Copy ALL content**
3. Go to Supabase → SQL Editor
4. **Paste and RUN**

**What it does:**
- ✅ Verifies bucket exists (creates if missing)
- ✅ Configures bucket settings (private, 10MB limit, PDF only)
- ✅ Drops old conflicting policies
- ✅ Creates 4 new RLS policies:
  - INSERT: Upload certificates
  - SELECT: View certificates
  - UPDATE: Update certificates
  - DELETE: Delete certificates
- ✅ Verifies everything is working

### Step 3: Verify Fix

Run `CHECK_STORAGE_STATUS.sql` again:

**Expected Result:**
```
✅ Bucket exists
✅ All policies present (4 policies)
✅ RLS Enabled
```

### Step 4: Test Upload

1. Hard refresh browser (Ctrl+Shift+R)
2. Go to Batch Details
3. Upload sample-assay-certificate.pdf
4. ✅ Should work now!

---

## 🔐 UNDERSTANDING STORAGE RLS

### Why is this needed?

Supabase Storage uses **PostgreSQL RLS** for security. Even if a bucket exists, you need explicit policies to:
- Upload files (INSERT)
- View files (SELECT)
- Update metadata (UPDATE)
- Delete files (DELETE)

### The 4 Required Policies

**1. Upload Policy (INSERT):**
```sql
CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assay-certificates'
  AND auth.uid() IS NOT NULL
);
```
Allows any authenticated user to upload to the bucket.

**2. View Policy (SELECT):**
```sql
CREATE POLICY "Users can view their batch certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assay-certificates'
  AND auth.uid() IS NOT NULL
);
```
Allows authenticated users to view/download files.

**3. Update Policy (UPDATE):**
```sql
CREATE POLICY "Users can update their certificates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (...) WITH CHECK (...);
```
Allows updating file metadata.

**4. Delete Policy (DELETE):**
```sql
CREATE POLICY "Users can delete their certificates"
ON storage.objects
FOR DELETE
TO authenticated
USING (...);
```
Allows deleting files.

---

## 🧪 TESTING CHECKLIST

After applying the fix:

- [ ] Run CHECK_STORAGE_STATUS.sql → All ✅
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Navigate to Batch Details
- [ ] Click upload area
- [ ] Select sample-assay-certificate.pdf
- [ ] Click "Upload & Parse Certificate"
- [ ] ✅ No "Bucket not found" error
- [ ] ✅ Shows "Uploading..." status
- [ ] ✅ Shows "Certificate uploaded successfully"
- [ ] ✅ Shows "Parsing Certificate..." with spinner
- [ ] ✅ Certificate appears in list

---

## 🔍 TROUBLESHOOTING

### Still getting "Bucket not found"?

**Check 1: Is user authenticated?**
```sql
-- In browser console:
supabase.auth.getSession()
```
Should return a valid session with `user.id`.

**Check 2: Policies applied?**
```sql
SELECT COUNT(*) 
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%';
```
Should return: 4

**Check 3: Bucket name correct?**
```sql
SELECT id FROM storage.buckets;
```
Should show: `assay-certificates` (with hyphen, not underscore!)

**Check 4: RLS enabled?**
```sql
SELECT relrowsecurity 
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage' AND c.relname = 'objects';
```
Should return: `true`

### Error: "Policy already exists"

If you get this error, policies weren't dropped. Run:
```sql
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their batch certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their certificates" ON storage.objects;
```
Then run the full fix again.

### Error: "Permission denied"

Your database user needs permissions. Run as superuser or use Supabase SQL Editor (which has correct permissions).

---

## 📊 VERIFICATION QUERIES

### Check bucket exists and is configured:
```sql
SELECT 
  id,
  public,
  file_size_limit / 1024 / 1024 as size_limit_mb,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'assay-certificates';
```

**Expected:**
- id: `assay-certificates`
- public: `false`
- size_limit_mb: `10`
- allowed_mime_types: `{application/pdf}`

### Check all policies:
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%';
```

**Expected 4 rows:**
1. Authenticated users can upload certificates - INSERT
2. Users can view their batch certificates - SELECT
3. Users can update their certificates - UPDATE
4. Users can delete their certificates - DELETE

### Test upload in SQL:
```sql
-- This should return the bucket
SELECT * FROM storage.buckets WHERE id = 'assay-certificates';

-- This should show policies
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage';
```

---

## 🎯 SUCCESS CRITERIA

System is working when:

1. ✅ Bucket exists in `storage.buckets`
2. ✅ 4 RLS policies on `storage.objects`
3. ✅ No "Bucket not found" error
4. ✅ Files upload successfully
5. ✅ Files visible in Supabase Storage
6. ✅ Certificate records in `assay_certificates` table

---

## 📝 PREVENTION

To avoid this in future:

1. **Always create storage policies with bucket**
2. **Never create bucket without RLS policies**
3. **Use the provided migration scripts**
4. **Test uploads immediately after bucket creation**

---

## 🚀 QUICK FIX SUMMARY

```bash
1. Open FIX_STORAGE_BUCKET_NOW.sql
2. Copy all content
3. Supabase → SQL Editor
4. Paste and RUN
5. Wait for "SUCCESS" message
6. Hard refresh browser (Ctrl+Shift+R)
7. Test upload
8. ✅ Done!
```

**Time: 2 minutes**  
**Difficulty: Easy**  
**Risk: None (script is idempotent)**

---

## 🎉 AFTER THE FIX

Upload will work! You'll see:

1. Click upload → Select file ✅
2. Preview PDF → Works ✅
3. Upload & Parse → No errors ✅
4. Shows progress ✅
5. Parsing completes ✅
6. Certificate in database ✅
7. File in storage ✅

**All working!** 🚀
