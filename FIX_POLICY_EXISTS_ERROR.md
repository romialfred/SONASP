# Fix "Must Be Owner" Error - Use Dashboard UI

## Problem
SQL script fails with: `ERROR: 42501: must be owner of table objects`

This means the SQL Editor user doesn't have permission to modify storage policies.

## ✅ Solution: Use Supabase Dashboard UI

Instead of SQL, configure policies through the UI (much easier!):

### Step 1: Navigate to Storage Policies

1. Open **Supabase Dashboard**
2. Go to **Storage** (left sidebar)
3. Click **Policies** tab at the top

### Step 2: Create Policy for SELECT (Read)

1. Click **"New Policy"**
2. Choose **"For full customization"**
3. Fill in:
   - **Policy name:** `Public read access`
   - **Allowed operation:** SELECT
   - **Target roles:** `public`
   - **USING expression:** 
     ```sql
     bucket_id IN ('documents', 'reports', 'payment-proofs')
     ```
4. Click **"Review"** → **"Save policy"**

### Step 3: Create Policy for INSERT (Upload)

1. Click **"New Policy"** again
2. Choose **"For full customization"**
3. Fill in:
   - **Policy name:** `Authenticated upload`
   - **Allowed operation:** INSERT
   - **Target roles:** `authenticated`
   - **WITH CHECK expression:**
     ```sql
     bucket_id IN ('documents', 'reports', 'payment-proofs')
     ```
4. Click **"Review"** → **"Save policy"**

### Step 3: Create Policy for UPDATE

1. Click **"New Policy"** again
2. Choose **"For full customization"**
3. Fill in:
   - **Policy name:** `Users can update files`
   - **Allowed operation:** UPDATE
   - **Target roles:** `authenticated`
   - **USING expression:**
     ```sql
     bucket_id IN ('documents', 'reports', 'payment-proofs')
     ```
   - **WITH CHECK expression:**
     ```sql
     bucket_id IN ('documents', 'reports', 'payment-proofs')
     ```
4. Click **"Review"** → **"Save policy"**

### Step 4: Create Policy for DELETE

1. Click **"New Policy"** again
2. Choose **"For full customization"**
3. Fill in:
   - **Policy name:** `Users can delete files`
   - **Allowed operation:** DELETE
   - **Target roles:** `authenticated`
   - **USING expression:**
     ```sql
     bucket_id IN ('documents', 'reports', 'payment-proofs')
     ```
4. Click **"Review"** → **"Save policy"**

### Step 5: Verify Setup

You should now see 4 policies listed:
- ✅ Public read access (SELECT)
- ✅ Authenticated upload (INSERT)
- ✅ Users can update files (UPDATE)
- ✅ Users can delete files (DELETE)

### Step 6: Test Upload

1. Go back to your app
2. Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R`)
3. Navigate to Batch Management → Create New Batch
4. Try uploading a document
5. Should work now! ✅

## Alternative: Code Fix (Already Done)

I've already updated the code to:
- Skip the bucket existence check (which was failing)
- Try upload directly
- Show better error messages

So after creating the policies above, the upload should work!

## Summary

| Step | Action | Status |
|------|--------|--------|
| 1 | Buckets created | ✅ Done |
| 2 | Policies via UI | ⚠️ Need to do |
| 3 | Code updated | ✅ Done |
| 4 | Build successful | ✅ Done |

## Next Action

👉 **Create the 4 policies** using Supabase Dashboard UI (steps above)

Time needed: 5 minutes

---

**Why UI instead of SQL?**
- The SQL Editor doesn't have `GRANT` permissions on storage tables
- Only Supabase admins/owners can modify storage via SQL
- The Dashboard UI has proper permissions built-in
- Much easier and more visual!
