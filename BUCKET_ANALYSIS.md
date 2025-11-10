# 📊 SUPABASE STORAGE BUCKETS ANALYSIS

## Date: 2025-11-10

---

## ✅ EXISTING BUCKETS

Based on migration files analysis, the following storage buckets are configured:

### 1️⃣ **documents** ✅
- **File:** `20251101130000_create_storage_buckets.sql`
- **Purpose:** General documents, receipts, batch documents
- **Size Limit:** 52MB (52428800 bytes)
- **Mime Types:** PDF, JPEG, PNG, JPG, Excel, CSV
- **Policies:** ✅ Complete (SELECT, INSERT, UPDATE, DELETE)

### 2️⃣ **reports** ✅
- **File:** `20251101130000_create_storage_buckets.sql`
- **Purpose:** Generated report files (PDFs, Excel)
- **Size Limit:** 52MB
- **Mime Types:** PDF, Excel
- **Policies:** ✅ Partial (SELECT, INSERT only - no UPDATE/DELETE)

### 3️⃣ **payment-proofs** ✅
- **File:** `20251101130000_create_storage_buckets.sql`
- **Purpose:** Payment proof documents
- **Size Limit:** 52MB
- **Mime Types:** PDF, JPEG, PNG, JPG
- **Policies:** ✅ Complete (SELECT, INSERT, UPDATE)

### 4️⃣ **batch-documents** ✅
- **File:** `20251105000001_create_batch_documents_fixed.sql`
- **Purpose:** Batch lifecycle documents (shipping, refinery, sales, transport)
- **Size Limit:** Not specified (uses default)
- **Mime Types:** Not specified (uses default)
- **Policies:** ✅ Complete (SELECT, INSERT, UPDATE, DELETE)

### 5️⃣ **assay-certificates** ✅
- **File:** `20251104000000_create_assay_certificates_system.sql`
- **Purpose:** Assay certificate PDFs
- **Size Limit:** 10MB (10485760 bytes)
- **Mime Types:** PDF only
- **Policies:** ✅ Complete (SELECT, INSERT, UPDATE, DELETE)

### 6️⃣ **license-documents** ✅
- **File:** `20251109100000_add_license_documents_bucket.sql`
- **Purpose:** License request supporting documents
- **Size Limit:** 10MB
- **Mime Types:** PDF, JPEG, JPG, PNG
- **Policies:** ✅ Complete (SELECT, INSERT, UPDATE, DELETE)

---

## ❌ MISSING BUCKETS

### 7️⃣ **shipping-documents** ❌ MISSING!

**Evidence:**
- Table `shipping_documents` exists (created in `20251110142000_add_shipping_documents.sql`)
- Table stores: `document_url`, `file_name`, `file_size`, `mime_type`
- Component `DocumentUploadModal.tsx` exists for uploading
- Component `DynamicPackingList.tsx` likely needs document storage

**Required For:**
- Shipping preparation documents (packing lists, export certificates)
- Customs documents
- Transport documents
- Insurance certificates
- Commercial invoices

**Missing Configuration:**
- No storage bucket creation
- No storage policies
- Upload functionality won't work without bucket

---

## 🔍 DETAILED ISSUES FOUND

### Issue #1: Missing `shipping-documents` Bucket
**Severity:** 🔴 HIGH

**Impact:**
- Users cannot upload shipping documents
- `DocumentUploadModal` component will fail
- Shipping preparation workflow incomplete
- Customs/export documentation missing

**Evidence:**
```sql
-- Table exists but no bucket!
CREATE TABLE IF NOT EXISTS shipping_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL,
  title text NOT NULL,
  document_url text NOT NULL,  -- ⚠️ Where will this be stored?
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  ...
);
```

### Issue #2: Incomplete `reports` Bucket Policies
**Severity:** 🟡 MEDIUM

**Impact:**
- Users cannot update or delete generated reports
- Old/incorrect reports accumulate
- No cleanup mechanism

**Current:**
```sql
-- Only SELECT and INSERT policies exist
CREATE POLICY "Users can view reports" ON storage.objects FOR SELECT ...
CREATE POLICY "Authenticated users can upload reports" ON storage.objects FOR INSERT ...
-- ❌ Missing UPDATE policy
-- ❌ Missing DELETE policy
```

### Issue #3: No Size Limit on `batch-documents`
**Severity:** 🟡 MEDIUM

**Impact:**
- Users can upload very large files
- Storage costs may increase unexpectedly
- Performance issues possible

**Current:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('batch-documents', 'batch-documents', false)
-- ❌ No file_size_limit specified
-- ❌ No allowed_mime_types specified
```

---

## 📋 RECOMMENDATIONS

### Priority 1: Create `shipping-documents` Bucket ⭐⭐⭐

**Action Required:**
1. Create new migration file
2. Add bucket with appropriate limits
3. Add storage policies (SELECT, INSERT, UPDATE, DELETE)
4. Test upload functionality

**Suggested Configuration:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shipping-documents',
  'shipping-documents',
  false,
  20971520, -- 20MB limit (larger than others for customs forms)
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);
```

### Priority 2: Complete `reports` Bucket Policies ⭐⭐

**Action Required:**
1. Add UPDATE policy for management role
2. Add DELETE policy for management role
3. Test report regeneration workflow

### Priority 3: Add Limits to `batch-documents` Bucket ⭐

**Action Required:**
1. Update bucket configuration with size limit
2. Specify allowed mime types
3. Prevent abuse/oversized uploads

---

## 🎯 USAGE ANALYSIS

### Most Critical Buckets (By Usage)

1. **batch-documents** - Used throughout entire batch lifecycle
2. **shipping-documents** - ❌ MISSING but required for export workflow
3. **assay-certificates** - Critical for refinery operations
4. **license-documents** - Required for export licenses
5. **payment-proofs** - Required for payment processing
6. **documents** - General purpose fallback
7. **reports** - Generated files, less critical

### Bucket Size Recommendations

| Bucket | Current Limit | Recommended | Reason |
|--------|--------------|-------------|---------|
| documents | 52MB | 52MB ✅ | Good |
| reports | 52MB | 52MB ✅ | Good |
| payment-proofs | 52MB | 20MB ⚠️ | Too large for typical payment proofs |
| batch-documents | None | 20MB ⚠️ | Should have limit |
| assay-certificates | 10MB | 10MB ✅ | Good for PDFs |
| license-documents | 10MB | 10MB ✅ | Good |
| shipping-documents | N/A | 20MB ❌ | MISSING! |

---

## ✅ ACTION ITEMS SUMMARY

### Immediate Actions (This Week)

- [ ] **Create `shipping-documents` bucket** (CRITICAL)
  - Migration file
  - Storage policies
  - Test upload functionality

- [ ] **Add UPDATE/DELETE policies to `reports` bucket** (IMPORTANT)
  - Allow management to regenerate reports
  - Add cleanup capability

- [ ] **Add size limits to `batch-documents`** (RECOMMENDED)
  - Prevent abuse
  - Control storage costs

### Future Improvements

- [ ] Review payment-proofs size limit (52MB → 20MB)
- [ ] Add retention policies for old documents
- [ ] Implement automatic cleanup for temporary files
- [ ] Add virus scanning for uploads
- [ ] Monitor storage usage across buckets

---

## 🔐 SECURITY STATUS

### Overall Security: ✅ GOOD

**Strengths:**
- ✅ All buckets are private (public = false)
- ✅ RLS enabled on all tables
- ✅ Authentication required for all operations
- ✅ Mime type restrictions in place

**Weaknesses:**
- ⚠️ Some policies use `USING (true)` - very permissive
- ⚠️ No role-based restrictions on most buckets
- ⚠️ No file size validation in some buckets
- ⚠️ Missing bucket for shipping documents

---

## 📊 BUCKET CONFIGURATION TABLE

| Bucket Name | Status | Size Limit | RLS | Policies | Mime Types |
|-------------|--------|-----------|-----|----------|------------|
| documents | ✅ | 52MB | ✅ | 4/4 | 7 types |
| reports | ⚠️ | 52MB | ✅ | 2/4 | 2 types |
| payment-proofs | ✅ | 52MB | ✅ | 3/4 | 4 types |
| batch-documents | ⚠️ | None | ✅ | 4/4 | None |
| assay-certificates | ✅ | 10MB | ✅ | 4/4 | 1 type |
| license-documents | ✅ | 10MB | ✅ | 4/4 | 4 types |
| **shipping-documents** | ❌ | **N/A** | **N/A** | **0/4** | **N/A** |

---

## 🎯 CONCLUSION

**Overall Assessment:** ⚠️ **NEEDS ATTENTION**

**Summary:**
- 6 out of 7 required buckets are configured ✅
- 1 critical bucket is missing: `shipping-documents` ❌
- Some policies are incomplete ⚠️
- Size limits need review ⚠️

**Critical Issue:**
The `shipping-documents` bucket is MISSING but required for the shipping preparation workflow. This will cause upload failures and block the export process.

**Next Steps:**
1. Create migration for `shipping-documents` bucket (URGENT)
2. Complete `reports` bucket policies
3. Add size limits to `batch-documents`
4. Test all upload functionalities

---

**Generated:** 2025-11-10
**Version:** 1.0
