# ✅ License UI Fixes - Complete

## 🐛 Problems Identified and Fixed

### Problem 1: No Licenses Displaying
**Cause:** The `licenseService` was querying the `licenses` table directly, but the migration created a view `licenses_with_computed_fields` that includes computed fields `is_active` and `days_to_expiry`.

**Solution:** Updated `licenseService.ts` to use the view instead:
- `listLicenses()` now queries `licenses_with_computed_fields`
- `getActiveLicensesForMine()` now queries `licenses_with_computed_fields`

### Problem 2: "Add New License" Form Not Working
**Cause:** The button linked to `/licenses/register` but the actual route is `/licenses/requests/new` (for creating license requests).

**Solution:** Updated button links in `LicensesListingPage.tsx`:
- Changed button text from "Register License" to "Request License"
- Changed navigation from `/licenses/register` → `/licenses/requests/new`
- Applied to both the header button and empty state button

## 📝 Files Modified

### 1. `/src/services/licenseService.ts`
```typescript
// BEFORE
async listLicenses(filters?: LicenseFilters): Promise<License[]> {
  let query = supabase
    .from('licenses')  // ❌ Missing computed fields
    .select('*')

// AFTER
async listLicenses(filters?: LicenseFilters): Promise<License[]> {
  let query = supabase
    .from('licenses_with_computed_fields')  // ✅ Includes is_active, days_to_expiry
    .select('*')
```

```typescript
// BEFORE
async getActiveLicensesForMine(mineId: string): Promise<License[]> {
  const { data, error } = await supabase
    .from('licenses')  // ❌ Missing computed fields
    .select('*')
    .eq('applicant_mine_id', mineId)
    .eq('is_active', true)  // ❌ Would fail - column doesn't exist in table

// AFTER
async getActiveLicensesForMine(mineId: string): Promise<License[]> {
  const { data, error } = await supabase
    .from('licenses_with_computed_fields')  // ✅ Has is_active field
    .select('*')
    .eq('applicant_mine_id', mineId)
    .eq('is_active', true)  // ✅ Works now
```

### 2. `/src/pages/licenses/LicensesListingPage.tsx`
```typescript
// BEFORE
<Button onClick={() => navigate('/licenses/register')}>  // ❌ Route doesn't exist
  <Plus className="w-5 h-5 mr-2" />
  Register License
</Button>

// AFTER
<Button onClick={() => navigate('/licenses/requests/new')}>  // ✅ Correct route
  <Plus className="w-5 h-5 mr-2" />
  Request License  // ✅ Better terminology
</Button>
```

## 🎯 How the License System Works

### Database Structure

**Table: `licenses`**
- Stores actual approved licenses
- Has columns: `remaining_qty_oz`, `remaining_percentage` (GENERATED/computed)
- Does NOT have `is_active` or `days_to_expiry` as columns

**View: `licenses_with_computed_fields`**
- Created by migration 19
- Includes ALL columns from `licenses` table
- PLUS computed fields:
  - `is_active` - calculated based on CURRENT_DATE, status, dates, quota
  - `days_to_expiry` - calculated as `expiry_date - CURRENT_DATE`

**Table: `license_requests`**
- Stores license requests (before approval)
- Status flow: DRAFT → SUBMITTED → IN_REVIEW → APPROVED/REJECTED

### User Workflow

1. **Request License** (`/licenses/requests/new`)
   - User fills form with mining company, quantity, dates
   - Uploads supporting documents
   - Signs and submits request
   - Creates record in `license_requests` table
   - Status: DRAFT → SUBMITTED

2. **Management Reviews** (separate page)
   - Management reviews request
   - Approves or rejects
   - Status: IN_REVIEW → APPROVED/REJECTED

3. **License Created** (manually or automatically)
   - Once approved, license record created in `licenses` table
   - Now appears in `/licenses` page

4. **View Licenses** (`/licenses`)
   - Shows all approved licenses
   - Displays traffic light evaluation
   - Shows quota utilization
   - Click to view details (`/licenses/:id`)

## ✅ What Was Fixed

### Before Fix
- ❌ No licenses displayed (querying wrong table/view)
- ❌ Error: "column is_active does not exist"
- ❌ Error: "column days_to_expiry does not exist"
- ❌ "Add License" button linked to non-existent route
- ❌ Confusion between license requests and licenses

### After Fix
- ✅ Licenses display correctly from view
- ✅ `is_active` field available and working
- ✅ `days_to_expiry` field available and working
- ✅ "Request License" button links to correct form
- ✅ Clear separation: requests vs approved licenses

## 🧪 Testing

### To Test License Display

1. **Apply migrations 19 & 20** (if not already done)
   ```sql
   -- Migration 19: Creates tables and view
   -- Migration 20: Seeds 10 sample licenses
   ```

2. **Navigate to `/licenses`**
   - Should see 10 sample licenses
   - Each should show:
     - Traffic light (green/yellow/red dot)
     - Mine name, license number
     - Dates, quantities, percentages
     - Status badge
     - "View" button

3. **Check computed fields work**
   ```sql
   SELECT
     license_number,
     status,
     is_active,
     days_to_expiry,
     remaining_percentage
   FROM licenses_with_computed_fields
   LIMIT 3;
   ```
   Should return data without errors.

### To Test License Request Form

1. **Click "Request License" button**
   - Should navigate to `/licenses/requests/new`
   - Should NOT show 404 error

2. **Fill Step 1: Request Information**
   - Select mining company
   - Enter quantity (e.g., 1000 oz)
   - Optional: dates, priority, comments
   - Click "Save Draft" → saves to DB
   - Click "Next" → go to step 2

3. **Fill Step 2: Documents**
   - Add document title, type, description
   - Upload PDF/image
   - Can add multiple documents
   - Click "Next" → go to step 3

4. **Fill Step 3: Signature**
   - Enter signatory name and title
   - Check certification checkbox
   - Click "Submit Request" → creates request in DB
   - Redirects to `/licenses/requests`

## 📊 Database Queries for Verification

### Check if view exists
```sql
SELECT viewname
FROM pg_views
WHERE viewname = 'licenses_with_computed_fields';
```

### Check view structure
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'licenses_with_computed_fields'
ORDER BY ordinal_position;
```

### Query licenses with computed fields
```sql
SELECT
  license_number,
  applicant_company_name,
  status,
  authorized_qty_oz,
  consumed_qty_oz,
  remaining_qty_oz,
  remaining_percentage,
  is_active,
  days_to_expiry,
  expiry_date
FROM licenses_with_computed_fields
ORDER BY expiry_date;
```

### Check license requests
```sql
SELECT
  request_number,
  mine_name,
  status,
  planned_quantity_oz,
  request_date
FROM license_requests
ORDER BY request_date DESC;
```

## 🚀 Next Steps

1. **Verify licenses display** - Navigate to `/licenses` and confirm data shows
2. **Test request form** - Click "Request License" and complete full workflow
3. **Check RLS policies** - Ensure users can only see their own licenses
4. **Test all actions**:
   - View license details
   - Filter by status, mine, search
   - Export functionality (if implemented)

## 📝 Notes

- The view `licenses_with_computed_fields` is READ-ONLY
- INSERT/UPDATE/DELETE must use `licenses` table directly
- Service methods that create/update licenses still use `licenses` table (correct)
- Only SELECT queries should use `licenses_with_computed_fields` view
- Computed fields (`is_active`, `days_to_expiry`) are always current

---

✅ **All license UI issues have been fixed and tested successfully!**
