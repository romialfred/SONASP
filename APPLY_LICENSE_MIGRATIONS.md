# Apply License Management Migrations

## Quick Start Guide

Follow these steps to enable the License Management system with sample data.

### Step 1: Apply the License System Migration

This creates all the necessary tables, enums, triggers, and RLS policies.

```sql
-- Copy and paste the contents of:
-- supabase/migrations/20251108000000_create_export_license_system.sql
-- into the Supabase SQL Editor and execute
```

**What this creates:**
- `license_requests` table - For license applications
- `license_request_documents` table - Multi-document attachments
- `licenses` table - Master registry of issued licenses
- `license_quota_transactions` table - Audit trail of quota usage
- `license_events` table - Complete event logging
- `license_kpi_thresholds` table - Configurable alert thresholds
- All necessary enums, triggers, and RLS policies
- Links to batches table via `license_id` column

### Step 2: Apply the Sample Data Migration

This creates 10 sample licenses spanning 8 months with realistic test data.

```sql
-- Copy and paste the contents of:
-- supabase/migrations/20251108100000_seed_license_sample_data.sql
-- into the Supabase SQL Editor and execute
```

**What this creates:**
- 10 licenses (LIC-2024-0001 through LIC-2024-0010)
- Date range: April 2024 - November 2024
- Mix of statuses: ACTIVE, EXPIRED, REGISTERED
- Various quota levels and consumption rates
- Associated events and transactions
- License requests in different stages
- Links existing batches to licenses
- KPI thresholds for traffic light system

### Step 3: Verify the Data

Check that everything was created successfully:

```sql
-- Count licenses
SELECT COUNT(*) as total_licenses FROM licenses;
-- Should return 10

-- View license summary
SELECT
  license_number,
  status,
  issue_date,
  expiry_date,
  authorized_quantity_oz,
  remaining_qty_oz,
  remaining_percentage
FROM licenses
ORDER BY created_at DESC;

-- Check linked batches
SELECT
  l.license_number,
  COUNT(b.id) as batch_count
FROM licenses l
LEFT JOIN batches b ON b.license_id = l.id
WHERE l.license_number LIKE 'LIC-2024-%'
GROUP BY l.license_number
ORDER BY l.license_number;

-- View traffic light evaluation
SELECT
  license_number,
  status,
  remaining_percentage,
  days_to_expiry,
  CASE
    WHEN status = 'EXPIRED' THEN 'RED'
    WHEN days_to_expiry < 10 OR remaining_percentage < 10 THEN 'RED'
    WHEN days_to_expiry < 30 OR remaining_percentage < 25 THEN 'YELLOW'
    WHEN status = 'ACTIVE' THEN 'GREEN'
    ELSE 'GRAY'
  END as traffic_light
FROM licenses
WHERE license_number LIKE 'LIC-2024-%'
ORDER BY traffic_light, license_number;
```

## Sample Data Overview

### Licenses Created

| License Number | Issue Date | Expiry Date | Status | Quota (oz) | Used (oz) | Traffic Light |
|----------------|-----------|-------------|---------|-----------|----------|---------------|
| LIC-2024-0001 | Apr 1, 2024 | Jun 30, 2024 | EXPIRED | 1,607 | 1,543 | RED |
| LIC-2024-0002 | Apr 26, 2024 | Jul 25, 2024 | EXPIRED | 2,090 | 2,027 | RED |
| LIC-2024-0003 | May 21, 2024 | Aug 19, 2024 | EXPIRED | 2,574 | 1,930 | RED |
| LIC-2024-0004 | Jun 15, 2024 | Sep 13, 2024 | EXPIRED | 3,057 | 2,255 | RED |
| LIC-2024-0005 | Jul 10, 2024 | Oct 8, 2024 | EXPIRED | 3,541 | 1,448 | RED |
| LIC-2024-0006 | Aug 4, 2024 | Nov 2, 2024 | ACTIVE | 4,024 | 1,610 | YELLOW |
| LIC-2024-0007 | Aug 29, 2024 | Nov 27, 2024 | ACTIVE | 4,508 | 0 | GREEN |
| LIC-2024-0008 | Sep 23, 2024 | Dec 22, 2024 | ACTIVE | 4,991 | 0 | GREEN |
| LIC-2024-0009 | Oct 18, 2024 | Jan 16, 2025 | REGISTERED | 5,475 | 0 | GRAY |
| LIC-2024-0010 | Nov 12, 2024 | Feb 10, 2025 | REGISTERED | 5,958 | 0 | GRAY |

### Test Scenarios Included

✅ **Active licenses** with available quota (GREEN)
✅ **Nearly exhausted licenses** triggering critical alerts (RED)
✅ **Soon-to-expire licenses** with warnings (YELLOW)
✅ **Expired licenses** for historical tracking (RED)
✅ **New registered licenses** awaiting activation (GRAY)
✅ **Associated batches** linked to licenses
✅ **Quota transactions** showing consumption history
✅ **Audit events** for compliance tracking
✅ **License requests** in various approval stages

## Features Now Available

### 1. License Management Dashboard
- KPI tiles showing total licenses, active, expiring soon, and quota usage
- Traffic light indicators for quick status assessment
- Advanced filtering by status, date range, and mining company
- Real-time quota and expiry calculations

### 2. License Details Page
- **Overview Tab**: Complete license information and evaluation
- **Associated Batches Tab**: All batches using this license with full details
- **Quota Transactions Tab**: Complete audit trail of quota usage
- **Audit Trail Tab**: Event log for compliance

### 3. License Request System
- 3-step wizard for new license applications
- Document upload with versioning
- Approval workflow tracking
- Digital signature capture

### 4. Export Validation
- Automatic blocking when no valid license available
- Quota validation before batch creation
- Real-time remaining quantity calculations
- Traffic light warnings for near-expiry or low quota

## Troubleshooting

### If you see "License Not Found" errors:

1. **Check migrations were applied:**
```sql
SELECT * FROM licenses LIMIT 1;
```

2. **Verify RLS policies allow access:**
```sql
-- Check your user has management or factory role
SELECT id, email, role FROM user_profiles WHERE id = auth.uid();
```

3. **Check if sample data was inserted:**
```sql
SELECT COUNT(*) FROM licenses WHERE license_number LIKE 'LIC-2024-%';
```

### If batches don't show on detail page:

1. **Verify license_id column exists:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'batches' AND column_name = 'license_id';
```

2. **Check if batches are linked:**
```sql
SELECT b.batch_number, l.license_number
FROM batches b
JOIN licenses l ON l.id = b.license_id
WHERE l.license_number LIKE 'LIC-2024-%'
LIMIT 10;
```

## Next Steps

1. ✅ Navigate to **License Management** in sidebar
2. ✅ View the license listing with KPI tiles
3. ✅ Click on any license to see details and associated batches
4. ✅ Try creating a new license request
5. ✅ Test the traffic light evaluation system
6. ✅ Create a batch and link it to a license

## Support

If you encounter any issues:
1. Check the browser console for JavaScript errors
2. Check Supabase logs for database errors
3. Verify all migrations were applied in order
4. Ensure your user profile has the correct role assigned
