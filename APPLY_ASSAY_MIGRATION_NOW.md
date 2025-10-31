# 🚨 URGENT: Apply Database Migration to Enable Assay Certificates

## Current Status

**❌ Upload feature is NOT WORKING** because the database tables don't exist yet!

You need to apply the migration to create the required tables.

---

## Quick Fix (5 Minutes)

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com
2. Sign in to your account
3. Select your project
4. Click **"SQL Editor"** in left sidebar

### Step 2: Get Migration SQL

Open this file in your project:
```
supabase/migrations/20251104000000_create_assay_certificates_system.sql
```

Copy the ENTIRE contents (it's a long file)

### Step 3: Run Migration

1. In Supabase SQL Editor, click **"+ New query"**
2. Paste the entire migration SQL
3. Click **"Run"** button (or press Ctrl+Enter)
4. Wait for **"Success"** message

### Step 4: Verify

Check that 3 new tables were created:

1. In Supabase, click **"Table Editor"**
2. Look for these tables:
   - ✅ `assay_certificates`
   - ✅ `assay_base_metals`
   - ✅ `assay_deleterious_elements`

### Step 5: Refresh App

1. Go back to your Gold Shipper app
2. Press **F5** to refresh
3. Go to any batch details page
4. Scroll down on LEFT column
5. **Assay Certificates section should now appear!** ✅

---

## What This Migration Creates

### Database Tables

1. **assay_certificates** - Main table for certificates
   - Stores PDF file info
   - Tracks parsing status
   - Contains all extracted data
   - Approval workflow fields

2. **assay_base_metals** - Base metals analysis
   - Copper, iron, zinc, etc.
   - Linked to certificates

3. **assay_deleterious_elements** - Harmful elements
   - Arsenic, mercury, lead, etc.
   - Safety tracking

### Security

- Row Level Security (RLS) enabled on all tables
- Only authenticated users can access
- Users can only see their company's data

### Storage

- Storage bucket for PDF files
- Secure file upload policies
- 10MB file size limit

---

## After Migration Success

You'll be able to:

✅ Upload PDF certificates from batch details
✅ Auto-parse certificate data
✅ View certificates in PDF viewer
✅ Edit parsed data if needed
✅ Approve/reject certificates
✅ See all certificates on dedicated page
✅ Search and filter certificates

---

## Troubleshooting

### "Error running migration"

**Check:**
- Are you in the correct Supabase project?
- Do tables already exist? (shouldn't, but check)
- Any syntax errors in SQL?

**Solution:**
- Copy SQL again carefully
- Make sure entire file is copied
- Try running smaller sections if it fails

### "Tables created but upload doesn't work"

**Check:**
- Hard refresh browser (Ctrl+Shift+R)
- Clear browser cache
- Check browser console (F12) for errors

**Solution:**
- Make sure storage bucket was created
- Verify RLS policies are active
- Check user is authenticated

### "Upload works but parsing fails"

**Check:**
- Is PDF readable (not scanned image)?
- Is file size <10MB?
- Check `parsing_error` column in database

**Solution:**
- Try with sample PDF first: `public/sample-assay-certificate.pdf`
- Check that PDF has text layer
- Review error message in database

---

## Verification SQL

After applying migration, run this to verify:

```sql
-- Check if main table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'assay_certificates'
) as migration_applied;

-- Check all 3 tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'assay_%'
ORDER BY table_name;

-- Expected output:
-- assay_base_metals
-- assay_certificates
-- assay_deleterious_elements
```

---

## Quick Checklist

Before applying migration:
- [ ] Supabase dashboard open
- [ ] SQL Editor ready
- [ ] Migration file content copied
- [ ] Correct project selected

After applying migration:
- [ ] Success message received
- [ ] 3 tables created
- [ ] Browser refreshed
- [ ] Batch details page checked
- [ ] Upload section visible

---

## Why This Happened

The Assay Certificates feature was added to the codebase, but the database schema changes weren't applied yet. This is normal for new features - the code is ready, but database needs to be updated.

Think of it like:
- ✅ Frontend code = Ready (upload button, UI components)
- ✅ Backend code = Ready (parsing, storage logic)
- ❌ Database = Not ready (tables don't exist yet)

Once you apply the migration:
- ✅ Database = Ready (tables created)
- ✅ Everything works! 🎉

---

## Still Need Help?

1. **Take a screenshot** of any error message
2. **Check** the browser console (F12 → Console tab)
3. **Verify** you're in the correct Supabase project
4. **Try** the sample PDF first to test

---

## Summary

**Problem:** Upload button doesn't appear or doesn't work
**Cause:** Database tables don't exist yet
**Solution:** Apply migration SQL in Supabase Dashboard
**Time Required:** 2-5 minutes
**Difficulty:** Easy (copy & paste SQL)

**Migration File Location:**
```
supabase/migrations/20251104000000_create_assay_certificates_system.sql
```

**After Migration:** Feature works immediately! ✅

---

**Need the migration SQL?** It's in your project at the file path above. Just copy everything and run it in Supabase SQL Editor.
