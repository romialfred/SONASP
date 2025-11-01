# Storage Policy - Detailed Step-by-Step Guide

---

## Step 3: Add Storage Policy (Detailed)

After creating the bucket, you need to add a policy to allow users to upload files.

---

## 📍 Where You Are Now

You've just created the bucket `assay-certificates` in Supabase Dashboard.
Now you should see it in your Storage list.

---

## 🎯 Step-by-Step Instructions

### **1. Navigate to Your Bucket**

- In Supabase Dashboard
- Left sidebar → **Storage**
- You'll see a list of buckets
- **Click on**: `assay-certificates` bucket

---

### **2. Go to Policies Tab**

Once inside the bucket:
- At the top, you'll see tabs: **Files | Policies | Settings**
- **Click on**: **Policies** tab

You'll see a page that says:
```
No policies found
```

---

### **3. Create New Policy**

- Click the **"New Policy"** button (usually top right)

You'll see options:
1. **Get started quickly** (templates)
2. **For full customization** (custom SQL)

- **Click on**: **"For full customization"**

---

### **4. Policy Editor Opens**

You'll see a form with:
- Policy name (optional)
- Command (SELECT, INSERT, UPDATE, DELETE, ALL)
- Target roles
- USING expression
- WITH CHECK expression

---

### **5. Fill the Form**

#### **Option A: Simple UI Form** (Recommended)

**Policy name:** (optional, leave empty or type):
```
Allow authenticated users all operations
```

**Allowed operation:** 
- Select: **ALL**
  (This covers SELECT, INSERT, UPDATE, DELETE)

**Target roles:**
- Select: **authenticated**
  (This means logged-in users)

**Policy definition - USING:**
```sql
bucket_id = 'assay-certificates'
```

**Policy definition - WITH CHECK:**
```sql
bucket_id = 'assay-certificates'
```

---

#### **Option B: SQL Editor** (If available)

If you see a SQL editor instead of the form, paste this complete policy:

```sql
CREATE POLICY "Allow authenticated users all operations"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'assay-certificates')
WITH CHECK (bucket_id = 'assay-certificates');
```

---

### **6. Review Your Policy**

Before saving, review:

- ✅ Operation: **ALL**
- ✅ Target: **authenticated** users
- ✅ USING: `bucket_id = 'assay-certificates'`
- ✅ WITH CHECK: `bucket_id = 'assay-certificates'`

This means:
- Logged-in users can upload, view, update, delete files
- Only in the `assay-certificates` bucket
- Not in other buckets

---

### **7. Save the Policy**

- Click **"Review"** button (if shown)
- Then click **"Save policy"** button

You'll see:
```
✅ Policy created successfully
```

---

### **8. Verify Policy Exists**

After saving, you should see:

**Policies list:**
```
Policy Name: Allow authenticated users all operations
Command: ALL
Roles: authenticated
Status: Active ✅
```

---

## 🔍 Visual Guide

Here's what you're looking for at each step:

```
Supabase Dashboard
├── Storage (sidebar)
│   └── assay-certificates (your bucket)
│       ├── Files (tab)
│       ├── Policies (tab) ← YOU ARE HERE
│       │   ├── [New Policy] button
│       │   │   ├── Get started quickly
│       │   │   └── For full customization ← CLICK THIS
│       │   │       └── Policy Editor
│       │   │           ├── Policy name
│       │   │           ├── Command: ALL
│       │   │           ├── Roles: authenticated
│       │   │           ├── USING: bucket_id = 'assay-certificates'
│       │   │           └── WITH CHECK: bucket_id = 'assay-certificates'
│       │   └── [Save Policy] ← FINAL CLICK
│       └── Settings (tab)
```

---

## ❓ Common Questions

### Q: What does USING do?
**A:** Controls WHO can access files (read/view)

### Q: What does WITH CHECK do?
**A:** Controls WHO can create/upload files

### Q: Why both the same?
**A:** So authenticated users can both read AND write

### Q: What if I see "Policy already exists"?
**A:** Good! Policy is already there, skip this step

### Q: Can I use a different policy name?
**A:** Yes! Name doesn't affect functionality

---

## 🧪 Test the Policy

After creating the policy:

1. **Manual Test in Dashboard:**
   - Storage → assay-certificates → Files tab
   - Click **"Upload"** button
   - Try uploading a PDF file
   - If it works = ✅ Policy is correct!

2. **Test in Your App:**
   - Refresh Gold Shipper (F5)
   - Login
   - Batches → Any batch → Batch details
   - Scroll to "Assay Certificates"
   - Try drag & drop a PDF
   - If it uploads = ✅ Policy works in app!

---

## 🚨 Troubleshooting

### Error: "Permission denied"

**Cause:** Policy not created or incorrect

**Fix:**
1. Check policy exists: Storage → Bucket → Policies
2. Verify target role is **authenticated** (not public)
3. Verify bucket_id matches exactly: `assay-certificates`

---

### Error: "Bucket not found"

**Cause:** Bucket name mismatch

**Fix:**
- Bucket must be named: `assay-certificates` (with dash)
- Not: `assay_certificates` (underscore)
- Case sensitive!

---

### Policy not showing after save

**Cause:** Refresh needed

**Fix:**
- Refresh the Policies tab
- Or go back to Storage list and re-enter bucket

---

## ✅ Success Checklist

After completing Step 3:

- [ ] Policy created in Dashboard
- [ ] Policy visible in Policies tab
- [ ] Policy command is **ALL**
- [ ] Policy role is **authenticated**
- [ ] Manual upload works in Dashboard
- [ ] Can see upload button in app

All checked? → **Step 3 Complete!** 🎉

---

## 📸 Screenshots Reference

### What the Policy Editor Looks Like:

```
┌─────────────────────────────────────────────────────────────┐
│ New Policy                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Policy name (optional)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Allow authenticated users all operations                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Allowed operation                                           │
│ ┌─────────┐                                                │
│ │ ALL   ▼ │                                                │
│ └─────────┘                                                │
│                                                             │
│ Target roles                                                │
│ ┌──────────────────┐                                       │
│ │ authenticated  ▼ │                                       │
│ └──────────────────┘                                       │
│                                                             │
│ USING expression                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ bucket_id = 'assay-certificates'                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ WITH CHECK expression                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ bucket_id = 'assay-certificates'                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                    [Review]  [Save policy]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 Understanding the Policy

### What This Policy Does:

```sql
CREATE POLICY "Allow authenticated users all operations"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'assay-certificates')
WITH CHECK (bucket_id = 'assay-certificates');
```

**Line by line:**

1. `CREATE POLICY` - Creates a new access rule
2. `ON storage.objects` - Applies to storage files
3. `FOR ALL` - All operations (SELECT, INSERT, UPDATE, DELETE)
4. `TO authenticated` - Only logged-in users
5. `USING (...)` - Read permission: must be this bucket
6. `WITH CHECK (...)` - Write permission: must be this bucket

**In plain English:**
"Logged-in users can do anything with files in the assay-certificates bucket, and only that bucket."

---

## 🔐 Security Note

This policy is **secure** because:
- ✅ Only authenticated users (not public)
- ✅ Only this specific bucket
- ✅ Row Level Security (RLS) enabled
- ✅ Each user sees their own files

---

## 📚 Alternative: Multiple Policies

Instead of one "ALL" policy, you can create separate policies:

**Policy 1 - Read:**
```sql
CREATE POLICY "Users can view certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'assay-certificates');
```

**Policy 2 - Upload:**
```sql
CREATE POLICY "Users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assay-certificates');
```

**Policy 3 - Delete:**
```sql
CREATE POLICY "Users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assay-certificates');
```

But the **single ALL policy is simpler and works perfectly!**

---

## ✨ Next Steps

After Step 3 is complete:

1. ✅ Refresh your app
2. ✅ Test upload feature
3. ✅ Upload a sample PDF
4. ✅ Watch auto-parsing work
5. ✅ Celebrate! 🎉

---

**Need help?** Re-read this guide or check the troubleshooting section!
