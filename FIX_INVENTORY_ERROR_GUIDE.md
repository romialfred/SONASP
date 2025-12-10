# Fix Inventory Registration Error

## Problem
When trying to register an inventory entry, you get this error:
```
Error adding inventory entry: Could not find the 'freight_shipment_id' column of 'gold_inventory' in the schema cache
```

## Solution
The `freight_shipment_id` column is missing from the `gold_inventory` table. You need to add it.

## Steps to Fix

### 1. Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### 2. Copy and Execute This SQL

```sql
/*
  # Add freight_shipment_id to gold_inventory

  1. Changes
    - Add freight_shipment_id column to gold_inventory table
    - Add foreign key constraint to freight_shipments table
    - Add index for better query performance

  2. Security
    - No RLS changes needed (inherits from table)
*/

-- Add freight_shipment_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_inventory'
    AND column_name = 'freight_shipment_id'
  ) THEN
    ALTER TABLE gold_inventory
    ADD COLUMN freight_shipment_id uuid REFERENCES freight_shipments(id);

    -- Add index for better query performance
    CREATE INDEX IF NOT EXISTS idx_gold_inventory_freight_shipment
    ON gold_inventory(freight_shipment_id);

    RAISE NOTICE 'Column freight_shipment_id added to gold_inventory table';
  ELSE
    RAISE NOTICE 'Column freight_shipment_id already exists in gold_inventory table';
  END IF;
END $$;
```

### 3. Execute the Query
1. Paste the SQL code into the SQL Editor
2. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
3. You should see a success message

### 4. Verify the Fix
1. Refresh your application
2. Try to register an inventory entry again
3. The error should be resolved

## What This Does
- Adds the `freight_shipment_id` column to the `gold_inventory` table
- Links it to the `freight_shipments` table with a foreign key
- Creates an index for better query performance
- The migration is idempotent (safe to run multiple times)

## After Applying
Once the migration is applied, you'll be able to:
- Register new inventory entries
- Link inventory entries to freight shipments
- Track which shipments have been added to inventory
