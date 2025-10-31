# Assay Certificate Ingestion - Quick Start Guide

## Setup (One-Time)

### 1. Apply Database Migration

Run this SQL in your Supabase SQL Editor:

```bash
# Navigate to Supabase Dashboard → SQL Editor → New Query
# Copy and paste the contents of:
supabase/migrations/20251104000000_create_assay_certificates_system.sql

# Click "Run" or press Ctrl+Enter
```

This creates:
- ✅ 3 database tables
- ✅ Storage bucket for PDFs
- ✅ RLS policies
- ✅ Helper functions

### 2. Verify Storage Bucket

Go to Supabase Dashboard → Storage → Check for `assay-certificates` bucket

If not created automatically, create it manually:
- Name: `assay-certificates`
- Public: ❌ (Private)
- File size limit: 10 MB
- Allowed MIME types: `application/pdf`

## Using the Feature

### For Users

#### Upload a Certificate

1. **Navigate to Batch**
   - Go to Batches → Select any batch
   - Scroll to "Assay Certificates" section

2. **Upload PDF**
   - Drag and drop PDF file
   - OR click the upload area to browse
   - File must be PDF, max 10MB

3. **Wait for Parsing**
   - System automatically parses the PDF
   - Displays confidence score
   - Shows parsing status

#### View & Review Certificate

1. **Click "View" button** on any certificate

2. **Review Parsed Data**
   - Certificate number
   - Laboratory name
   - Gold/silver content
   - Purity percentages
   - Deleterious elements

3. **Edit if Needed**
   - Click "Edit Data"
   - Modify any field
   - Click "Save Changes"

4. **Approve or Reject**
   - Click "Approve Data" to accept
   - Click "Reject" to decline (provide reason)

#### View PDF

- Click "View PDF" button
- PDF displays inline
- Click "Download" to save locally

### For Developers

#### Import Components

```typescript
import { AssayCertificateUpload } from '@/components/batch/AssayCertificateUpload';
import { AssayCertificatesList } from '@/components/batch/AssayCertificatesList';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
```

#### Basic Usage

```typescript
// Upload component
<AssayCertificateUpload
  batchId={batchId}
  onUploadComplete={(certificate) => {
    console.log('Uploaded:', certificate);
    refreshList();
  }}
  onParseComplete={(certificateId) => {
    console.log('Parsed:', certificateId);
  }}
/>

// List component
<AssayCertificatesList
  batchId={batchId}
  onViewCertificate={(certificate) => {
    setSelected(certificate);
  }}
  refreshTrigger={refreshCount}
/>

// Viewer in modal
<Modal isOpen={!!selected} onClose={() => setSelected(null)}>
  <AssayCertificateViewer
    certificate={selected!}
    onApprove={() => {
      alert('Approved!');
      setSelected(null);
    }}
    onReject={() => {
      alert('Rejected');
      setSelected(null);
    }}
  />
</Modal>
```

#### API Usage

```typescript
import {
  uploadAssayCertificate,
  parseCertificate,
  getBatchCertificates,
  getCertificateData,
  updateCertificateData,
  approveCertificateData,
  rejectCertificateData,
} from '@/services/assayCertificateService';

// Upload
const result = await uploadAssayCertificate(batchId, file, userId);

// Get all certificates
const { data } = await getBatchCertificates(batchId);

// Get parsed data
const { data } = await getCertificateData(certificateId);

// Update data
await updateCertificateData(dataId, { gold_content_gpt: 25.5 });

// Approve
await approveCertificateData(certificateId, userId, 'Looks good');
```

## Common Patterns

### Pattern 1: Simple Integration

Just add upload and list:

```typescript
function MyBatchPage({ batchId }) {
  const [refresh, setRefresh] = useState(0);

  return (
    <div>
      <AssayCertificateUpload
        batchId={batchId}
        onUploadComplete={() => setRefresh(r => r + 1)}
        onParseComplete={() => setRefresh(r => r + 1)}
      />

      <AssayCertificatesList
        batchId={batchId}
        refreshTrigger={refresh}
      />
    </div>
  );
}
```

### Pattern 2: With Viewer Modal

Add viewing capability:

```typescript
function MyBatchPage({ batchId }) {
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(null);

  return (
    <>
      <AssayCertificateUpload ... />

      <AssayCertificatesList
        batchId={batchId}
        onViewCertificate={setSelected}
        refreshTrigger={refresh}
      />

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <AssayCertificateViewer
            certificate={selected}
            onApprove={() => {
              setSelected(null);
              setRefresh(r => r + 1);
            }}
          />
        </Modal>
      )}
    </>
  );
}
```

### Pattern 3: Custom Upload Handler

Handle upload yourself:

```typescript
async function handleCustomUpload(file: File) {
  // Upload
  const uploadResult = await uploadAssayCertificate(
    batchId,
    file,
    user.id
  );

  if (!uploadResult.success) {
    alert('Upload failed');
    return;
  }

  // Parse
  const parseResult = await parseCertificate(
    uploadResult.data.id,
    file
  );

  if (parseResult.success) {
    console.log('Confidence:', parseResult.confidence);
    console.log('Data:', parseResult.data);
  }
}
```

## Parsing Examples

### Example 1: Standard Gold Certificate

**Input PDF Text:**
```
ASSAY CERTIFICATE
Certificate No: LAB-2024-001
Date: 2024-11-04
Laboratory: ABC Gold Assay Lab
Sample ID: SMPL-123
Weight: 500 g
Gold: 25.5 g/t
Silver: 10.2 g/t
Fineness: 995
```

**Parsed Output:**
```json
{
  "certificate_number": "LAB-2024-001",
  "certificate_date": "2024-11-04",
  "laboratory_name": "ABC Gold Assay Lab",
  "sample_id": "SMPL-123",
  "sample_weight_g": 500,
  "gold_content_gpt": 25.5,
  "silver_content_gpt": 10.2,
  "fineness": 995,
  "extraction_confidence": 0.8
}
```

### Example 2: Certificate with Deleterious Elements

**Input PDF Text:**
```
Gold: 18.3 g/t
Silver: 5.2 g/t
Arsenic: 0.5 ppm
Mercury: 0.3 ppm
Lead: 1.2 ppm
Copper: 2.5%
```

**Parsed Output:**
```json
{
  "gold_content_gpt": 18.3,
  "silver_content_gpt": 5.2,
  "deleterious_elements": {
    "arsenic": 0.5,
    "mercury": 0.3,
    "lead": 1.2
  },
  "copper_percentage": 2.5
}
```

## Troubleshooting

### Issue: Upload fails with "File too large"

**Solution:** File must be under 10MB. Compress or split PDF.

### Issue: Parsing returns low confidence score

**Causes:**
- PDF is scanned image (no text layer)
- Non-standard format
- Poor quality scan

**Solutions:**
1. Use text-based PDFs (not scanned images)
2. Manually edit parsed data
3. Request certificate in standard format

### Issue: No data extracted

**Causes:**
- PDF has no readable text
- Format not recognized
- Encoding issues

**Solutions:**
1. Check if PDF has selectable text
2. Manually enter data
3. Contact lab for text-based certificate

### Issue: Storage bucket not found

**Solution:** Create bucket manually:
```
1. Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name: assay-certificates
4. Public: NO (private)
5. Allowed MIME types: application/pdf
6. File size limit: 10485760 (10MB)
```

### Issue: Permission denied error

**Cause:** RLS policies not applied

**Solution:** Re-run migration SQL

## Testing Checklist

- [ ] Upload valid PDF (< 10MB)
- [ ] Upload invalid file type (should reject)
- [ ] Upload oversized file (should reject)
- [ ] View uploaded certificate
- [ ] Check parsing status
- [ ] Review parsed data
- [ ] Edit parsed data
- [ ] Save changes
- [ ] Approve certificate
- [ ] Reject certificate (with notes)
- [ ] Delete certificate
- [ ] Download PDF
- [ ] View PDF inline

## Support

### Check Logs

In browser console:
```javascript
// Check for errors
console.log('Certificate upload errors');

// Check storage
await supabase.storage.from('assay-certificates').list()
```

### Database Queries

```sql
-- Check certificates
SELECT * FROM assay_certificates;

-- Check parsed data
SELECT * FROM assay_certificate_data;

-- Check approvals
SELECT * FROM certificate_approvals;

-- Check storage
SELECT * FROM storage.objects
WHERE bucket_id = 'assay-certificates';
```

## Next Steps

1. ✅ Apply migration
2. ✅ Test upload
3. ✅ Test parsing
4. ✅ Review workflow
5. 🔄 Train team
6. 🔄 Document standards
7. 🔄 Monitor usage

---

**Status**: ✅ Feature Ready for Use
**Last Updated**: November 4, 2025
