# Export License System - Quick Reference Card

## 🚀 Quick Start

### Access the System
- **Factory Users**: Sidebar → "Export Licenses"
- **Management**: Sidebar → "Export Licenses"
- **URL**: `/licenses`

### Key Routes
```
/licenses                    - License dashboard
/licenses/requests/new       - Create license request
/licenses/:id               - View license details
```

## 📊 Key Concepts

### License Lifecycle
```
REGISTERED → ACTIVE → EXPIRED/CLOSED
```

### Request Lifecycle
```
DRAFT → SUBMITTED → IN_REVIEW → APPROVED/REJECTED
```

### Traffic Lights
- 🟢 **GREEN**: Healthy (>25% quota, >15 days)
- 🟡 **YELLOW**: Warning (15-25% OR 7-15 days)
- 🔴 **RED**: Critical (<10% OR <7 days)
- ⚫ **GRAY**: Closed

## 💻 Developer Usage

### Import Services
```typescript
import { licenseService } from '@/services/licenseService';
import { licenseValidationService } from '@/services/licenseValidationService';
import { licenseRequestService } from '@/services/licenseRequestService';
```

### Validate Export
```typescript
const validation = await licenseValidationService.validateExportCreation({
  mineId: 'mine-uuid',
  exportQuantityOz: 100.000,
  exportDate: '2025-11-08',
});

if (!validation.valid) {
  console.error('Cannot proceed:', validation.errors);
}
```

### Reserve Quota
```typescript
await licenseService.reserveQuota({
  license_id: 'license-uuid',
  quantity_oz: 100.000,
  batch_id: 'batch-uuid',
  reason: 'Batch export reservation',
});
```

### Consume Quota
```typescript
await licenseService.consumeQuota({
  license_id: 'license-uuid',
  quantity_oz: 100.000,
  export_id: 'export-uuid',
  batch_number: 'BATCH-001',
});
```

### Release Quota (Rollback)
```typescript
await licenseService.releaseQuota({
  license_id: 'license-uuid',
  quantity_oz: 100.000,
  reason: 'Export cancelled',
});
```

## 🗃️ Database Quick Queries

### Check Active Licenses
```sql
SELECT license_number, remaining_qty_oz, days_to_expiry
FROM licenses
WHERE status = 'ACTIVE'
ORDER BY days_to_expiry ASC;
```

### Find Expiring Soon
```sql
SELECT * FROM licenses
WHERE days_to_expiry BETWEEN 0 AND 15
  AND status = 'ACTIVE';
```

### Check Quota Transactions
```sql
SELECT * FROM license_quota_transactions
WHERE license_id = 'your-license-id'
ORDER BY transaction_date DESC
LIMIT 10;
```

### Audit Trail
```sql
SELECT event_type, event_description, user_name, event_at
FROM license_events
WHERE license_id = 'your-license-id'
ORDER BY event_at DESC;
```

## 🎨 UI Component Usage

### License Selector
```tsx
import { LicenseSelector } from '@/components/licenses/LicenseSelector';

<LicenseSelector
  mineId={mineId}
  exportQuantityOz={quantity}
  exportDate={date}
  selectedLicenseId={licenseId}
  onChange={(id) => setLicenseId(id)}
  onValidationChange={(validation) => setValid(validation.valid)}
/>
```

## 🔐 Permissions

### Check Permission
```typescript
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

if (hasPermission(user, PERMISSIONS.LICENSES_CREATE)) {
  // User can create licenses
}
```

### Available Permissions
- `LICENSES_VIEW` - View licenses
- `LICENSES_CREATE` - Register licenses (Management)
- `LICENSES_REQUEST` - Create requests
- `LICENSES_APPROVE` - Approve requests (Management)

## 🐛 Common Issues

### "License not found"
- Check user's `mining_company_id` matches license
- Verify RLS policies allow access
- Ensure license ID is correct

### "Insufficient quota"
- Check `remaining_qty_oz` in database
- Look for stale reservations
- Release cancelled export quotas

### "Validation failed"
- Verify export date within license validity
- Check quota availability
- Ensure license status is ACTIVE

## 📞 Support

### Error Codes
- `QUOTA_INSUFFICIENT` - Not enough quota remaining
- `LICENSE_EXPIRED` - License past expiry date
- `LICENSE_INVALID` - License not active or not found
- `DATE_OUT_OF_RANGE` - Export date outside validity

### Debug Mode
```typescript
// Enable detailed logging
const validation = await licenseService.validateLicenseForExport(
  mineId,
  quantity,
  date
);
console.log('Validation:', validation);
```

## 📚 Documentation Links

- **Implementation**: `EXPORT_LICENSE_SYSTEM_IMPLEMENTATION.md`
- **Deployment**: `LICENSE_SYSTEM_DEPLOYMENT_GUIDE.md`
- **Summary**: `LICENSE_SYSTEM_FINAL_SUMMARY.md`

---

**Version**: 1.0.0
**Last Updated**: 2025-11-08
