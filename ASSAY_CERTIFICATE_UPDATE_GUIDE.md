# How to Update Assay Certificates

## Overview

There are three main types of updates you can perform on assay certificates:
1. **Update Parsed Data** (most common) - Edit extracted values
2. **Re-upload Certificate** - Replace the PDF file
3. **Update Certificate Metadata** - Change certificate info

---

## Method 1: Update Parsed Data ⭐ (Recommended)

### When to Use
- Fix incorrect parsing results
- Add missing data
- Correct values before approval

### Steps

#### Via Assay Certificates Page
1. **Navigate to Certificate**
   - Sidebar → Batch Management → **Assay Certificates**
   - Find the certificate you want to update
   - Click **"View"** button

2. **Enter Edit Mode**
   - In the certificate viewer modal, click **"Edit Data"** button
   - All fields become editable

3. **Modify Fields**
   You can update:
   - Certificate Number
   - Laboratory Name
   - Gold Content (g/t)
   - Gold Purity (%)
   - Silver Content (g/t)
   - Fineness
   - Sample Weight (g)
   - And more...

4. **Save Changes**
   - Click **"Save Changes"** button
   - System updates the database
   - Success message appears

5. **Cancel If Needed**
   - Click **"Cancel"** to discard changes
   - Original values are restored

#### Via Batch Details Page
1. **Navigate to Batch**
   - Sidebar → Batch Management → **Batches**
   - Select the batch with the certificate
   - Scroll to **"Assay Certificates"** section

2. **View Certificate**
   - Click **"View"** on the certificate

3. **Follow steps 2-5** from above

### Example: Update Gold Content

```typescript
// Original parsed value
Gold Content: 15.5 g/t

// Click "Edit Data"
// Change to: 18.3 g/t
// Click "Save Changes"

// Updated value saved
Gold Content: 18.3 g/t ✓
```

### Fields You Can Update

| Field | Type | Description |
|-------|------|-------------|
| Certificate Number | Text | Certificate ID |
| Laboratory Name | Text | Issuing lab |
| Certificate Date | Date | Issue date |
| Sample Weight | Number | Weight in grams |
| Gold Content (g/t) | Number | Gold per tonne |
| Gold Content (ppm) | Number | Gold parts per million |
| Gold Purity (%) | Number | Purity percentage |
| Silver Content (g/t) | Number | Silver per tonne |
| Silver Purity (%) | Number | Silver purity |
| Fineness | Number | Metal fineness |
| Copper (%) | Number | Copper percentage |
| Iron (%) | Number | Iron percentage |
| Deleterious Elements | JSON | Harmful elements |

---

## Method 2: Re-upload Certificate (Replace PDF)

### When to Use
- Wrong PDF was uploaded
- Need to upload updated version
- Original scan is poor quality

### Steps

1. **Delete Old Certificate**
   - Navigate to the certificate (via Assay Certificates page or Batch Details)
   - Click the **trash icon** (delete button)
   - Confirm deletion

2. **Upload New Certificate**
   - Go to the batch details page
   - Scroll to "Assay Certificates" section
   - Use the upload component
   - Drag & drop or browse for new PDF
   - Click **"Upload & Parse Certificate"**

3. **Review New Data**
   - System auto-parses the new PDF
   - Review extracted data
   - Edit if needed
   - Approve when ready

### ⚠️ Important Notes
- Deleting removes ALL data (PDF + parsed data)
- Certificate history is lost
- Upload creates a new certificate record
- New parsing may have different results

---

## Method 3: Programmatic Update (API)

### For Developers

#### Update Certificate Data

```typescript
import { updateCertificateData } from '@/services/assayCertificateService';

// Update parsed data
const result = await updateCertificateData(
  dataId,  // ID from assay_certificate_data table
  {
    gold_content_gpt: 18.3,
    gold_purity_percentage: 92.5,
    fineness: 995,
    // ... other fields
  }
);

if (result.success) {
  console.log('Updated:', result.data);
}
```

#### Update Certificate Metadata

```typescript
import { supabase } from '@/lib/supabase';

// Update certificate info
const { data, error } = await supabase
  .from('assay_certificates')
  .update({
    certificate_number: 'LAB-2024-001',
    issuing_laboratory: 'ABC Gold Assay Lab',
    certificate_date: '2024-11-04'
  })
  .eq('id', certificateId);
```

#### Update Approval Status

```typescript
import {
  approveCertificateData,
  rejectCertificateData
} from '@/services/assayCertificateService';

// Approve certificate
await approveCertificateData(
  certificateId,
  userId,
  'Data verified and accurate'
);

// Reject certificate
await rejectCertificateData(
  certificateId,
  userId,
  'Values do not match laboratory report'
);
```

---

## Common Update Scenarios

### Scenario 1: Fix Parsing Error

**Problem**: Parser extracted wrong gold content

**Solution**:
1. View certificate
2. Click "Edit Data"
3. Correct the gold_content_gpt field
4. Save changes
5. Approve certificate

### Scenario 2: Add Missing Data

**Problem**: Parser didn't extract fineness

**Solution**:
1. View certificate
2. Click "Edit Data"
3. Look at PDF (click "View PDF")
4. Enter fineness value manually
5. Save changes

### Scenario 3: Update After Lab Correction

**Problem**: Lab issued corrected certificate

**Solution**:
1. Delete old certificate
2. Upload new PDF
3. Review new parsed data
4. Approve

### Scenario 4: Batch Update Multiple Certificates

**Problem**: Need to update laboratory name for all certificates

**Solution** (SQL):
```sql
-- Update laboratory name for specific batch
UPDATE assay_certificate_data
SET laboratory_name = 'New Laboratory Name'
WHERE batch_id = 'batch-uuid-here';
```

---

## Update Workflow

```
┌─────────────────┐
│ Upload PDF      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auto Parse      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review Data     │ ◄─── You can edit here
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Edit if needed  │ ◄─── Click "Edit Data"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Save Changes    │ ◄─── Click "Save Changes"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Approve/Reject  │
└─────────────────┘
```

---

## Database Schema

### Tables Involved in Updates

#### `assay_certificates`
Stores PDF file metadata (rarely updated)

```sql
-- Update certificate metadata
UPDATE assay_certificates
SET
  certificate_number = 'NEW-NUMBER',
  issuing_laboratory = 'New Lab',
  certificate_date = '2024-11-04'
WHERE id = 'certificate-id';
```

#### `assay_certificate_data`
Stores parsed data (frequently updated)

```sql
-- Update parsed data
UPDATE assay_certificate_data
SET
  gold_content_gpt = 18.3,
  gold_purity_percentage = 92.5,
  fineness = 995,
  is_verified = true
WHERE certificate_id = 'certificate-id';
```

#### `certificate_approvals`
Tracks approval history (append-only)

```sql
-- Add approval record
INSERT INTO certificate_approvals (
  certificate_id,
  action,
  reviewed_by,
  review_notes
) VALUES (
  'certificate-id',
  'approved',
  'user-id',
  'Data verified and accurate'
);
```

---

## Permissions & Security

### Who Can Update?

**Parsed Data**:
- ✅ Authenticated users (with edit button visible)
- ✅ Certificate uploader
- ✅ Users with batch view permissions

**Approval Status**:
- ✅ Management users
- ✅ Authorized reviewers
- ❌ Read-only users

**Delete Certificates**:
- ✅ Certificate uploader
- ✅ Management users
- ❌ Other users

### Row Level Security

All updates respect RLS policies:
```sql
-- Users can update data they have access to
CREATE POLICY "Authenticated users can update certificate data"
  ON assay_certificate_data FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

---

## Best Practices

### ✅ Do's

1. **Review Before Approving**
   - Always compare parsed data with PDF
   - Verify critical fields (gold content, fineness)
   - Check confidence score

2. **Edit Incrementally**
   - Update one section at a time
   - Save changes frequently
   - Don't lose work

3. **Document Changes**
   - Add notes in approval comments
   - Track what was changed
   - Explain corrections

4. **Verify After Update**
   - Reload certificate viewer
   - Confirm changes saved
   - Check calculations

### ❌ Don'ts

1. **Don't Delete Without Backup**
   - Certificate deletion is permanent
   - Download PDF before deleting
   - Consider editing instead

2. **Don't Skip Validation**
   - Always verify values make sense
   - Check units (g/t vs ppm)
   - Confirm calculations

3. **Don't Update Without Reviewing**
   - Look at original PDF
   - Verify source data
   - Double-check numbers

4. **Don't Approve Low Confidence**
   - Confidence < 50% needs review
   - Manual verification required
   - Check all extracted fields

---

## Troubleshooting

### Issue: "Edit Data" button not visible

**Cause**: Certificate already approved or you lack permissions

**Solution**:
- Check approval status (must be "pending")
- Verify user permissions
- Contact administrator if needed

### Issue: Changes not saving

**Cause**: Network error, validation error, or permission issue

**Solution**:
1. Check browser console for errors
2. Verify all required fields filled
3. Check network connection
4. Refresh page and try again

### Issue: Cannot delete certificate

**Cause**: Permission denied or certificate in use

**Solution**:
- Verify you're the uploader or admin
- Check if certificate is approved
- Contact administrator

### Issue: PDF not updating after edit

**Cause**: PDF file cannot be edited, only data

**Solution**:
- To change PDF: Delete and re-upload
- To change data: Use edit mode
- PDF remains unchanged when editing data

---

## Quick Reference

| Task | Method | Steps |
|------|--------|-------|
| Fix wrong value | Edit Data | View → Edit → Modify → Save |
| Add missing data | Edit Data | View → Edit → Add → Save |
| Replace PDF | Re-upload | Delete old → Upload new |
| Change approval | Approve/Reject | View → Approve/Reject button |
| Bulk update | SQL Query | Run UPDATE query in Supabase |
| Add notes | Approval | Reject with notes OR Approve with notes |

---

## Support

**Need Help?**
- Check console for error messages
- Review parsing confidence score
- Verify field formats and units
- Contact system administrator

**Documentation:**
- `ASSAY_CERTIFICATE_INGESTION_FEATURE.md` - Full feature docs
- `ASSAY_CERTIFICATE_QUICK_START.md` - Getting started
- API documentation in service files

---

**Last Updated**: November 4, 2025
**Version**: 1.0.0
