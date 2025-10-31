# Where to Upload Assay Certificates

## ⚠️ Important: Two Different Upload Sections

Your batch details page has **TWO different sections**:

### ❌ Documents Section (RIGHT SIDE) - NOT for Assay Certificates
This is what you clicked in your screenshot. This "Upload Document" button is a placeholder for general documents and **does not work yet**.

Location:
```
Right Column
└── Documents Card
    └── Upload Document button ← This doesn't work!
```

### ✅ Assay Certificates Section (LEFT SIDE) - USE THIS!
This is the correct section for uploading assay certificates with auto-parsing.

Location:
```
Left Column (scroll down)
├── Batch Information Card
├── Timeline Card
└── Assay Certificates Card ← USE THIS ONE!
    ├── Upload Drop Zone (drag & drop PDF)
    └── "Upload & Parse Certificate" button
```

---

## 📍 How to Find the Assay Certificates Upload

### Step 1: Open Batch Details
- Go to: Sidebar → Batch Management → Batches
- Click on any batch (e.g., GN-2025-10-003)

### Step 2: Scroll Down on the LEFT Column
The page has a 2-column layout:
```
┌─────────────────────────────────┬───────────────────┐
│ LEFT COLUMN (wider)             │ RIGHT COLUMN      │
│                                 │                   │
│ ✓ Batch Status Flow             │ ✓ Documents       │
│ ✓ Batch Information             │ ✓ Quick Actions   │
│ ✓ Timeline                      │                   │
│                                 │                   │
│ ⬇️ SCROLL DOWN HERE             │                   │
│                                 │                   │
│ ✓ Assay Certificates ← HERE!    │                   │
│   [Upload Drop Zone]            │                   │
│                                 │                   │
└─────────────────────────────────┴───────────────────┘
```

### Step 3: Look for "Assay Certificates" Card
You'll see a card titled **"Assay Certificates"** with:
- 📄 Upload drop zone (dashed border box)
- Text: "Drop PDF here or click to browse"
- File size info: "PDF files up to 10MB"

### Step 4: Upload Your Certificate
- **Drag & drop** PDF into the box, OR
- **Click** on the box to browse files
- Select your PDF file
- Click **"Upload & Parse Certificate"** button

---

## 🎯 Visual Guide

### What You're Currently Seeing (Your Screenshot)
```
Right Side Column:
┌─────────────────────┐
│ Documents           │
├─────────────────────┤
│ Initial Quality... │
│ Shipping Manifest  │
│                    │
│ [Upload Document]  │ ← You clicked here (doesn't work)
└─────────────────────┘
```

### What You Should Look For (Left Side, Scroll Down)
```
Left Side Column:
┌──────────────────────────────────┐
│ Batch Status Flow                │
└──────────────────────────────────┘
         ⬇️
┌──────────────────────────────────┐
│ Batch Information                │
└──────────────────────────────────┘
         ⬇️
┌──────────────────────────────────┐
│ Timeline                         │
└──────────────────────────────────┘
         ⬇️ SCROLL DOWN
┌──────────────────────────────────┐
│ Assay Certificates              │ ← FIND THIS!
├──────────────────────────────────┤
│ 📄 Upload Assay Certificate      │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ⬆️ Upload icon                │ │
│ │ Drop PDF here or click        │ │
│ │ PDF files up to 10MB          │ │
│ └──────────────────────────────┘ │
│                                  │
│ ℹ️ Supported Certificate Formats │
│ • Standard assay certificates   │
│ • Gold and silver content       │
└──────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### Problem: "I don't see the Assay Certificates section"

**Solution 1: Scroll Down**
- The section is below Timeline
- Scroll down on the LEFT column (the wider one)
- It's not on the right side with Documents

**Solution 2: Check Browser Width**
- On narrow screens, sections stack vertically
- Make browser window wider
- Refresh the page

**Solution 3: Check Database**
- The migration might not be applied
- Go to Supabase SQL Editor
- Run the migration from `supabase/migrations/20251104000000_create_assay_certificates_system.sql`

### Problem: "The Upload Document button doesn't work"

**Explanation:**
- That's the wrong button!
- "Upload Document" in Documents section is a placeholder
- Use "Assay Certificates" section instead (scroll down left column)

### Problem: "Upload button appears but nothing happens"

**Check:**
1. Browser console for errors (F12 → Console tab)
2. File is actually a PDF (not image or other type)
3. File size is under 10MB
4. You're logged in
5. Storage bucket exists in Supabase

---

## ✅ Quick Test

### Test with Sample PDF

1. **Navigate**
   ```
   Sidebar → Batches → Select any batch
   ```

2. **Scroll Down Left Column**
   ```
   Pass: Batch Status Flow
   Pass: Batch Information
   Pass: Timeline
   Stop: Assay Certificates ← HERE
   ```

3. **Find Upload Section**
   ```
   Look for:
   - Card titled "Assay Certificates"
   - Blue file icon 📄
   - Dashed border drop zone
   ```

4. **Upload Sample PDF**
   ```
   File: public/sample-assay-certificate.pdf
   Action: Drag & drop OR click to browse
   Button: "Upload & Parse Certificate"
   ```

5. **Wait for Result**
   ```
   - Uploading... (~2 seconds)
   - Parsing... (~5 seconds)
   - Success! (shows confidence score)
   ```

---

## 📊 Page Layout Reference

```
Batch Details Page Layout:

┌────────────────────────────────────────────────────────────┐
│ Header: Batch Number + Back Button + Edit Button          │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ Batch Status Flow (full width)                            │
└────────────────────────────────────────────────────────────┘
┌─────────────────────────────────┬──────────────────────────┐
│ LEFT COLUMN (2/3 width)         │ RIGHT COLUMN (1/3)       │
├─────────────────────────────────┼──────────────────────────┤
│ 1. Batch Information            │ 1. Documents             │
│    - Weight, Date, Status       │    - Static mockup       │
│    - Location, Transport        │    - Upload button       │
│                                 │      (doesn't work)      │
│ 2. Timeline                     │                          │
│    - History events             │ 2. Quick Actions         │
│    - Status changes             │    - Print, Export       │
│                                 │    - Share               │
│ 3. Assay Certificates           │                          │
│    ← YOU NEED THIS SECTION!     │                          │
│    - Upload drop zone           │                          │
│    - Auto-parsing               │                          │
│    - Certificate list           │                          │
│    - View/Edit/Approve          │                          │
└─────────────────────────────────┴──────────────────────────┘
```

---

## 🎓 Key Takeaways

1. **Two Upload Sections Exist:**
   - ❌ Documents → "Upload Document" (right side, doesn't work)
   - ✅ Assay Certificates → Upload zone (left side, works!)

2. **Scroll Down:**
   - Assay Certificates is below Timeline
   - On the LEFT column (wider column)

3. **Look for:**
   - Card title: "Assay Certificates"
   - Dashed border drop zone
   - Blue file icon 📄

4. **Use:**
   - Drag & drop PDF
   - OR click to browse
   - Then click "Upload & Parse Certificate"

---

## 📞 Still Can't Find It?

1. **Take a screenshot** of your entire browser window
2. **Check the URL** - should be `/batches/[batch-id]`
3. **Verify you're on Batch Details page**, not Batch Listing
4. **Scroll down slowly** on the left side
5. **Look for the card** with "Assay Certificates" title

The section IS there - you just need to scroll past Timeline on the LEFT column!

---

**Summary:**
- ❌ Don't use: Documents → "Upload Document" (right side)
- ✅ Use this: Assay Certificates → Upload zone (left side, scroll down)

**Location:** Left Column → Scroll Down → After Timeline → "Assay Certificates" Card
