# Batch Creation Troubleshooting Guide

## Problem: "Storage bucket could not be created" Error

### Symptoms
When trying to upload documents during batch creation, you see this error:
```
Upload Failed
Storage bucket "documents" does not exist. Please contact your administrator
to create the "documents" bucket in Supabase Storage before uploading files.
```

### Root Cause
The Supabase Storage bucket named "documents" has not been created yet. This bucket is required for storing batch-related documents like permits, certificates, and photos.

### Solution 1: Create Bucket via SQL (RECOMMENDED)

**Execute this SQL in Supabase SQL Editor:**

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `CREATE_DOCUMENTS_BUCKET.sql`
5. Click **Run**
6. Verify success message: "✅ SUCCESS: Storage bucket 'documents' created successfully!"

### Solution 2: Create Bucket via Supabase Dashboard

**Manual steps:**

1. Open your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket** button
4. Fill in the details:
   - **Name:** `documents`
   - **Public bucket:** ✓ (checked)
   - **File size limit:** `10485760` (10MB)
   - **Allowed MIME types:**
     - `application/pdf`
     - `image/jpeg`
     - `image/png`
     - `image/jpg`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
5. Click **Create bucket**

### Solution 3: Create Batch Without Documents

**Workaround if you can't create the bucket immediately:**

1. Create your batch WITHOUT uploading any documents
2. Documents are **optional** - you can skip the upload section
3. Fill in all required fields:
   - Shipping Date
   - Metal Type
   - Mining Company
   - Weight (in grams or ounces)
   - Mine to Airport Transport
   - Airport to Refinery Transport
   - Destination Refinery
4. Click **Create Batch**
5. Documents can be added later once the bucket is set up

## Verification Steps

After creating the bucket, verify it works:

### 1. Check Bucket Exists
```sql
SELECT id, name, public, file_size_limit, created_at
FROM storage.buckets
WHERE id = 'documents';
```

Expected: 1 row returned

### 2. Check RLS Policies
```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%batch documents%';
```

Expected: 4 policies returned

### 3. Test Upload
1. Go to **Batches → Create New Batch**
2. Fill in required fields
3. Try to upload a test PDF or image
4. Should see: "✅ File Uploaded - [filename] uploaded successfully"

## Required Files

- `CREATE_DOCUMENTS_BUCKET.sql` - SQL script to create the bucket and policies
- `CREATE_STORAGE_BUCKET.sql` - Alternative documentation file

## Security Configuration

The bucket is configured with these security rules:

✅ **Authenticated users can:**
- Upload files to `documents/batch-documents/` folder
- View/download all files in the bucket
- Delete files they uploaded

✅ **Public users can:**
- View/download files (read-only access)

❌ **Anonymous users cannot:**
- Upload files
- Delete files

## File Restrictions

- **Maximum file size:** 10MB
- **Allowed file types:**
  - PDF documents (`.pdf`)
  - Images (`.jpg`, `.jpeg`, `.png`)
  - Word documents (`.doc`, `.docx`)

## Common Questions

### Q: Can I create a batch without uploading documents?
**A:** Yes! Documents are optional. You can skip the document upload section entirely.

### Q: Why can't the app create the bucket automatically?
**A:** Creating storage buckets requires admin-level permissions. The frontend app uses a restricted API key (`ANON_KEY`) for security reasons, which doesn't have permission to create buckets.

### Q: Do I need to create the bucket for each environment?
**A:** Yes. If you have separate Supabase projects for development, staging, and production, you need to create the bucket in each one.

### Q: What happens if I upload a file larger than 10MB?
**A:** You'll see an error: "File Too Large - [filename] exceeds the 10MB limit". The file will not be uploaded.

### Q: Can I upload multiple files at once?
**A:** Yes! You can select multiple files in the file picker, and they will all be uploaded sequentially.

## Technical Details

### Bucket Configuration
```javascript
{
  id: 'documents',
  name: 'documents',
  public: true,
  file_size_limit: 10485760, // 10MB
  allowed_mime_types: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
}
```

### File Storage Path
```
documents/
  └── batch-documents/
      ├── 1698765432000_abc123xyz.pdf
      ├── 1698765433000_def456uvw.jpg
      └── ...
```

### File Naming Convention
```javascript
const fileName = `${timestamp}_${randomString}.${fileExtension}`;
// Example: 1698765432000_k9f2j3h8g.pdf
```

## Support

If you continue to experience issues after creating the bucket:

1. Check browser console for detailed error messages
2. Verify you're logged in as an authenticated user
3. Ensure your Supabase project is active and not paused
4. Check that RLS policies were created correctly
5. Contact your system administrator or Supabase support

## Related Files

- `/src/pages/batches/BatchCreate.tsx` - Batch creation form
- `/src/services/batchCreationService.ts` - Batch creation logic
- `CREATE_DOCUMENTS_BUCKET.sql` - Bucket creation script
