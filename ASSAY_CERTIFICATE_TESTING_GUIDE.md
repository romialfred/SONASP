# Assay Certificate Testing Guide

## Sample PDF Created

A realistic assay certificate PDF has been generated for testing purposes.

**Location**: `public/sample-assay-certificate.pdf`

**Size**: 8.8 KB

---

## Sample Certificate Details

### Certificate Information
- **Certificate Number**: AC-2024-11-001
- **Certificate Date**: November 4, 2024
- **Sample ID**: GN-2025-10-003
- **Laboratory**: ABC Gold Assay Laboratory
- **License**: LAB-2024-001
- **Standard**: ISO 17025 Accredited

### Client Information
- **Client Name**: Mansa Resources Ltd.
- **Batch Number**: GN-2025-10-003
- **Sample Weight**: 500.00 grams

### Assay Results

#### Primary Metals
| Element | Content (g/t) | Content (ppm) | Purity (%) |
|---------|---------------|---------------|------------|
| Gold (Au) | 18.35 | 18,350 | 92.50 |
| Silver (Ag) | 2.45 | 2,450 | 88.20 |

#### Additional Elements (Base Metals)
- **Copper (Cu)**: 0.15%
- **Iron (Fe)**: 0.08%
- **Zinc (Zn)**: 0.03%

#### Deleterious Elements
- **Arsenic (As)**: <0.001%
- **Mercury (Hg)**: <0.001%
- **Lead (Pb)**: <0.001%

### Fineness
- **Fineness**: 995.0 (parts per thousand)
- **Equivalent Karat**: 23.88K

### Analytical Method
- **Method**: Fire Assay with ICP-OES Finish
- **Standard**: ASTM E1335-18

---

## How to Test with Sample PDF

### Test 1: Basic Upload and Parsing

1. **Navigate to a Batch**
   ```
   Sidebar → Batch Management → Batches
   → Select any batch (e.g., GN-2025-10-003)
   ```

2. **Scroll to Assay Certificates Section**
   - Find "Assay Certificates" card
   - Should show "No certificates uploaded yet" message

3. **Upload Sample PDF**
   - Click "Browse files" or drag & drop
   - Select: `public/sample-assay-certificate.pdf`
   - Click "Upload & Parse Certificate"

4. **Wait for Parsing**
   - Progress indicator appears
   - Status changes: pending → processing → completed
   - Should take 5-10 seconds

5. **Verify Parsed Data**
   - Certificate should appear in list
   - Click "View" button
   - Check parsed values match sample data above

### Test 2: View and Review Certificate

1. **Open Certificate Viewer**
   - Click "View" on uploaded certificate
   - Modal opens with PDF preview

2. **Verify PDF Display**
   - PDF should render correctly
   - All text should be readable
   - "Download PDF" button works

3. **Check Parsed Data**
   - Scroll to "Parsed Assay Data" section
   - Verify fields extracted:
     - ✅ Certificate Number: AC-2024-11-001
     - ✅ Laboratory: ABC Gold Assay Laboratory
     - ✅ Gold Content: 18.35 g/t
     - ✅ Gold Purity: 92.50%
     - ✅ Silver Content: 2.45 g/t
     - ✅ Fineness: 995.0
     - ✅ Sample Weight: 500.00 g

4. **Check Confidence Scores**
   - Each field should have confidence score
   - Good parsing: >70% confidence
   - Excellent parsing: >90% confidence

### Test 3: Edit Parsed Data

1. **Click "Edit Data"** button

2. **Modify Values**
   - Change Gold Content: 18.35 → 20.00
   - Change Fineness: 995.0 → 999.0
   - Add notes in any text field

3. **Save Changes**
   - Click "Save Changes"
   - Success message appears
   - Values update immediately

4. **Verify Persistence**
   - Close modal
   - Re-open certificate
   - Verify changes saved

### Test 4: Approval Workflow

1. **Approve Certificate**
   - In certificate viewer, click "Approve"
   - Add approval notes: "Data verified and accurate"
   - Click "Approve Certificate"

2. **Verify Approval**
   - Status badge changes to "Approved" (green)
   - Approval details appear
   - "Edit Data" button becomes disabled

3. **Test Rejection** (optional)
   - Upload another certificate
   - Click "Reject" instead
   - Add rejection reason
   - Verify status changes to "Rejected" (red)

### Test 5: Multiple Certificates

1. **Upload Multiple PDFs**
   - Upload sample PDF again (will create duplicate)
   - Upload 2-3 more times
   - Each should get unique ID

2. **Verify List Display**
   - All certificates appear in batch list
   - Each has own status badge
   - Dates are correct

3. **Test Filtering** (on main page)
   - Go to: Assay Certificates page
   - Search by: "AC-2024"
   - Filter by status: "approved"
   - Verify results update

### Test 6: Navigation and Integration

1. **From Assay Certificates Page**
   - Sidebar → Assay Certificates
   - Find certificate in list
   - Click batch number
   - Should navigate to batch details

2. **From Batch Details**
   - Should see certificates section
   - All certificates for that batch visible
   - Actions available

3. **Verify Stats**
   - Check dashboard cards:
     - Total Certificates
     - Pending Approval
     - Approved
     - Rejected

### Test 7: Error Handling

1. **Upload Invalid File**
   - Try uploading .txt file → Should reject
   - Try uploading image → Should reject
   - Only PDF should work

2. **Upload Large File**
   - Try file >10MB → Should reject
   - Error message should appear

3. **Test Network Error**
   - Disconnect internet (if possible)
   - Try upload → Should show error
   - Reconnect → Should work again

---

## Expected Parsing Results

When the sample PDF is parsed, you should see:

### ✅ High Confidence Fields (>90%)
- Certificate Number: AC-2024-11-001
- Laboratory Name: ABC Gold Assay Laboratory
- Sample Weight: 500.00
- Gold Content (g/t): 18.35
- Gold Purity: 92.50
- Silver Content (g/t): 2.45
- Fineness: 995.0

### ⚠️ Medium Confidence Fields (70-90%)
- Certificate Date: 2024-11-04
- Sample ID: GN-2025-10-003
- Base metals (Cu, Fe, Zn)

### ❓ Manual Review Fields (<70%)
- Deleterious elements (may need verification)
- Complex chemical formulas

---

## Performance Benchmarks

| Operation | Expected Time |
|-----------|--------------|
| Upload 1MB PDF | 1-2 seconds |
| Parse text | 3-5 seconds |
| Extract data | 2-3 seconds |
| Total upload + parse | 5-10 seconds |
| View certificate | <1 second |
| Update data | <1 second |
| Approve/Reject | <1 second |

---

## Troubleshooting

### Issue: PDF Not Parsing

**Symptoms**: Status stuck on "processing" or goes to "failed"

**Solutions**:
1. Check PDF is readable (not scanned image)
2. Verify PDF has text layer
3. Check console for errors
4. Try re-uploading

### Issue: No Data Extracted

**Symptoms**: All fields empty or null

**Solutions**:
1. PDF might be image-based (needs OCR)
2. Text format not matching patterns
3. Check parsing_error field
4. Use "Edit Data" to enter manually

### Issue: Wrong Values Parsed

**Symptoms**: Numbers incorrect or misplaced

**Solutions**:
1. Check confidence scores (should be >70%)
2. Use "Edit Data" to correct
3. Mark for manual review
4. Report pattern issue if consistent

### Issue: Upload Fails

**Symptoms**: Error message on upload

**Check**:
1. File size <10MB ✅
2. File type is PDF ✅
3. Valid batch ID ✅
4. User permissions ✅
5. Storage bucket exists ✅

---

## Testing Checklist

Use this checklist to ensure full feature testing:

### Basic Functionality
- [ ] Upload PDF successfully
- [ ] PDF displays in viewer
- [ ] Parsing completes without errors
- [ ] Data extracted and displayed
- [ ] Edit data works
- [ ] Save changes persists
- [ ] Download PDF works

### Workflow
- [ ] Approve certificate
- [ ] Reject certificate
- [ ] Status updates correctly
- [ ] Approval history tracked
- [ ] Edit disabled after approval

### Navigation
- [ ] Sidebar menu item visible
- [ ] Route works (/assay-certificates)
- [ ] Batch integration visible
- [ ] Navigation between pages works

### Data Validation
- [ ] Required fields enforced
- [ ] Number formats validated
- [ ] Date formats correct
- [ ] Units displayed properly

### Performance
- [ ] Upload responsive (<10s)
- [ ] Parsing completes reasonably
- [ ] UI updates without lag
- [ ] Large PDFs handled

### Error Handling
- [ ] Invalid file types rejected
- [ ] Large files rejected
- [ ] Network errors handled
- [ ] User feedback clear

### Security
- [ ] Only authenticated users access
- [ ] RLS policies work
- [ ] Files stored securely
- [ ] Permissions respected

---

## Test Data Reference

### Valid Test Values
```json
{
  "certificate_number": "AC-2024-11-001",
  "laboratory_name": "ABC Gold Assay Laboratory",
  "certificate_date": "2024-11-04",
  "sample_weight": 500.00,
  "gold_content_gpt": 18.35,
  "gold_content_ppm": 18350,
  "gold_purity_percentage": 92.50,
  "silver_content_gpt": 2.45,
  "silver_content_ppm": 2450,
  "silver_purity_percentage": 88.20,
  "fineness": 995.0,
  "copper_percentage": 0.15,
  "iron_percentage": 0.08,
  "zinc_percentage": 0.03,
  "deleterious_elements": {
    "arsenic": "<0.001%",
    "mercury": "<0.001%",
    "lead": "<0.001%"
  }
}
```

### Invalid Test Cases
```json
// Test error handling
{
  "gold_content_gpt": "invalid",  // Should reject non-number
  "fineness": 1200,               // Should reject >1000
  "certificate_date": "invalid"   // Should reject invalid date
}
```

---

## Advanced Testing

### Test Concurrent Uploads
1. Upload 3 PDFs simultaneously
2. Verify all process correctly
3. Check no race conditions

### Test Large Batch
1. Upload 20+ certificates to one batch
2. Verify list performance
3. Check pagination/scrolling

### Test Edge Cases
1. PDF with no text layer
2. PDF with unusual formatting
3. Multi-page certificates
4. Certificates in different languages

---

## Reporting Issues

If you encounter issues during testing:

1. **Check Console**
   - Open browser DevTools
   - Look for JavaScript errors
   - Note error messages

2. **Capture Details**
   - What were you doing?
   - What did you expect?
   - What actually happened?
   - Can you reproduce it?

3. **Check Database**
   - Go to Supabase dashboard
   - Check `assay_certificates` table
   - Look for error in `parsing_error` field

4. **Review Logs**
   - Check browser network tab
   - Look for failed API calls
   - Note response codes

---

## Success Criteria

Testing is successful when:

✅ PDF uploads without errors
✅ Parsing completes and extracts data
✅ All expected fields populated
✅ Confidence scores reasonable (>70%)
✅ Edit functionality works
✅ Approval workflow complete
✅ Navigation seamless
✅ Performance acceptable (<10s total)
✅ No console errors
✅ User experience smooth

---

## Next Steps After Testing

1. **Production Deployment**
   - Apply database migration
   - Configure storage bucket
   - Set up monitoring

2. **User Training**
   - Demo upload process
   - Show editing features
   - Explain approval workflow

3. **Documentation**
   - User manual
   - Training videos
   - FAQ section

4. **Monitoring**
   - Track upload success rate
   - Monitor parsing accuracy
   - Collect user feedback

---

**Sample PDF Location**: `public/sample-assay-certificate.pdf`

**Quick Test Command**:
```bash
# Verify PDF exists
ls -lh public/sample-assay-certificate.pdf

# Check PDF content (Linux/Mac)
pdftotext public/sample-assay-certificate.pdf - | head -20
```

---

**Last Updated**: November 4, 2025
**Version**: 1.0.0
