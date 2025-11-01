# 🧪 ASSAY CERTIFICATES - TESTING GUIDE

## ✅ PRE-FLIGHT CHECK

Before testing, ensure you've completed:

- [x] Applied `APPLY_ASSAY_MIGRATION_NOW.sql` ✅ (YOU DID THIS)
- [ ] Applied `FIX_ASSAY_SCHEMA.sql` ⚠️ (DO THIS NOW)
- [ ] Built project with `npm run build`
- [ ] Refreshed browser (F5)

---

## 🎯 TEST SCENARIO 1: Upload Certificate

### Steps:
1. Login to the application
2. Navigate to **Batches** page
3. Click on any existing batch
4. Scroll down to **"Assay Certificates"** section
5. Click the **upload area** or drag a PDF file

### Expected Results:
- ✅ File selection dialog appears
- ✅ PDF files are selectable
- ✅ Selected filename displays
- ✅ "Upload & Parse Certificate" button is enabled

### What to Check:
```javascript
// Open Browser Console (F12)
// You should NOT see these errors:
❌ "column does not exist"
❌ "permission denied"
❌ "bucket not found"
```

---

## 🎯 TEST SCENARIO 2: Upload Process

### Steps:
1. Select a PDF assay certificate
2. Click **"Upload & Parse Certificate"**
3. Wait for upload to complete

### Expected Results:
- ✅ Progress indicator appears
- ✅ "Certificate uploaded successfully!" message
- ✅ "Parsing certificate..." message appears
- ✅ Upload completes in 2-5 seconds

### Database Check:
```sql
-- Run in Supabase SQL Editor
SELECT 
  id,
  file_name,
  parsing_status,
  approval_status,
  created_at
FROM assay_certificates
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- parsing_status: 'processing' or 'completed'
-- approval_status: 'pending'
```

---

## 🎯 TEST SCENARIO 3: Parsing Results

### Steps:
1. Wait 5-10 seconds after upload
2. Check the certificates list

### Expected Results:
- ✅ Certificate appears in the list
- ✅ Shows parsing status badge
- ✅ Shows approval status badge
- ✅ "View" button is clickable

### Database Check:
```sql
-- Check parsed data was saved
SELECT 
  ac.file_name,
  ac.parsing_status,
  ac.gold_content_ppm,
  ac.silver_content_ppm,
  acd.id as has_detailed_data
FROM assay_certificates ac
LEFT JOIN assay_certificate_data acd ON ac.id = acd.certificate_id
ORDER BY ac.created_at DESC
LIMIT 1;

-- Expected:
-- parsing_status: 'completed'
-- gold_content_ppm: (number if detected)
-- has_detailed_data: (uuid if parsing succeeded)
```

---

## 🎯 TEST SCENARIO 4: View Certificate

### Steps:
1. Click **"View"** button on uploaded certificate
2. Modal should open

### Expected Results:
- ✅ Modal opens with certificate details
- ✅ PDF preview or metadata visible
- ✅ Parsed data fields shown
- ✅ Approve/Reject buttons visible

---

## 🎯 TEST SCENARIO 5: Storage Verification

### Check in Supabase Dashboard:

1. Go to **Storage** → **assay-certificates**
2. You should see uploaded PDF files
3. Click on a file to preview

### Expected:
- ✅ Bucket exists
- ✅ Files are organized by batch_id
- ✅ Files are viewable/downloadable

---

## ⚠️ COMMON ISSUES & SOLUTIONS

### Issue 1: "Upload Document" button does nothing

**Cause:** Old hardcoded section still present  
**Solution:** Already fixed - refresh browser (F5)

### Issue 2: "column does not exist" error

**Cause:** `FIX_ASSAY_SCHEMA.sql` not applied  
**Solution:** Apply the fix migration now

### Issue 3: Upload succeeds but parsing fails

**Possible Causes:**
- PDF is a scanned image (needs OCR)
- PDF is encrypted/password protected
- Text format doesn't match extraction patterns

**Check:**
```sql
SELECT 
  file_name,
  parsing_status,
  parsing_error
FROM assay_certificates
WHERE parsing_status = 'failed'
ORDER BY created_at DESC;
```

### Issue 4: "Permission denied" on upload

**Cause:** Storage policies not active  
**Solution:** Check Storage → assay-certificates → Policies

### Issue 5: No "Assay Certificates" section visible

**Cause:** Component not rendering  
**Check:** Browser console for React errors

---

## 📊 PERFORMANCE EXPECTATIONS

### Upload Time:
- Small PDF (< 1MB): 1-3 seconds
- Medium PDF (1-5MB): 3-8 seconds
- Large PDF (5-10MB): 8-15 seconds

### Parsing Time:
- Simple certificate: 2-5 seconds
- Complex certificate: 5-10 seconds
- Very complex: 10-20 seconds

---

## 🔍 DEBUGGING CHECKLIST

If something doesn't work:

### 1. Check Browser Console (F12 → Console):
```javascript
// Look for:
- Red error messages
- "404 Not Found" 
- "Permission denied"
- "Column does not exist"
```

### 2. Check Network Tab (F12 → Network):
```
// Filter: XHR
// Look for failed requests to:
- /rest/v1/assay_certificates
- /storage/v1/object/assay-certificates
```

### 3. Check Database:
```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'assay%';

-- Verify bucket exists
SELECT name FROM storage.buckets 
WHERE name = 'assay-certificates';

-- Verify policies exist
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'assay_certificates';
```

### 4. Check Storage Policies:
```
Supabase Dashboard → Storage → assay-certificates → Policies

Should have 4 policies:
- INSERT (authenticated)
- SELECT (authenticated)
- UPDATE (authenticated)
- DELETE (authenticated)
```

---

## 📝 TEST REPORT TEMPLATE

After testing, report results:

```
✅ PASSED / ❌ FAILED

Test Scenario 1: Upload Certificate
Status: [ ]
Notes: 

Test Scenario 2: Upload Process
Status: [ ]
Notes:

Test Scenario 3: Parsing Results
Status: [ ]
Notes:

Test Scenario 4: View Certificate
Status: [ ]
Notes:

Test Scenario 5: Storage Verification
Status: [ ]
Notes:

Browser: 
Console Errors: 
Database Status: 
Overall Status: 
```

---

## 🎉 SUCCESS CRITERIA

System is working correctly when:

1. ✅ PDF uploads without errors
2. ✅ Parsing completes (even if confidence is low)
3. ✅ Certificate appears in list
4. ✅ Data saved to both tables
5. ✅ View modal opens correctly
6. ✅ No console errors
7. ✅ Storage bucket contains files

