# Visual Integration Guide - Batch Management Enhancements

## Overview

This guide explains how to apply the batch management enhancements to the visual interface. All backend functionality is ready, and this document will help you integrate the visual components.

## What's Already Done ✅

### 1. Enhanced UI Components Created
- ✅ `QualityCheckCard.tsx` - Displays quality inspection history
- ✅ `AlertsPanel.tsx` - Shows batch alerts with acknowledge/resolve actions
- ✅ `ApprovalWorkflowCard.tsx` - Displays approval workflows

### 2. Enhanced Batch Details Page
- ✅ `BatchDetailsEnhanced.tsx` - Complete integration of all new features
- ✅ Already integrated in App.tsx routing

### 3. Services Layer
- ✅ All 4 new services exported and ready to use
- ✅ TypeScript interfaces exported for type safety

## Current Visual State

### ✅ Fully Integrated
The **Batch Details page** (`/batches/:id`) now shows:
- Quality checks panel with pass rates
- Active alerts with acknowledge/resolve buttons
- Approval workflow with history
- Hold/release functionality
- Tags display
- Metal type and quality grade badges
- Transportation details (driver, seal number)
- Reservations panel
- Enhanced quick actions (split, merge, quality check)

## Next Steps for Full Visual Integration

### Step 1: Update Batch Listing Page (Recommended)

**File:** `src/pages/batches/BatchListing.tsx`

**Add these features:**

```tsx
import { batchSearchService } from '@/services';

// 1. Add advanced search filters
const [filters, setFilters] = useState<BatchSearchFilters>({
  search_text: '',
  status: [],
  metal_type: [],
  quality_grade: [],
  is_on_hold: undefined,
  has_quality_issues: false,
  has_significant_variance: false,
});

// 2. Add saved searches dropdown
const [savedSearches, setSavedSearches] = useState([]);

// 3. Load batches with advanced search
const loadBatches = async () => {
  const result = await batchSearchService.advancedSearch(filters);
  setBatches(result.data);
};

// 4. Add filter UI components
<div className="filter-panel">
  <input
    placeholder="Search batches..."
    value={filters.search_text}
    onChange={(e) => setFilters({...filters, search_text: e.target.value})}
  />

  <select
    multiple
    value={filters.status}
    onChange={(e) => setFilters({...filters, status: Array.from(e.target.selectedOptions, o => o.value)})}
  >
    <option value="created">Created</option>
    <option value="shipped">Shipped</option>
    <option value="received_airport">Received at Airport</option>
    {/* Add all statuses */}
  </select>

  <select
    multiple
    value={filters.metal_type}
    onChange={(e) => setFilters({...filters, metal_type: Array.from(e.target.selectedOptions, o => o.value)})}
  >
    <option value="gold">Gold</option>
    <option value="silver">Silver</option>
  </select>

  <label>
    <input
      type="checkbox"
      checked={filters.is_on_hold}
      onChange={(e) => setFilters({...filters, is_on_hold: e.target.checked || undefined})}
    />
    On Hold Only
  </label>

  <label>
    <input
      type="checkbox"
      checked={filters.has_quality_issues}
      onChange={(e) => setFilters({...filters, has_quality_issues: e.target.checked})}
    />
    Quality Issues
  </label>

  <button onClick={() => batchSearchService.saveSearch({
    name: prompt('Search name:'),
    filters,
    user_id: 'current-user-id'
  })}>
    Save Search
  </button>

  <button onClick={async () => {
    const csv = await batchSearchService.exportBatches(filters, 'csv');
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batches.csv';
    a.click();
  }}>
    Export CSV
  </button>
</div>
```

### Step 2: Update Batch Create Page (Optional but Recommended)

**File:** `src/pages/batches/BatchCreate.tsx`

**Add new fields:**

```tsx
// Add to form state
const [formData, setFormData] = useState({
  // ... existing fields
  metal_type: 'gold', // NEW
  expected_purity: '', // NEW
  quality_grade: 'ungraded', // NEW
  sealed_container_id: '', // NEW
});

// Add to form UI
<div>
  <label>Metal Type</label>
  <select
    value={formData.metal_type}
    onChange={(e) => setFormData({...formData, metal_type: e.target.value})}
  >
    <option value="gold">Gold</option>
    <option value="silver">Silver</option>
  </select>
</div>

<div>
  <label>Expected Purity (%)</label>
  <input
    type="number"
    step="0.01"
    value={formData.expected_purity}
    onChange={(e) => setFormData({...formData, expected_purity: e.target.value})}
  />
</div>

<div>
  <label>Sealed Container ID</label>
  <input
    type="text"
    value={formData.sealed_container_id}
    onChange={(e) => setFormData({...formData, sealed_container_id: e.target.value})}
  />
</div>
```

### Step 3: Create Modal Components (Recommended)

Create these reusable modal components:

#### A. Quality Check Modal
**File:** `src/components/batch/QualityCheckModal.tsx`

```tsx
import { useState } from 'react';
import { batchEnhancedService } from '@/services';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export function QualityCheckModal({ batchId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    check_type: 'initial',
    purity_percentage: '',
    appearance_grade: 'A',
    test_method: '',
    passed: true,
    notes: '',
  });

  const handleSubmit = async () => {
    await batchEnhancedService.addQualityCheck({
      ...formData,
      batch_id: batchId,
      inspector_id: 'current-user-id',
    }, 'user@example.com');

    onSuccess();
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Add Quality Check">
      <div className="space-y-4">
        <select value={formData.check_type} onChange={(e) => setFormData({...formData, check_type: e.target.value})}>
          <option value="initial">Initial</option>
          <option value="intermediate">Intermediate</option>
          <option value="final">Final</option>
          <option value="random">Random</option>
          <option value="customs">Customs</option>
        </select>

        <input
          type="number"
          placeholder="Purity %"
          value={formData.purity_percentage}
          onChange={(e) => setFormData({...formData, purity_percentage: e.target.value})}
        />

        <select value={formData.appearance_grade} onChange={(e) => setFormData({...formData, appearance_grade: e.target.value})}>
          <option value="A">Grade A</option>
          <option value="B">Grade B</option>
          <option value="C">Grade C</option>
        </select>

        <input
          placeholder="Test Method"
          value={formData.test_method}
          onChange={(e) => setFormData({...formData, test_method: e.target.value})}
        />

        <label>
          <input
            type="checkbox"
            checked={formData.passed}
            onChange={(e) => setFormData({...formData, passed: e.target.checked})}
          />
          Passed
        </label>

        <textarea
          placeholder="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
        />

        <Button onClick={handleSubmit}>Add Quality Check</Button>
      </div>
    </Modal>
  );
}
```

#### B. Batch Split Modal
**File:** `src/components/batch/BatchSplitModal.tsx`

```tsx
import { useState } from 'react';
import { batchEnhancedService } from '@/services';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export function BatchSplitModal({ batch, onClose, onSuccess }) {
  const [splitWeight, setSplitWeight] = useState('');
  const [reason, setReason] = useState('');

  const handleSplit = async () => {
    await batchEnhancedService.splitBatch({
      parent_batch_id: batch.id,
      split_weight_grams: parseFloat(splitWeight),
      split_reason: reason,
      split_by: 'current-user-id',
    }, 'user@example.com');

    onSuccess();
    onClose();
  };

  const remainingWeight = batch.weight_grams - parseFloat(splitWeight || '0');

  return (
    <Modal isOpen onClose={onClose} title="Split Batch">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">Current Weight: {batch.weight_grams}g</p>
        </div>

        <input
          type="number"
          placeholder="Weight to split (grams)"
          value={splitWeight}
          onChange={(e) => setSplitWeight(e.target.value)}
          max={batch.weight_grams}
        />

        <p className="text-sm">
          Remaining in original batch: {remainingWeight > 0 ? remainingWeight : 0}g
        </p>

        <textarea
          placeholder="Reason for split"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />

        <Button
          onClick={handleSplit}
          disabled={!splitWeight || !reason || parseFloat(splitWeight) >= batch.weight_grams}
        >
          Split Batch
        </Button>
      </div>
    </Modal>
  );
}
```

#### C. Batch Tag Modal
**File:** `src/components/batch/BatchTagModal.tsx`

```tsx
import { useState } from 'react';
import { batchEnhancedService } from '@/services';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export function BatchTagModal({ batchId, onClose, onSuccess }) {
  const [tagName, setTagName] = useState('');
  const [tagCategory, setTagCategory] = useState('');

  const handleAdd = async () => {
    await batchEnhancedService.addBatchTag(
      batchId,
      tagName,
      tagCategory,
      'current-user-id'
    );

    onSuccess();
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="Add Tag">
      <div className="space-y-4">
        <input
          placeholder="Tag name"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
        />

        <input
          placeholder="Category (optional)"
          value={tagCategory}
          onChange={(e) => setTagCategory(e.target.value)}
        />

        <Button onClick={handleAdd} disabled={!tagName}>
          Add Tag
        </Button>
      </div>
    </Modal>
  );
}
```

### Step 4: Update BatchDetailsEnhanced to Use Modals

Add modal state management:

```tsx
const [showQualityCheckModal, setShowQualityCheckModal] = useState(false);
const [showSplitModal, setShowSplitModal] = useState(false);
const [showTagModal, setShowTagModal] = useState(false);

// Import the modals
import { QualityCheckModal } from '@/components/batch/QualityCheckModal';
import { BatchSplitModal } from '@/components/batch/BatchSplitModal';
import { BatchTagModal } from '@/components/batch/BatchTagModal';

// Add modals to render
{showQualityCheckModal && (
  <QualityCheckModal
    batchId={id!}
    onClose={() => setShowQualityCheckModal(false)}
    onSuccess={loadQualityChecks}
  />
)}

{showSplitModal && (
  <BatchSplitModal
    batch={batch}
    onClose={() => setShowSplitModal(false)}
    onSuccess={loadAllData}
  />
)}

{showTagModal && (
  <BatchTagModal
    batchId={id!}
    onClose={() => setShowTagModal(false)}
    onSuccess={loadTags}
  />
)}

// Update buttons to open modals
<Button onClick={() => setShowSplitModal(true)}>
  Split Batch
</Button>

<Button onClick={() => setShowQualityCheckModal(true)}>
  Add Quality Check
</Button>

<Button onClick={() => setShowTagModal(true)}>
  Add Tag
</Button>
```

### Step 5: Add Approval Dashboard (Optional)

**File:** `src/pages/admin/ApprovalsDashboard.tsx`

Update to use new workflow service:

```tsx
import { useEffect, useState } from 'react';
import { batchWorkflowService } from '@/services';
import { ApprovalWorkflowCard } from '@/components/batch/ApprovalWorkflowCard';

export function ApprovalsDashboard() {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [role, setRole] = useState('management'); // Get from auth context

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    const approvals = await batchWorkflowService.getPendingApprovals(undefined, role);
    setPendingApprovals(approvals);
  };

  const handleApprove = async (approvalId: string) => {
    const comments = prompt('Comments (optional):');
    await batchWorkflowService.approveRequest(
      approvalId,
      'current-user-id',
      'user@example.com',
      comments || undefined
    );
    loadApprovals();
  };

  const handleReject = async (approvalId: string) => {
    const reason = prompt('Rejection reason (required):');
    if (reason) {
      await batchWorkflowService.rejectRequest(
        approvalId,
        'current-user-id',
        'user@example.com',
        reason
      );
      loadApprovals();
    }
  };

  return (
    <div>
      <h1>Pending Approvals</h1>
      <ApprovalWorkflowCard
        approvals={pendingApprovals}
        onApprove={handleApprove}
        onReject={handleReject}
        canApprove={true}
      />
    </div>
  );
}
```

## Database Migration Required ⚠️

**IMPORTANT:** Before using these visual features, you must run the database migrations:

### Option 1: Using Supabase CLI (Recommended if available)
```bash
# Not available in this environment, use Supabase Dashboard
```

### Option 2: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - `supabase/migrations/20251025120000_enhance_batch_management_schema.sql`
   - `supabase/migrations/20251025120001_workflow_engine_and_status_management.sql`
   - `supabase/migrations/20251025120002_add_saved_searches_and_analytics.sql`

4. Verify migrations:
```sql
-- Check if new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'batch_quality_checks',
    'batch_splits',
    'batch_merges',
    'batch_alerts',
    'batch_approvals',
    'batch_workflow_definitions'
  );
```

## Quick Testing Guide

After running migrations, test the visual features:

### Test 1: View Enhanced Batch Details
1. Navigate to any batch: `/batches/:id`
2. You should see:
   - Quality checks panel (empty initially)
   - Alerts panel (empty initially)
   - Approval workflow panel
   - Enhanced batch info with metal type, quality grade
   - Hold/Release buttons
   - Split/Merge/Tag buttons

### Test 2: Add Quality Check
1. On batch details page, click "Add Quality Check"
2. Fill in the form
3. Submit
4. Check should appear in Quality Checks panel

### Test 3: Create Alert
1. Alerts are automatically created by the system
2. Try putting a batch on hold
3. An alert should be created

### Test 4: Test Hold/Release
1. Click "Put on Hold" button
2. Enter a reason
3. Batch should show "ON HOLD" badge
4. Click "Release Hold" to release

### Test 5: Test Saved Search (on listing page)
1. Set some filters
2. Click "Save Search"
3. Enter a name
4. Load saved searches to reuse

## Troubleshooting

### Issue: Components not showing data
**Solution:** Ensure database migrations are run

### Issue: TypeScript errors
**Solution:** Restart TypeScript server (`Cmd+Shift+P` > "Restart TS Server")

### Issue: Services not found
**Solution:** Check imports from `@/services` - they're all exported in `src/services/index.ts`

### Issue: User ID showing as 'user-id'
**Solution:** Replace placeholder 'user-id' with actual user ID from auth context:
```tsx
import { useAuth } from '@/contexts/AuthContext';

const { user } = useAuth();
const userId = user?.id || '';
```

## Performance Considerations

The enhanced batch details page loads multiple data sources in parallel:
- Batch details
- Timeline
- Quality checks
- Alerts
- Approvals
- Tags
- Transport details
- Reservations

All are loaded with `Promise.all()` for optimal performance.

## Summary

✅ **What's Working Now:**
- Enhanced BatchDetails page with all new features
- 3 new UI components (QualityCheckCard, AlertsPanel, ApprovalWorkflowCard)
- All backend services ready
- Build successful

⏳ **What Needs Integration:**
- Run database migrations (REQUIRED)
- Create modal components (Recommended)
- Update BatchListing with advanced search (Recommended)
- Update BatchCreate with new fields (Optional)
- Wire up user authentication context (Replace 'user-id' placeholders)

🎯 **Estimated Time:**
- Database migration: 10 minutes
- Modal components: 1-2 hours
- BatchListing updates: 1-2 hours
- BatchCreate updates: 30 minutes
- Total: 3-4 hours for full visual integration

## Next Actions

1. **Immediate:** Run database migrations
2. **High Priority:** Create modal components
3. **Medium Priority:** Update BatchListing with filters
4. **Low Priority:** Update BatchCreate with new fields
5. **Ongoing:** Replace 'user-id' placeholders with real auth context

---

**Build Status:** ✅ Successful
**Visual Components:** ✅ Ready
**Backend Services:** ✅ Complete
**Database Migrations:** ⚠️ Pending (Required)
