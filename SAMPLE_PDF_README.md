# Sample Assay Certificate PDF - Quick Start

## 📄 Sample PDF Created

A realistic assay certificate PDF has been generated for testing the PDF ingestion feature.

**Location**: `public/sample-assay-certificate.pdf`

**Size**: 8.8 KB

---

## 🚀 Quick Test (3 Steps)

### Step 1: Navigate to a Batch
```
Sidebar → Batch Management → Batches
→ Click on any batch (e.g., GN-2025-10-003)
```

### Step 2: Upload the Sample PDF
```
Scroll down to "Assay Certificates" section
→ Click "Browse files"
→ Select: public/sample-assay-certificate.pdf
→ Click "Upload & Parse Certificate"
```

### Step 3: View Results
```
Wait 5-10 seconds for parsing
→ Click "View" button
→ Review parsed data
→ Edit if needed
→ Click "Approve"
```

---

## 📊 What You Should See

### Certificate Details
- **Certificate Number**: AC-2024-11-001
- **Laboratory**: ABC Gold Assay Laboratory
- **Date**: November 4, 2024

### Parsed Values
- **Gold**: 18.35 g/t (92.50% purity)
- **Silver**: 2.45 g/t (88.20% purity)
- **Fineness**: 995.0
- **Sample Weight**: 500.00 g

### Additional Data
- **Base Metals**: Cu (0.15%), Fe (0.08%), Zn (0.03%)
- **Deleterious Elements**: As, Hg, Pb (<0.001%)

---

## 🎯 Test Scenarios

### ✅ Scenario 1: Basic Upload Test
1. Upload PDF → Should succeed
2. Wait for parsing → Status: "completed"
3. View data → All fields populated

### ✅ Scenario 2: Edit Data Test
1. View certificate
2. Click "Edit Data"
3. Change gold content: 18.35 → 20.00
4. Save → Should persist

### ✅ Scenario 3: Approval Test
1. View certificate
2. Click "Approve"
3. Add notes: "Data verified"
4. Status → "Approved" (green badge)

### ✅ Scenario 4: Multiple Upload Test
1. Upload same PDF 3 times
2. Each gets unique ID
3. All appear in list
4. All parseable

---

## 📋 Expected Parsing Results

### High Confidence (>90%)
✅ Certificate Number
✅ Laboratory Name
✅ Gold Content
✅ Silver Content
✅ Fineness
✅ Sample Weight

### Medium Confidence (70-90%)
⚠️ Certificate Date
⚠️ Sample ID
⚠️ Base Metals

### May Need Review (<70%)
❓ Deleterious Elements (check manually)

---

## 🔍 How the PDF Was Generated

The sample PDF was created using jsPDF library with:

```javascript
// Certificate header
- Laboratory info
- ISO 17025 accreditation
- License number

// Certificate details
- Certificate number
- Issue date
- Sample ID

// Client information
- Company name
- Batch number
- Sample weight

// Assay results table
- Gold and silver content
- Purity percentages
- Content in g/t and ppm

// Additional elements
- Base metals (Cu, Fe, Zn)
- Deleterious elements (As, Hg, Pb)

// Fineness and method
- Fineness value
- Analytical method
- Standards used
```

---

## 📁 File Location

```
project/
├── public/
│   └── sample-assay-certificate.pdf  ← Sample PDF
├── generate-sample-assay-pdf.cjs     ← Generator script
└── SAMPLE_PDF_README.md              ← This file
```

---

## 🛠️ Regenerate PDF (if needed)

If you need to regenerate the sample PDF:

```bash
# Run the generator script
node generate-sample-assay-pdf.cjs

# Verify creation
ls -lh public/sample-assay-certificate.pdf
```

---

## 🎨 Customize Sample Data

To create PDF with different values, edit `generate-sample-assay-pdf.cjs`:

```javascript
// Change gold content
doc.text('18.35', 80, 155);  // ← Edit this

// Change certificate number
doc.text('AC-2024-11-001', 80, 58);  // ← Edit this

// Change fineness
doc.text('Fineness: 995.0', 25, 230);  // ← Edit this
```

Then regenerate:
```bash
node generate-sample-assay-pdf.cjs
```

---

## 📚 Related Documentation

- **Feature Overview**: `ASSAY_CERTIFICATE_INGESTION_FEATURE.md`
- **Quick Start**: `ASSAY_CERTIFICATE_QUICK_START.md`
- **Update Guide**: `ASSAY_CERTIFICATE_UPDATE_GUIDE.md`
- **Testing Guide**: `ASSAY_CERTIFICATE_TESTING_GUIDE.md`

---

## ⚡ Performance Notes

- **PDF Size**: 8.8 KB (small and fast)
- **Upload Time**: ~1-2 seconds
- **Parse Time**: ~3-5 seconds
- **Total Time**: ~5-10 seconds

---

## 🎓 Learning Points

This sample demonstrates:

1. **Realistic Structure** - Matches real assay certificates
2. **Complete Data** - All fields that parser looks for
3. **Multiple Formats** - g/t, ppm, percentages, karat
4. **Standards Compliance** - ISO, ASTM references
5. **Professional Layout** - Header, tables, signatures

---

## ✨ Next Steps

After testing with sample PDF:

1. **Test with Real PDFs**
   - Upload actual assay certificates
   - Compare parsing accuracy
   - Adjust patterns if needed

2. **Train Users**
   - Show upload process
   - Demo editing features
   - Explain approval workflow

3. **Monitor Performance**
   - Track parsing success rate
   - Note common issues
   - Improve patterns

4. **Gather Feedback**
   - User experience
   - Missing features
   - Accuracy improvements

---

## 🆘 Troubleshooting

**Q: PDF won't upload?**
- Check file size <10MB
- Verify it's a PDF file
- Check browser console

**Q: Parsing failed?**
- Check parsing_error in database
- Verify PDF has text layer
- Try re-uploading

**Q: No data extracted?**
- PDF might be image-based
- Use "Edit Data" to enter manually
- Check text is readable

**Q: Wrong values parsed?**
- Check confidence scores
- Edit and correct values
- Report pattern issue

---

## 📞 Support

Need help? Check:
- Browser console for errors
- Database `assay_certificates` table
- Supabase logs for API errors
- Documentation files in project root

---

**File**: `public/sample-assay-certificate.pdf`
**Generated**: November 4, 2025
**Version**: 1.0.0
**Status**: ✅ Ready for testing
