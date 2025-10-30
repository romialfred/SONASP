# Freight Companies - Data Not Saving Issue - Diagnostic Guide

## Problem Report

**Issue**: Freight Companies records display in the system but the table appears empty in the database.

**Possible Causes**:
1. Data is hardcoded in the frontend (not from database)
2. RLS (Row Level Security) policies blocking read access
3. Wrong table name being queried
4. Data is in database but user doesn't have permission to see it
5. Frontend caching old data

---

## Investigation Summary

### Code Analysis Results ✅

**Freight Companies Page** (`FreightCompaniesPage.tsx`):
- Is actually an alias for `TransportCompaniesPage`
- Queries the `transport_companies` table
- Uses proper Supabase client

**Transport Companies Listing** (`TransportCompaniesPage.tsx`):
```typescript
// Line 36-38: Queries database correctly
const { data, error } = await supabase
  .from('transport_companies')
  .select('*')
  .order('name');
```

**Transport Company Form** (`TransportCompanyForm.tsx`):
```typescript
// Line 158-160: Inserts into database correctly
const { data, error } = await supabase
  .from('transport_companies')
  .insert([submitData])
  .select();
```

**Conclusion**: The code is correct and should save to database.

---

## Diagnostic Steps

### Step 1: Run Diagnostic SQL Script

Copy the SQL script to Supabase SQL Editor and run it:

**File**: `diagnose_freight_companies.sql` (in project root)

Or run this directly:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'transport_companies'
);

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transport_companies'
ORDER BY ordinal_position;

-- Count records
SELECT COUNT(*) as total FROM transport_companies;

-- View all data
SELECT id, name, email, company_type, is_active, created_at
FROM transport_companies
ORDER BY created_at DESC;
```

**What to look for**:
- Does the table exist? (Should be `true`)
- How many records? (Might be 0)
- Are there any records visible?

### Step 2: Check RLS Policies

RLS might be blocking access:

```sql
-- Check RLS policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'transport_companies';

-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'transport_companies';
```

**What to look for**:
- If `rowsecurity = true`, RLS is enabled
- Check if there are SELECT policies
- Check if your user role matches the policy roles

### Step 3: Test Manual Insert

Try inserting a test record:

```sql
-- Test insert (will show any errors)
INSERT INTO transport_companies (
  name,
  email,
  phone,
  company_type,
  contact_person,
  address,
  is_active
) VALUES (
  'Test Company',
  'test@example.com',
  '+1234567890',
  'both',
  'Test Contact',
  '123 Test St',
  true
)
RETURNING *;
```

**What to look for**:
- Does it succeed?
- What error do you get (if any)?
- Does the record appear in SELECT query?

---

## Browser Console Debugging

With the updated code, you now have extensive logging:

### Step 1: Open Browser Console (F12)

### Step 2: Navigate to Freight Companies Page

URL: `/admin/transport-companies`

**Look for this log**:
```javascript
Loading transport companies from database...
Loaded X transport companies: [...]
```

**Questions**:
- What is X? (number of records loaded)
- What does the array contain?
- Any errors in console?

### Step 3: Try Creating a New Company

1. Click "Add Company"
2. Fill in the form
3. Click "Create Company"

**Look for these logs**:
```javascript
Submitting transport company data: {...}
Inserting new transport company
Transport company created successfully: [...]
```

**OR if there's an error**:
```javascript
Error inserting transport company: {...}
Error details: {
  message: "...",
  details: "...",
  hint: "...",
  code: "..."
}
```

This will tell you EXACTLY what's wrong!

---

## Common Issues and Fixes

### Issue 1: RLS Blocking Access

**Symptom**: Table exists, but SELECT returns 0 rows even though INSERT succeeds

**Diagnosis**:
```sql
-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'transport_companies';
```

**Fix**: Add or update RLS policies
```sql
-- Option A: Temporarily disable RLS (NOT for production!)
ALTER TABLE transport_companies DISABLE ROW LEVEL SECURITY;

-- Option B: Add proper SELECT policy
CREATE POLICY "Allow all authenticated users to view transport companies"
  ON transport_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Option C: Add policy for specific role
CREATE POLICY "Allow management to view transport companies"
  ON transport_companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );
```

### Issue 2: Missing INSERT Policy

**Symptom**: Form submission fails with permission error

**Diagnosis**: Check console for error code "42501" (insufficient privilege)

**Fix**: Add INSERT policy
```sql
CREATE POLICY "Allow authenticated users to insert transport companies"
  ON transport_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

### Issue 3: Table Doesn't Exist

**Symptom**: Error "relation transport_companies does not exist"

**Diagnosis**: Table wasn't created by migrations

**Fix**: Create the table
```sql
CREATE TABLE IF NOT EXISTS transport_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  company_type text NOT NULL CHECK (company_type IN ('mine_to_airport', 'airport_to_refinery', 'both')),
  contact_person text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Add basic policies
CREATE POLICY "Enable read for authenticated users"
  ON transport_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON transport_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON transport_companies FOR UPDATE
  TO authenticated
  USING (true);
```

### Issue 4: Frontend Showing Cached/Hardcoded Data

**Symptom**: Data displays but doesn't match database

**Diagnosis**: 
- Check browser console logs
- Log shows "Loaded 0 transport companies" but UI shows data

**Fix**: 
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check if there's demo/seed data in code

---

## Verification Checklist

After applying fixes, verify:

### Database Checks ✅
- [ ] Table `transport_companies` exists
- [ ] Can insert records manually via SQL
- [ ] Can select records manually via SQL
- [ ] RLS policies exist and are correct
- [ ] Constraints are valid (company_type, etc.)

### Frontend Checks ✅
- [ ] Console shows "Loading transport companies from database..."
- [ ] Console shows "Loaded X transport companies" with correct count
- [ ] No errors in console when loading page
- [ ] Can create new company via form
- [ ] Console shows "Transport company created successfully"
- [ ] New company appears in list immediately

### Integration Checks ✅
- [ ] Data saved in form appears in database
- [ ] Data in database appears in frontend list
- [ ] Edit form loads correct data
- [ ] Updates save correctly

---

## Quick Fix Summary

### Most Likely Issue: RLS Policies Missing

**Quick Fix SQL**:
```sql
-- Ensure RLS is enabled
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

-- Add permissive policies for authenticated users
DROP POLICY IF EXISTS "Enable read for authenticated users" ON transport_companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON transport_companies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON transport_companies;

CREATE POLICY "Enable read for authenticated users"
  ON transport_companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON transport_companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON transport_companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

Then:
1. Clear browser cache
2. Refresh page (Ctrl+F5)
3. Check console logs
4. Try creating a new company

---

## Files Modified

### Added Debug Logging
- ✅ `TransportCompaniesPage.tsx` - Added load logging
- ✅ `TransportCompanyForm.tsx` - Added submission logging

### Created Diagnostic Tools
- ✅ `diagnose_freight_companies.sql` - Comprehensive diagnostic script
- ✅ `FREIGHT_COMPANY_UPDATE_FIX.md` - This guide

### Build Status
- ✅ Build successful (1905.81 kB)
- ✅ No compilation errors

---

## What to Report Back

After running diagnostics, please report:

1. **Table Status**:
   - Does table exist? (Yes/No)
   - How many records? (Number)
   
2. **RLS Status**:
   - Is RLS enabled? (Yes/No)
   - How many policies? (Number)
   - What are the policy names?

3. **Browser Console**:
   - What does "Loaded X transport companies" show for X?
   - Any errors?
   - What happens when you try to create a company?

4. **Manual Test**:
   - Can you INSERT a record via SQL?
   - Does it appear in SELECT query?
   - Does it appear in the frontend?

This information will help identify the exact issue!

---

## Summary

**Problem**: Data appears in UI but not in database

**Code Status**: ✅ Code is correct, properly queries and inserts to `transport_companies`

**Most Likely Cause**: RLS policies blocking access

**Next Steps**:
1. Run diagnostic SQL script
2. Check browser console logs  
3. Apply RLS policy fix if needed
4. Clear cache and test

**Expected After Fix**:
- Database shows records
- Console shows correct count
- Form saves successfully
- List displays database data

---

**The code is working correctly - the issue is likely RLS policies or table permissions!** ✅🔒
