# Export License System - Production Deployment Guide

## Pre-Deployment Checklist

### 1. Database Preparation

- [ ] Backup current production database
- [ ] Review migration file for any conflicts
- [ ] Verify mining_companies table exists with active records
- [ ] Confirm user_profiles table has role column
- [ ] Test migration on staging environment first

### 2. Storage Bucket Setup

- [ ] Create `license-documents` storage bucket in Supabase
- [ ] Set bucket to private (public: false)
- [ ] Configure file size limit to 10MB
- [ ] Set up CORS policies if needed

### 3. Code Review

- [ ] Verify all TypeScript types are exported correctly
- [ ] Check all imports resolve properly
- [ ] Ensure no console.error in production code
- [ ] Validate all environment variables are set

## Deployment Steps

### Step 1: Apply Database Migration

**Option A: Via Supabase Dashboard SQL Editor**

```sql
-- Navigate to: Supabase Dashboard → SQL Editor → New Query
-- Copy and paste contents of:
-- supabase/migrations/20251108000000_create_export_license_system.sql
-- Click "Run" to execute
```

**Option B: Via Supabase CLI (if configured)**

```bash
supabase db push
```

**Verify Migration Success:**

```sql
-- Check tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'license_requests',
  'license_request_documents',
  'licenses',
  'license_quota_transactions',
  'license_events',
  'license_kpi_thresholds'
);

-- Should return 6 rows

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'license%';

-- All should show rowsecurity = true
```

### Step 2: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `license-documents`
4. Public: **No** (keep private)
5. File size limit: `10485760` (10MB)
6. Allowed MIME types: `application/pdf,image/jpeg,image/png`

**Verify with SQL:**

```sql
SELECT * FROM storage.buckets WHERE name = 'license-documents';
```

### Step 3: Verify RLS Policies

**Check license_requests policies:**

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'license_requests';
```

**Expected policies:**
- Users can view license requests from their mine (SELECT)
- Users can create license requests for their mine (INSERT)
- Users can update their draft license requests (UPDATE)

**Check licenses policies:**

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'licenses';
```

**Expected policies:**
- Users can view licenses from their mine (SELECT)
- Management can create licenses (INSERT)
- Management can update licenses (UPDATE)

### Step 4: Seed Initial Configuration

```sql
-- Verify default thresholds were created
SELECT * FROM license_kpi_thresholds;

-- Should show:
-- 1. Quota Low Warning: 25% warning, 10% critical
-- 2. Expiry Warning: 30 days warning, 15 days critical

-- Adjust thresholds if needed
UPDATE license_kpi_thresholds
SET warning_value = 30, critical_value = 20
WHERE threshold_name = 'Quota Low Warning';
```

### Step 5: Deploy Frontend

**Build and Deploy:**

```bash
# Ensure all dependencies installed
npm install

# Run type checking
npm run typecheck

# Build production bundle
npm run build

# Deploy dist/ folder to your hosting platform
# (Vercel, Netlify, AWS S3, etc.)
```

**Verify Build:**
- Check no TypeScript errors
- Verify bundle size is reasonable (<4MB gzipped)
- Confirm all routes are included

### Step 6: Post-Deployment Verification

**Test Core Functionality:**

1. **Navigation**
   - [ ] License menu appears in sidebar
   - [ ] Routes are accessible
   - [ ] Back buttons work correctly

2. **License Requests**
   - [ ] Can create new request
   - [ ] Document upload works
   - [ ] Draft saving functions
   - [ ] Submission succeeds
   - [ ] Request appears in listing

3. **License Management**
   - [ ] Can view license listing
   - [ ] KPI tiles display correctly
   - [ ] Filters work properly
   - [ ] Detail page shows all information
   - [ ] Traffic light evaluation displays

4. **Validation**
   - [ ] License selector shows available licenses
   - [ ] Validation errors appear correctly
   - [ ] Quota warnings display
   - [ ] Blocking works when no valid license

## User Setup

### For Testing

**Create Test Mining Company (if needed):**

```sql
INSERT INTO mining_companies (name, status, country, contact_email)
VALUES ('Test Mining Co', 'active', 'GN', 'test@mining.com')
RETURNING id;
```

**Create Test License:**

```sql
-- Use the mining company ID from above
INSERT INTO licenses (
  license_number,
  applicant_mine_id,
  applicant_company_name,
  applicant_signatory,
  issuer_organization,
  issuer_signatory,
  issuer_country,
  request_date,
  issue_date,
  expiry_date,
  authorized_qty_oz,
  theoretical_price_usd_per_oz
) VALUES (
  'LIC-TEST-001',
  '<mining_company_id>',
  'Test Mining Co',
  'John Doe',
  'Ministère des Mines',
  'Minister Smith',
  'GN',
  CURRENT_DATE - INTERVAL '10 days',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '180 days',
  1000.000,
  2000.00
);
```

**Assign User to Mining Company:**

```sql
UPDATE user_profiles
SET mining_company_id = '<mining_company_id>'
WHERE email = 'your-test-user@example.com';
```

## Monitoring & Maintenance

### Daily Checks

```sql
-- Check for expiring licenses (next 15 days)
SELECT
  license_number,
  applicant_company_name,
  expiry_date,
  days_to_expiry,
  remaining_qty_oz,
  remaining_percentage
FROM licenses
WHERE days_to_expiry BETWEEN 0 AND 15
  AND status = 'ACTIVE'
ORDER BY days_to_expiry ASC;

-- Check for low quota licenses (<25%)
SELECT
  license_number,
  applicant_company_name,
  authorized_qty_oz,
  remaining_qty_oz,
  remaining_percentage
FROM licenses
WHERE remaining_percentage < 25
  AND status = 'ACTIVE'
ORDER BY remaining_percentage ASC;
```

### Weekly Reports

```sql
-- License utilization summary
SELECT
  COUNT(*) as total_licenses,
  SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
  SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed,
  ROUND(SUM(authorized_qty_oz), 3) as total_authorized,
  ROUND(SUM(consumed_qty_oz), 3) as total_consumed,
  ROUND(SUM(remaining_qty_oz), 3) as total_remaining
FROM licenses;

-- Recent license requests
SELECT
  request_number,
  mine_name,
  status,
  planned_quantity_oz,
  request_date
FROM license_requests
WHERE request_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY request_date DESC;
```

### Performance Monitoring

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE tablename LIKE 'license%'
ORDER BY idx_scan DESC;

-- Slow query identification
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%license%'
ORDER BY mean_time DESC
LIMIT 10;
```

## Troubleshooting

### Issue: "License not found" errors

**Diagnosis:**
```sql
-- Check RLS policies allow user access
SELECT * FROM licenses WHERE id = '<license_id>';
-- If no results, check user's mining_company_id matches
```

**Solution:**
- Verify user's `mining_company_id` in `user_profiles`
- Check license's `applicant_mine_id` matches
- Ensure user role has proper permissions

### Issue: Quota reservation failures

**Diagnosis:**
```sql
-- Check current quota state
SELECT
  id,
  license_number,
  authorized_qty_oz,
  reserved_qty_oz,
  consumed_qty_oz,
  remaining_qty_oz
FROM licenses
WHERE id = '<license_id>';
```

**Solution:**
- Verify `remaining_qty_oz` is sufficient
- Check for stale reservations:
  ```sql
  SELECT * FROM license_quota_transactions
  WHERE license_id = '<license_id>'
  ORDER BY transaction_date DESC
  LIMIT 10;
  ```
- Release stuck reservations if needed

### Issue: Storage upload errors

**Diagnosis:**
- Check bucket exists: `SELECT * FROM storage.buckets WHERE name = 'license-documents'`
- Verify file size under 10MB
- Check MIME type is allowed

**Solution:**
```sql
-- Create bucket if missing
INSERT INTO storage.buckets (id, name, public)
VALUES ('license-documents', 'license-documents', false);

-- Update bucket policies
-- Go to Supabase Dashboard → Storage → license-documents → Policies
```

### Issue: Migration conflicts

**Rollback procedure:**
```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS license_events CASCADE;
DROP TABLE IF EXISTS license_quota_transactions CASCADE;
DROP TABLE IF EXISTS license_kpi_thresholds CASCADE;
DROP TABLE IF EXISTS license_request_documents CASCADE;
DROP TABLE IF EXISTS license_requests CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;

-- Drop types
DROP TYPE IF EXISTS license_request_status CASCADE;
DROP TYPE IF EXISTS license_status CASCADE;
DROP TYPE IF EXISTS license_event_type CASCADE;
DROP TYPE IF EXISTS quota_transaction_type CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS license_request_seq CASCADE;

-- Remove column from batches
ALTER TABLE batches DROP COLUMN IF EXISTS license_id;
```

## Security Best Practices

### 1. API Key Management

- Never expose Supabase anon key in client-side code comments
- Rotate service role key periodically
- Use RLS policies instead of service role where possible

### 2. File Upload Security

- Validate file types on server
- Implement virus scanning for production
- Set reasonable file size limits
- Generate unique filenames to prevent overwrites

### 3. Audit Trail

- Regularly export audit logs to external system
- Set up alerts for suspicious activities
- Monitor failed license validations
- Track quota anomalies

### 4. Data Retention

```sql
-- Archive old expired licenses (older than 2 years)
CREATE TABLE IF NOT EXISTS licenses_archive AS
SELECT * FROM licenses WHERE 1=0;

-- Move expired licenses
INSERT INTO licenses_archive
SELECT * FROM licenses
WHERE status = 'EXPIRED'
  AND expiry_date < CURRENT_DATE - INTERVAL '2 years';

-- Delete after archiving
DELETE FROM licenses
WHERE status = 'EXPIRED'
  AND expiry_date < CURRENT_DATE - INTERVAL '2 years';
```

## Training & User Onboarding

### For Mining Companies

1. **License Request Process**
   - Show how to navigate to request form
   - Demonstrate document upload
   - Explain approval workflow timeline

2. **License Tracking**
   - How to view active licenses
   - Understanding traffic light indicators
   - Monitoring quota consumption

3. **Integration with Exports**
   - License selection during batch creation
   - Understanding blocking messages
   - When to apply for new licenses

### For Management

1. **License Registration**
   - How to register issued licenses
   - PDF upload and validation
   - Manual data entry best practices

2. **Monitoring Dashboard**
   - Reading KPI tiles
   - Filtering and searching
   - Export options

3. **Request Review**
   - Accessing pending requests
   - Approval workflow
   - Rejection with comments

## Support & Escalation

### Common Support Tickets

| Issue | First Response | Escalation Path |
|-------|---------------|-----------------|
| Cannot create request | Check mining company assignment | Database admin |
| Upload fails | Verify file size/type | Storage team |
| Validation errors | Review license dates/quota | Development team |
| Missing licenses | Check RLS policies | Database admin |

### Contact Points

- **Technical Issues**: development-team@company.com
- **Database Issues**: dba@company.com
- **User Training**: training@company.com
- **Emergency**: on-call-engineer@company.com

## Success Metrics

### KPIs to Track

1. **Adoption Rate**
   - % of exports using licenses
   - Number of active licenses
   - License request volume

2. **Compliance Rate**
   - % exports blocked for invalid licenses
   - Average time to license approval
   - Number of quota overruns (should be 0)

3. **Operational Efficiency**
   - Time to create license request
   - Document upload success rate
   - Average quota utilization per license

### Weekly Dashboard

```sql
-- Generate weekly metrics
SELECT
  'License Requests Created' as metric,
  COUNT(*) as value
FROM license_requests
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT
  'Licenses Activated',
  COUNT(*)
FROM licenses
WHERE status = 'ACTIVE'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT
  'Total Quota Reserved (oz)',
  ROUND(SUM(quantity_oz), 2)
FROM license_quota_transactions
WHERE transaction_type = 'RESERVE'
  AND transaction_date >= CURRENT_DATE - INTERVAL '7 days';
```

## Conclusion

This deployment guide ensures a smooth rollout of the Export License Management System. Follow each step carefully, verify at each stage, and monitor closely during the first week post-deployment.

For questions or issues not covered in this guide, contact the development team immediately.

**Deployment Checklist Completion:**
- [ ] All pre-deployment checks passed
- [ ] Migration applied successfully
- [ ] Storage bucket created
- [ ] Frontend deployed
- [ ] Post-deployment tests completed
- [ ] Users trained
- [ ] Monitoring dashboards set up
- [ ] Support team briefed

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**Next Review**: After first month in production
