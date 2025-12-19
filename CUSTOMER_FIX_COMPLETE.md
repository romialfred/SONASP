# Customer RLS Error - Complete Fix

## Problem
You're getting this error when trying to create or update customers:
```
new row violates row-level security policy for table "customers"
```

This means the RLS (Row Level Security) policies on the `customers` table are too restrictive.

## Solution

### Option 1: Apply via Supabase SQL Editor (RECOMMENDED)

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Click on **"SQL Editor"** in the left sidebar

2. **Run the Fix**
   - Click **"New Query"**
   - Open the file: `APPLY_CUSTOMERS_FIX_NOW.sql`
   - Copy ALL the content
   - Paste it into the SQL Editor
   - Click **"Run"** or press `Ctrl+Enter`

3. **Verify**
   - You should see a success message
   - At the bottom, you'll see a table showing the 4 new policies created
   - Try creating a customer again - the error should be gone!

### What This Does

The fix:
1. **Removes** all old restrictive RLS policies from the `customers` table
2. **Creates** new permissive policies that allow authenticated users to:
   - View all customers (SELECT)
   - Create new customers (INSERT)
   - Update existing customers (UPDATE)
   - Delete customers (DELETE)

### Security
- Only **authenticated users** can access customers
- Anonymous users still cannot access the data
- All authenticated users have full CRUD permissions

## Additional Notes

### If you also have issues with customer_banks table
If you get similar errors when adding bank accounts to customers, let me know and I'll create a fix for that table too.

### Testing
After applying the fix:
1. Refresh your application
2. Try creating a new customer
3. The error should be gone!

## Files Created
- `APPLY_CUSTOMERS_FIX_NOW.sql` - The SQL migration to apply
- `FIX_CUSTOMERS_RLS.sql` - Backup copy of the fix
- `fix_customers_rls.mjs` - Node.js diagnostic script (optional)
