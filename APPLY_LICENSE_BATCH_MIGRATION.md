# 🚀 Apply License-Batch Migration

## ✅ **YES - You Should Migrate!**

The migration adds the `license_id` column to the `batches` table, which is **REQUIRED** for the batch-license integration to work.

---

## 📋 **What This Migration Does:**

The migration file `20251108000000_create_export_license_system.sql` includes:

```sql
-- Add license_id to batches table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN license_id uuid REFERENCES licenses(id);
    CREATE INDEX IF NOT EXISTS idx_batches_license_id ON batches(license_id);
  END IF;
END $$;
```

**What it does:**
- ✅ Adds `license_id` column to batches table
- ✅ Creates foreign key to licenses table
- ✅ Creates index for performance
- ✅ Safe: Uses `IF NOT EXISTS` - won't break if already applied

---

## 🔧 **How to Apply the Migration:**

### **Option 1: Via Supabase Dashboard (RECOMMENDED)** ⭐

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Or go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

3. **Copy the Migration SQL**
   - Open file: `supabase/migrations/20251108000000_create_export_license_system.sql`
   - Copy the ENTIRE contents

4. **Execute in SQL Editor**
   - Paste the SQL into the editor
   - Click "Run" button
   - Wait for success message

5. **Verify**
   - Run this verification query:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'batches' AND column_name = 'license_id';
   ```
   - Should return: `license_id | uuid | YES`

---

### **Option 2: Using Supabase CLI** (if installed)

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push

# Verify
supabase db diff
```

---

## ✅ **Verification Queries**

### **1. Check if license_id Column Exists:**

```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name = 'license_id';
```

**Expected Result:**
```
column_name | data_type | is_nullable | column_default
------------|-----------|-------------|---------------
license_id  | uuid      | YES         | NULL
```

### **2. Check Index Exists:**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'batches'
  AND indexname = 'idx_batches_license_id';
```

**Expected Result:**
```
indexname                | indexdef
-------------------------|--------------------------------------------------
idx_batches_license_id   | CREATE INDEX idx_batches_license_id ON public...
```

### **3. Check Foreign Key Constraint:**

```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'batches'
  AND kcu.column_name = 'license_id';
```

**Expected Result:**
```
constraint_name          | table_name | column_name | foreign_table | foreign_column
-------------------------|------------|-------------|---------------|---------------
batches_license_id_fkey  | batches    | license_id  | licenses      | id
```

---

## 🧪 **Test After Migration**

### **1. Test in SQL Editor:**

```sql
-- Try inserting a batch with license_id (will fail without data, but tests schema)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'batches';

-- Should include 'license_id' in results
```

### **2. Test in Application:**

1. **Refresh your browser**
2. **Go to:** Batches → Create New Batch
3. **Select:** Mining Company
4. **Verify:** License selector appears
5. **Create:** Test batch with license
6. **Check:** Batch listing shows license info

---

## ⚠️ **Important Notes:**

### **Safe Migration:**
- ✅ Uses `IF NOT EXISTS` - won't break if already applied
- ✅ Doesn't modify existing data
- ✅ Backward compatible - old batches without license_id still work
- ✅ No downtime required

### **What Happens to Existing Batches:**
- Existing batches will have `license_id = NULL`
- They will display "No License" in the listing
- They can be edited to add a license later
- New batches MUST have a license selected

### **If Migration Fails:**
- Check if you have proper permissions
- Verify you're connected to correct project
- Check if licenses table exists (from same migration)
- Contact support if persistent issues

---

## 📊 **Complete Migration Checklist:**

**Before Migration:**
- [ ] Backup database (optional but recommended)
- [ ] Note current batch count: `SELECT COUNT(*) FROM batches;`
- [ ] Verify licenses table exists: `SELECT COUNT(*) FROM licenses;`

**Apply Migration:**
- [ ] Open Supabase SQL Editor
- [ ] Copy migration SQL from file
- [ ] Execute in SQL Editor
- [ ] Wait for success confirmation

**Verify Migration:**
- [ ] Run verification query for license_id column ✅
- [ ] Run verification query for index ✅
- [ ] Run verification query for foreign key ✅
- [ ] Check batch count unchanged ✅

**Test Application:**
- [ ] Refresh browser
- [ ] Create new batch with license selector
- [ ] View batch listing - see license column
- [ ] Create batch successfully
- [ ] View created batch - see license info

---

## 🎯 **Quick Apply (Copy-Paste Ready)**

**Just copy this and paste into Supabase SQL Editor:**

```sql
-- Verify before
SELECT 'Before Migration' as status, COUNT(*) as batch_count FROM batches;

-- Check if column already exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'batches' AND column_name = 'license_id'
    )
    THEN 'license_id column ALREADY EXISTS'
    ELSE 'license_id column DOES NOT EXIST - will be added'
  END as column_status;

-- Apply migration (safe - uses IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE batches ADD COLUMN license_id uuid REFERENCES licenses(id);
    CREATE INDEX IF NOT EXISTS idx_batches_license_id ON batches(license_id);
    RAISE NOTICE 'Migration applied successfully: license_id column added to batches';
  ELSE
    RAISE NOTICE 'Migration skipped: license_id column already exists';
  END IF;
END $$;

-- Verify after
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'batches' AND column_name = 'license_id';

SELECT 'After Migration' as status, COUNT(*) as batch_count FROM batches;
```

**Expected Output:**
```
Before Migration | batch_count: X
Column Status: "will be added" OR "already exists"
NOTICE: Migration applied successfully
license_id | uuid | YES
After Migration | batch_count: X (same as before)
```

---

## ✅ **Summary:**

**YES - Apply the migration NOW to:**
1. ✅ Add `license_id` column to batches table
2. ✅ Enable license integration in batch creation
3. ✅ Allow batch listing to display license info
4. ✅ Ensure compliance with export regulations

**The migration is:**
- ✅ Safe (uses IF NOT EXISTS)
- ✅ Tested (included in codebase)
- ✅ Required (for new features to work)
- ✅ Non-breaking (backward compatible)

**After migration, refresh your browser and test the batch creation with license selection!** 🚀
