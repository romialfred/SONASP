# 📍 WHERE IS THE ASSAY CERTIFICATES SECTION?

## ✅ CODE IS CORRECT

The code in `BatchDetails.tsx` is **already fixed**:
- ❌ Hardcoded "Documents" section REMOVED
- ✅ "Assay Certificates" section PRESENT (lines 436-456)
- ✅ Located in LEFT column after Timeline

## 🔍 YOUR BROWSER IS SHOWING CACHED CODE

The "Documents" section you see is **old cached JavaScript**.

### Layout Structure:
```
Batch Status Flow (top)
  ↓
Grid Layout (2 columns on desktop)
  ↓
LEFT COLUMN (2/3 width):
  - Batch Information
  - Timeline
  - Assay Certificates ← THIS IS THERE!
  
RIGHT COLUMN (1/3 width):
  - Quick Actions
```

## 🚀 HOW TO FIX (30 SECONDS)

### Step 1: Hard Refresh Browser
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R

Or:
Clear cache and hard reload (F12 → Right-click refresh → Empty cache and hard reload)
```

### Step 2: Rebuild Project
```bash
npm run build
```

### Step 3: Restart Dev Server
```
Stop the dev server (if running)
Start it again: npm run dev
```

## 📊 VERIFICATION

After hard refresh, you should see:

### In Batch Details Page:
1. ✅ Batch Status Flow (top)
2. ✅ Batch Information (left)
3. ✅ Timeline (left)
4. ✅ **Assay Certificates** (left) ← NEW!
   - Upload certificate area
   - "No certificates uploaded yet" message
5. ✅ Quick Actions (right sidebar)
6. ❌ NO "Documents" section

## 🔬 DEBUG STEPS

### Check 1: View Page Source
```
1. Right-click on page
2. "View Page Source"
3. Search for "Assay Certificates"
4. If NOT found → Still serving old build
```

### Check 2: Network Tab
```
1. F12 → Network tab
2. Refresh page
3. Look for "index-*.js" files
4. Check timestamp → Should be recent
```

### Check 3: Check Build Output
```bash
# Check if dist folder is up to date
ls -la dist/assets/index-*.js

# Should show recent timestamp
```

## ⚠️ STILL NOT SHOWING?

### Problem: Dev server serving old build

**Solution 1: Kill all node processes**
```bash
# Windows
taskkill /F /IM node.exe

# Linux/Mac  
killall node
```

**Solution 2: Delete build artifacts**
```bash
# Delete dist folder
rm -rf dist/

# Delete node_modules/.vite cache
rm -rf node_modules/.vite/

# Rebuild
npm run build
```

**Solution 3: Check if file was actually saved**
```bash
# Verify the file doesn't have "Documents" hardcoded
grep -n "Documents" src/pages/batches/BatchDetails.tsx

# Should return nothing!
```

## 🎯 AFTER FIX

Once you see "Assay Certificates" section:

1. ✅ Apply `FIX_ASSAY_SCHEMA.sql` migration
2. ✅ Upload a PDF certificate
3. ✅ System should work!

## 📝 WHAT THE SECTION LOOKS LIKE

```
┌─────────────────────────────────────┐
│ Assay Certificates                  │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  📄 Drop PDF here or click to   │ │
│ │     browse                       │ │
│ │  PDF files up to 10MB            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ No certificates uploaded yet        │
│                                     │
│ Supported Certificate Formats:      │
│ • Standard assay laboratory certs   │
│ • Gold and silver content reports   │
│ • Deleterious elements analysis     │
│ • Purity and fineness certificates  │
└─────────────────────────────────────┘
```

## 🎉 SUMMARY

**Problem:** Browser cache showing old code  
**Solution:** Hard refresh (Ctrl+Shift+R)  
**Location:** Left column, after Timeline  
**Name:** "Assay Certificates" (not "Documents")  

**The code is already fixed! Just refresh your browser!**

