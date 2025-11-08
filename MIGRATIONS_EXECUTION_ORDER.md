# Database Migrations - Execution Order

## Complete List of Migrations to Execute

Execute these migrations **in order** in the Supabase SQL Editor.

---

## Core System Migrations (Execute First)

### 1. Reports System
**File:** `20251101120000_create_reports_system.sql`
**Purpose:** Creates reporting infrastructure
**Tables:** `reports`, `report_schedules`, `report_history`

---

### 2. Storage Buckets
**File:** `20251101130000_create_storage_buckets.sql`
**Purpose:** Creates storage buckets for documents
**Buckets:** `batch-documents`, `assay-certificates`, `licenses`

---

## Sales & Payment Workflow (Execute in Order)

### 3. Clean Sales Status Transitions
**File:** `20251102140000_clean_sales_status_transitions.sql`
**Purpose:** Removes old/invalid status transitions

---

### 4. Insert New Sales Status Transitions
**File:** `20251102140001_insert_new_sales_status_transitions.sql`
**Purpose:** Creates proper sales workflow transitions
**Required After:** Migration #3

---

### 5. Update Sales Table Schema
**File:** `20251102140002_update_sales_table_schema.sql`
**Purpose:** Adds seller fields, payment tracking

---

### 6. Update Payments Table Schema
**File:** `20251102140003_update_payments_table_schema.sql`
**Purpose:** Adds payment type, bank fields

---

### 7. FX Rate Analysis Table
**File:** `20251102140004_ensure_fx_rate_analysis_table.sql`
**Purpose:** Creates FX rate comparison system

---

### 8. Virtual Payment Triggers
**File:** `20251102140005_create_virtual_payment_triggers.sql`
**Purpose:** Auto-creates virtual payments on sale approval

---

### 9. Status Transition Triggers
**File:** `20251102140006_create_status_transition_triggers.sql`
**Purpose:** Sales workflow automation

---

### 10. Reception Tracking Columns
**File:** `20251102140007_add_reception_tracking_columns.sql`
**Purpose:** Adds tracking fields for shipment reception

---

### 11. Fix Management Approved Transition
**File:** `20251102150000_fix_management_approved_transition.sql`
**Purpose:** Fixes workflow issue with management approval

---

### 12. Customer Banks Table
**File:** `20251102160000_create_customer_banks_table.sql`
**Purpose:** Customer banking information
**Table:** `customer_banks`

---

### 13. Physical Payment Trigger
**File:** `20251103000000_add_physical_payment_trigger.sql`
**Purpose:** Handles physical payment workflow

---

## Feature Modules (Execute in Order)

### 14. Pre-Sales Module
**File:** `20251103000000_create_presales_module.sql`
**Purpose:** Pre-sales tracking system
**Tables:** `pre_sales`, `pre_sales_status_transitions`

---

### 15. Assay Certificates System
**File:** `20251104000000_create_assay_certificates_system.sql`
**Purpose:** Certificate management and parsing
**Tables:** `assay_certificates`, `assay_data_entries`

---

### 16. Batch Documents System (v1)
**File:** `20251105000000_create_batch_documents_system.sql`
**Purpose:** Document management for batches
**Note:** May have issues, replaced by next migration

---

### 17. Batch Documents System (Fixed)
**File:** `20251105000001_create_batch_documents_fixed.sql`
**Purpose:** Fixed version of batch documents
**Tables:** `batch_documents`
**Replaces:** Migration #16

---

### 18. Enhanced User Activation System
**File:** `20251106000000_create_enhanced_user_activation_system.sql`
**Purpose:** User activation and email system
**Tables:** `user_activation_tokens`

---

## License Management System (Execute Last)

### 19. Export License System ⭐
**File:** `20251108000000_create_export_license_system.sql`
**Purpose:** Complete license management system
**Tables:**
- `license_requests`
- `license_request_documents`
- `licenses`
- `license_quota_transactions`
- `license_events`
- `license_kpi_thresholds`

**Enums:**
- `license_request_status`
- `license_status`
- `license_event_type`
- `quota_transaction_type`

**Also Creates:**
- Adds `license_id` column to `batches` table
- RLS policies for all tables
- Triggers for automatic status updates
- Functions for quota management

---

### 20. License Sample Data ⭐ NEW
**File:** `20251108100000_seed_license_sample_data.sql`
**Purpose:** Sample data for testing license system
**Creates:**
- 10 sample licenses (8 months of data)
- License events and transactions
- License requests
- KPI thresholds
- Links existing batches to licenses

**⚠️ IMPORTANT:** Execute AFTER migration #19

---

## Quick Execution Steps

### Option 1: Execute All (Recommended)

Copy each migration file content and execute in the order listed above.

### Option 2: Execute Only License System (If others already applied)

If your database already has the core system:

```sql
-- 1. License System (Core)
-- Copy and execute: 20251108000000_create_export_license_system.sql

-- 2. License Sample Data (NEW)
-- Copy and execute: 20251108100000_seed_license_sample_data.sql
```

---

## Verification After Execution

### Check All Tables Created

```sql
-- Count migrations applied
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';

-- Check license tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'license%'
ORDER BY table_name;
```

### Verify License Sample Data

```sql
-- Should return 10
SELECT COUNT(*) FROM licenses;

-- Show sample licenses
SELECT
  license_number,
  status,
  issue_date,
  expiry_date,
  ROUND(remaining_qty_oz::numeric, 2) as remaining_oz,
  days_to_expiry
FROM licenses
WHERE license_number LIKE 'LIC-2024-%'
ORDER BY created_at;
```

### Check Batches Linked to Licenses

```sql
-- Should show some batches with license_id
SELECT
  b.batch_number,
  l.license_number,
  b.status
FROM batches b
INNER JOIN licenses l ON l.id = b.license_id
LIMIT 10;
```

---

## Troubleshooting

### If a migration fails:

1. **Read the error message carefully**
2. **Check if table already exists:**
   ```sql
   SELECT * FROM information_schema.tables
   WHERE table_name = 'your_table_name';
   ```
3. **Check if column already exists:**
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'your_table_name';
   ```
4. **Most migrations use `IF NOT EXISTS`** - they're safe to re-run

### Common Issues:

**"relation already exists"**
- Migration already applied, skip to next one

**"column already exists"**
- Partial migration applied, check what's missing

**"permission denied"**
- Check you're logged in as database owner

**"syntax error"**
- Copy the entire file content, don't truncate

---

## Priority Migrations for License System

If you only want the **License Management** feature working:

### Minimum Required:
1. ✅ Migration #19: `create_export_license_system.sql`
2. ✅ Migration #20: `seed_license_sample_data.sql`

### Recommended (for full features):
- Migration #2: Storage buckets (for license PDFs)
- Migration #12: Customer banks (for exports)
- Migration #14: Pre-sales (for workflow)

---

## Summary

- **Total Migrations:** 20
- **Core System:** Migrations 1-13
- **Feature Modules:** Migrations 14-18
- **License System:** Migrations 19-20 ⭐
- **New Sample Data:** Migration 20 ⭐

**Execution Time:** ~5-10 minutes for all migrations

**Status Indicators:**
- ✅ = Must execute
- ⭐ = Required for License Management
- ⚠️ = Has dependencies, check order
