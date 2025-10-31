# Seed Migration Verification Guide

## Purpose
Determine whether to run the original seed migration (`20251101000007_seed_mansa_ressources_customer.sql`) or the SAFE version.

## Current Situation

You have **real production data** already in your database:
- Real mining companies
- Real customers including Auramet and StoneX (from migration `20251029090000`)

## Migration Options

### Option 1: Original Migration (NOT RECOMMENDED)
**File:** `20251101000007_seed_mansa_ressources_customer.sql`

**Uses fixed UUIDs:**
```sql
-- Fixed UUID approach (DANGEROUS with existing data)
'550e8400-e29b-41d4-a716-446655440000'  -- Mansa Mining
'550e8400-e29b-41d4-a716-446655440001'  -- Mansa Customer
'550e8400-e29b-41d4-a716-446655440002'  -- Auramet
'550e8400-e29b-41d4-a716-446655440003'  -- StoneX
```

**Problems:**
- Will fail if these UUIDs already exist
- May conflict with existing Auramet/StoneX records
- Cannot handle existing data gracefully

### Option 2: SAFE Migration (RECOMMENDED) ✓
**File:** `20251101000007_seed_mansa_ressources_customer_SAFE.sql`

**Uses dynamic ID lookup:**
```sql
-- Dynamic approach (SAFE with existing data)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;
```

**Benefits:**
- Works with existing Auramet and StoneX records
- Uses database-generated UUIDs
- Safe to run multiple times
- Checks for existing data before inserting
- Provides comprehensive verification reporting

## Verification Steps

### Step 1: Run Verification Query

Execute the verification SQL script provided:

```bash
# Connect to your Supabase database and run:
psql $DATABASE_URL -f verify_existing_data.sql
```

Or run directly in Supabase SQL Editor:
```sql
-- Check what currently exists
SELECT id, name, code FROM mining_companies ORDER BY created_at DESC;
SELECT id, name, email FROM customers ORDER BY created_at DESC;
```

### Step 2: Analyze Results

Look for:
1. **Mansa Ressources** in mining_companies (code = 'MANSA-SA')
2. **Mansa Ressources** in customers (email = 'sales@mansaressources.com')
3. **Auramet International** (email = 'trading@auramet.com')
4. **StoneX Group Inc.** (email = 'metals@stonex.com')

### Step 3: Decision Matrix

| Scenario | Recommendation | Action |
|----------|----------------|--------|
| No Mansa Ressources exists | Use SAFE migration | Proceed with confidence |
| Mansa exists, no Auramet/StoneX | Use SAFE migration | Will skip Mansa, fail gracefully |
| All entities exist | Skip migration | Already seeded |
| Mixed scenario | Use SAFE migration | Handles all cases |

## Recommended Action

**Use the SAFE migration:** `20251101000007_seed_mansa_ressources_customer_SAFE.sql`

### Why SAFE is Always Better

1. **Idempotent**: Can run multiple times safely
2. **Graceful Handling**: Works with existing or new data
3. **No Conflicts**: Uses ON CONFLICT clauses
4. **Verification**: Provides detailed output of what was created/found
5. **Production Ready**: Designed for real-world scenarios

## How to Apply the SAFE Migration

### Using Supabase Dashboard

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy contents of `20251101000007_seed_mansa_ressources_customer_SAFE.sql`
4. Execute the migration
5. Review the NOTICE messages for verification

### Expected Output

You should see messages like:
```
NOTICE: ✓ Auramet International already exists in customers table
NOTICE: ✓ StoneX Group Inc. already exists in customers table
NOTICE: ✓ Created bank account for Mansa Ressources (mining company)
NOTICE: ✓ Created bank account for Mansa Ressources (customer)
=== SEED DATA VERIFICATION ===
NOTICE: ✓ Mansa Ressources (Mining Company): <uuid>
NOTICE: ✓ Mansa Ressources (Customer): <uuid>
NOTICE: ✓ Auramet International: <uuid>
NOTICE: ✓ StoneX Group Inc.: <uuid>
=== END VERIFICATION ===
```

## What Gets Created

The SAFE migration will create/verify:

1. **Mansa Ressources S.A** as Mining Company
   - Code: MANSA-SA
   - Contact: contact@mansaressources.com
   - Bank: Société Générale Guinea (USD)

2. **Mansa Ressources S.A** as Customer
   - Email: sales@mansaressources.com
   - Bank: Société Générale Guinea (USD)

3. **Auramet International** (if exists)
   - Bank: JP Morgan Chase (USD)

4. **StoneX Group Inc.** (if exists)
   - Bank: Bank of America (USD)

## Cleanup (If Needed)

If you already ran the original migration and have issues:

```sql
-- Remove any problematic seed data
DELETE FROM customer_banks WHERE bank_name IN ('JP Morgan Chase', 'Bank of America', 'Société Générale Guinea');
DELETE FROM stakeholder_bank_accounts WHERE account_name LIKE '%Mansa Ressources%';
DELETE FROM customers WHERE email IN ('sales@mansaressources.com', 'trading@auramet.com', 'metals@stonex.com');
DELETE FROM mining_companies WHERE code = 'MANSA-SA';

-- Then run the SAFE migration
```

## Verification After Migration

Run this query to confirm everything is correct:

```sql
-- Verify all entities exist
SELECT * FROM mansa_ressources_reference;

-- Check bank accounts
SELECT
  sb.stakeholder_type,
  mc.name as mining_company,
  sb.bank_name,
  sb.account_currency
FROM stakeholder_bank_accounts sb
LEFT JOIN mining_companies mc ON sb.stakeholder_id = mc.id AND sb.stakeholder_type = 'mining_company'
WHERE sb.stakeholder_type = 'mining_company';

SELECT
  c.name as customer,
  cb.bank_name,
  cb.currency
FROM customer_banks cb
JOIN customers c ON cb.customer_id = c.id;
```

## Final Recommendation

✅ **Execute migration:** `20251101000007_seed_mansa_ressources_customer_SAFE.sql`

This version is specifically designed to work with your existing real data and will handle all scenarios gracefully.
