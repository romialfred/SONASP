# ✅ ASSAY CERTIFICATES - FINAL DEPLOYMENT CHECKLIST

Complete this checklist to ensure the Assay Certificates feature is fully functional.

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Code Changes
- [x] BatchDetails.tsx - Hardcoded documents removed
- [x] assayCertificateService.ts - Fixed to use correct columns
- [x] AssayCertificateUpload.tsx - Component exists
- [x] AssayCertificatesList.tsx - Component exists
- [x] AssayCertificateViewer.tsx - Component exists
- [x] pdfParsingService.ts - PDF parsing implemented
- [x] Build successful - No TypeScript errors

### 2. Database Migrations
- [ ] Base migration applied (`APPLY_ASSAY_MIGRATION_NOW.sql`)
  - Creates 3 tables
  - Creates storage bucket
  - Sets up RLS policies
  - Creates helper functions
  
- [ ] Fix migration applied (`FIX_ASSAY_SCHEMA.sql`)
  - Adds 12 summary columns
  - Creates index on sample_id
  - Enables quick-access queries

### 3. Browser Cache
- [ ] Hard refresh performed (Ctrl+Shift+R)
- [ ] Service worker cleared
- [ ] Old cached JavaScript removed
- [ ] New bundle loaded

---

## 🔍 VERIFICATION STEPS

### Step 1: Database Verification

Run in Supabase SQL Editor:
```sql
-- Check column count
SELECT COUNT(*) as columns 
FROM information_schema.columns
WHERE table_name = 'assay_certificates';

-- Expected: 30 (if both migrations applied)
-- Expected: 18 (if only base migration applied)
```

**Result:** _____ columns

- [ ] ✅ 30 columns (Both migrations applied - PERFECT!)
- [ ] ⚠️ 18 columns (Need to apply FIX_ASSAY_SCHEMA.sql)
- [ ] ❌ 0 columns (Need to apply APPLY_ASSAY_MIGRATION_NOW.sql)

### Step 2: Storage Verification

```sql
SELECT name, public, file_size_limit 
FROM storage.buckets 
WHERE name = 'assay-certificates';
```

- [ ] ✅ Bucket exists
- [ ] ✅ public = false
- [ ] ✅ file_size_limit = 10485760 (10MB)

### Step 3: RLS Policies Verification

```sql
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE '%assay%';
```

**Result:** _____ policies

- [ ] ✅ 7+ policies exist

### Step 4: Storage Policies Verification

```sql
SELECT COUNT(*) as storage_policy_count
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%';
```

**Result:** _____ storage policies

- [ ] ✅ 4 policies exist (INSERT, SELECT, UPDATE, DELETE)

---

## 🧪 FUNCTIONAL TESTING

### Test 1: UI Visibility

**Action:** Navigate to any Batch Details page

**Expected Results:**
- [ ] "Assay Certificates" section visible in left column
- [ ] "Upload Assay Certificate" heading present
- [ ] Drop zone with "Drop PDF here" message
- [ ] Info box with supported formats
- [ ] "No certificates uploaded yet" message (if none exist)

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

### Test 2: File Selection

**Action:** Click on upload area

**Expected Results:**
- [ ] File dialog opens
- [ ] Only PDF files selectable
- [ ] Selected filename displays
- [ ] "Upload & Parse Certificate" button appears

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

### Test 3: File Upload

**Action:** Select a PDF and click "Upload & Parse Certificate"

**Expected Results:**
- [ ] Progress indicator appears
- [ ] "Certificate uploaded successfully!" message
- [ ] "Parsing certificate..." message
- [ ] Upload completes in 2-10 seconds
- [ ] No console errors

**Status:** ✅ Pass / ❌ Fail

**Console Errors:** _________________________________

### Test 4: Database Verification After Upload

**Action:** Run in Supabase SQL Editor after upload

```sql
SELECT 
  file_name,
  parsing_status,
  approval_status,
  created_at
FROM assay_certificates
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- [ ] Record exists
- [ ] parsing_status = 'processing' or 'completed'
- [ ] approval_status = 'pending'
- [ ] file_name matches uploaded file

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

### Test 5: Storage Verification

**Action:** Check Supabase Dashboard → Storage → assay-certificates

**Expected Results:**
- [ ] Uploaded PDF visible in bucket
- [ ] File organized by batch_id
- [ ] File is viewable/downloadable

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

### Test 6: Parsing Results

**Action:** Wait 5-10 seconds, refresh page

**Expected Results:**
- [ ] Certificate appears in list
- [ ] Parsing status badge shows status
- [ ] Approval status badge shows "Pending"
- [ ] "View" button is clickable

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

### Test 7: View Certificate

**Action:** Click "View" button

**Expected Results:**
- [ ] Modal opens
- [ ] Certificate filename in title
- [ ] PDF metadata visible
- [ ] Parsed data fields shown (if parsing succeeded)
- [ ] Approve/Reject buttons visible
- [ ] Close button works

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

### Test 8: Multiple Uploads

**Action:** Upload 2-3 more certificates

**Expected Results:**
- [ ] All certificates appear in list
- [ ] Each has unique ID
- [ ] Each has correct batch_id
- [ ] List updates in real-time
- [ ] No duplicate entries

**Status:** ✅ Pass / ❌ Fail

**Notes:** _________________________________

---

## 🐛 ERROR TESTING

### Error Test 1: Wrong File Type

**Action:** Try to upload .jpg or .docx

**Expected Results:**
- [ ] File type restriction works
- [ ] Only PDF files can be selected
- [ ] Clear error message if wrong type

**Status:** ✅ Pass / ❌ Fail

### Error Test 2: File Too Large

**Action:** Try to upload PDF > 10MB

**Expected Results:**
- [ ] Upload fails with clear message
- [ ] "File too large" error shown
- [ ] No partial upload

**Status:** ✅ Pass / ❌ Fail

### Error Test 3: No Internet Connection

**Action:** Disconnect internet, try upload

**Expected Results:**
- [ ] Clear error message
- [ ] No silent failure
- [ ] Can retry after reconnection

**Status:** ✅ Pass / ❌ Fail

---

## 🔐 SECURITY TESTING

### Security Test 1: Unauthenticated Access

**Action:** Logout, try to access batch details

**Expected Results:**
- [ ] Redirected to login
- [ ] No data visible
- [ ] No API calls succeed

**Status:** ✅ Pass / ❌ Fail

### Security Test 2: Cross-Batch Access

**Action:** Try to upload certificate with wrong batch_id

**Expected Results:**
- [ ] Upload should fail or
- [ ] RLS should prevent access

**Status:** ✅ Pass / ❌ Fail

### Security Test 3: Direct Storage Access

**Action:** Try to access storage URL directly without auth

**Expected Results:**
- [ ] Access denied
- [ ] 403 or 401 error
- [ ] No file download

**Status:** ✅ Pass / ❌ Fail

---

## 📊 PERFORMANCE TESTING

### Performance Test 1: Upload Speed

**Test with 1MB PDF:**
- Upload time: _____ seconds
- Expected: 2-5 seconds
- [ ] ✅ Within acceptable range

### Performance Test 2: Parsing Speed

**Test with simple certificate:**
- Parsing time: _____ seconds
- Expected: 2-10 seconds
- [ ] ✅ Within acceptable range

### Performance Test 3: List Loading

**Test with 10+ certificates:**
- List load time: _____ seconds
- Expected: < 2 seconds
- [ ] ✅ Within acceptable range

---

## 🎯 FINAL VERIFICATION

### Code Quality
- [x] No TypeScript errors
- [x] No ESLint warnings
- [x] Build successful
- [x] All imports correct

### Database
- [ ] All tables exist
- [ ] All columns exist (30 in assay_certificates)
- [ ] RLS enabled on all tables
- [ ] All policies active
- [ ] Storage bucket configured
- [ ] Helper functions created

### Frontend
- [ ] No console errors
- [ ] No React warnings
- [ ] UI renders correctly
- [ ] Responsive on mobile
- [ ] All interactions work

### Integration
- [ ] Upload → Storage works
- [ ] Upload → Database works
- [ ] Parsing works
- [ ] List displays correctly
- [ ] View modal works
- [ ] Approval workflow ready

---

## 📝 DEPLOYMENT STATUS

### Overall Status

**Code:** ✅ Complete  
**Database:** [ ] Complete (Apply migrations)  
**Testing:** [ ] Complete (Run tests)  
**Documentation:** ✅ Complete  

### Remaining Actions

1. [ ] Apply `FIX_ASSAY_SCHEMA.sql` migration
2. [ ] Hard refresh browser (Ctrl+Shift+R)
3. [ ] Run all functional tests
4. [ ] Verify security
5. [ ] Test performance
6. [ ] Sign off as production-ready

---

## 🎉 SIGN OFF

**Tested By:** _________________________________  
**Date:** _________________________________  
**Status:** ✅ Ready for Production / ⚠️ Issues Found / ❌ Not Ready  

**Notes:**
_________________________________
_________________________________
_________________________________

---

## 🆘 TROUBLESHOOTING REFERENCE

If any test fails, refer to:
- `BATCH_DOCUMENT_UPLOAD_FIX.md` - Cache and visibility issues
- `CHECK_ASSAY_DATABASE.md` - Database verification queries
- `ASSAY_CERTIFICATE_TESTING_GUIDE.md` - Detailed testing scenarios
- `WHERE_TO_UPLOAD_CERTIFICATES.md` - Location and cache guide

