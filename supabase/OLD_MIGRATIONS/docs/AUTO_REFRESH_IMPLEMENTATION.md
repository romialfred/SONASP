# Auto-Refresh Implementation

## Overview

An automatic page refresh system has been implemented across the platform to ensure data is immediately updated when users return to list pages after performing actions like validating batches, creating entities, or updating statuses.

## Problem Solved

**Before**: When a user validated a batch for refinery and returned to the Receiving Dashboard, the page would not update automatically, showing stale data until manual refresh.

**After**: The page automatically refreshes when returning from batch validation, entity creation, or status updates, ensuring users always see the most current data.

## Architecture

### Core Hook: `useAutoRefresh`

**File**: `/src/hooks/useAutoRefresh.ts`

A reusable React hook that detects when a page should auto-refresh based on navigation state.

#### Features:
- ✅ Non-intrusive: Only refreshes when explicitly flagged
- ✅ Prevents multiple refreshes: Uses ref to track if already refreshed
- ✅ Cleans up state: Removes autoRefresh flag after execution
- ✅ Configurable delay: Allows custom delay before refresh
- ✅ Optional callback: Executes custom refresh logic

#### Hook Interface:

```typescript
interface UseAutoRefreshOptions {
  enabled?: boolean;        // Enable/disable functionality (default: true)
  delay?: number;          // Delay in ms before refresh (default: 100ms)
  onRefresh?: () => void;  // Callback to execute on refresh
}

function useAutoRefresh(options?: UseAutoRefreshOptions): void
```

#### Usage Example:

```tsx
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

function MyDashboard() {
  const { refetch } = useBatchRealtime();

  // Auto-refresh when returning from batch validation
  useAutoRefresh({
    enabled: true,
    onRefresh: () => {
      refetch();
    },
  });

  // Rest of component...
}
```

### Navigation Helper: `navigateWithAutoRefresh`

A utility function to navigate to a page with the auto-refresh flag set.

#### Function Signature:

```typescript
function navigateWithAutoRefresh(
  navigate: NavigateFunction,
  path: string,
  additionalState?: Record<string, any>
): void
```

#### Usage Example:

```tsx
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';
import { useNavigate } from 'react-router-dom';

function ReceivingConfirm() {
  const navigate = useNavigate();

  const handleConfirm = async () => {
    // Update batch status...

    // Navigate with auto-refresh
    navigateWithAutoRefresh(navigate, '/receiving');
  };
}
```

## Implementation Details

### How It Works

1. **Action Page** (e.g., ReceivingConfirm):
   ```tsx
   // After validation
   navigateWithAutoRefresh(navigate, '/receiving');
   ```
   This sets `{ autoRefresh: true }` in the navigation state

2. **List Page** (e.g., ReceivingDashboard):
   ```tsx
   useAutoRefresh({
     enabled: true,
     onRefresh: () => {
       refetch(); // Refresh data
     },
   });
   ```
   Detects the `autoRefresh` flag and executes `refetch()`

3. **Cleanup**:
   - Hook clears the `autoRefresh` flag from history
   - Prevents refresh on subsequent renders
   - Resets on location change

### State Management

```
User Action → Navigation with State → Page Mount → Hook Detects Flag → Execute Refresh → Clear Flag
```

**Navigation State Flow**:
```typescript
navigate('/receiving', {
  state: { autoRefresh: true }
});
↓
location.state = { autoRefresh: true }
↓
useAutoRefresh detects flag
↓
Execute onRefresh callback
↓
Clear flag from history
```

## Pages Implemented

### 1. Receiving Dashboard
**File**: `/src/pages/receiving/ReceivingDashboard.tsx`

**Triggers Auto-Refresh When**:
- Batch validated for refinery
- Batch confirmed at airport
- Batch shipped to refinery

**Implementation**:
```tsx
const { batches, loading, refetch } = useBatchRealtime({
  statuses: [
    BATCH_STATUSES.APPROVED_FOR_TRANSPORT,
    BATCH_STATUSES.WAITING_AIRPORT_RECEIPT,
    BATCH_STATUSES.RECEIVED_AT_AIRPORT,
    BATCH_STATUSES.VALIDATED_FOR_REFINERY,
  ],
});

useAutoRefresh({
  enabled: true,
  onRefresh: () => {
    if (refetch) {
      refetch();
    }
  },
});
```

### 2. Receiving Confirmation
**File**: `/src/pages/receiving/ReceivingConfirm.tsx`

**Actions That Trigger Auto-Refresh**:
- Confirm receipt at airport
- Validate batch for refinery
- Ship batch to refinery

**Implementation**:
```tsx
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';

const handleConfirm = async () => {
  // ... batch update logic ...

  setTimeout(() => {
    navigateWithAutoRefresh(navigate, '/receiving');
  }, 1000);
};
```

### 3. Refining Dashboard
**File**: `/src/pages/refining/RefiningDashboard.tsx`

**Triggers Auto-Refresh When**:
- Batch received at refinery
- Batch validated for processing
- Processing started/completed

**Implementation**:
```tsx
useAutoRefresh({
  enabled: true,
  onRefresh: () => {
    fetchData();
    fetchMonthlyProcessedData();
  },
});
```

### 4. Refinery Receiving Confirmation
**File**: `/src/pages/refining/RefineryReceivingConfirm.tsx`

**Actions That Trigger Auto-Refresh**:
- Confirm receipt at refinery
- Validate batch for processing

**Implementation**:
```tsx
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';

const handleConfirm = async () => {
  // ... refinery receipt logic ...

  setTimeout(() => {
    navigateWithAutoRefresh(navigate, '/refining');
  }, 1000);
};
```

### 5. Batches Page
**File**: `/src/pages/batches/BatchesPage.tsx`

**Triggers Auto-Refresh When**:
- New batch created
- Batch status updated
- Batch deleted

**Implementation**:
```tsx
useAutoRefresh({
  enabled: true,
  onRefresh: () => {
    fetchData();
  },
});
```

### 6. Batch Creation
**File**: `/src/pages/batches/BatchCreate.tsx`

**Actions That Trigger Auto-Refresh**:
- New batch created successfully

**Implementation**:
```tsx
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';

const handleSubmit = async () => {
  // ... create batch logic ...

  if (result.success) {
    setTimeout(() => {
      navigateWithAutoRefresh(navigate, '/batches');
    }, 1500);
  }
};
```

## User Flow Examples

### Example 1: Validate Batch for Refinery

```
1. User on Receiving Dashboard (/receiving)
   ↓
2. Click "Validate for Refinery" on batch
   ↓
3. Navigate to /receiving/:id/confirm
   ↓
4. Confirm validation
   ↓
5. navigateWithAutoRefresh(navigate, '/receiving')
   ↓
6. Return to Receiving Dashboard
   ↓
7. useAutoRefresh detects flag → refetch()
   ↓
8. Page shows updated data automatically
```

### Example 2: Create New Batch

```
1. User on Batches Page (/batches)
   ↓
2. Click "Create New Batch"
   ↓
3. Navigate to /batches/new
   ↓
4. Fill form and submit
   ↓
5. navigateWithAutoRefresh(navigate, '/batches')
   ↓
6. Return to Batches Page
   ↓
7. useAutoRefresh detects flag → fetchData()
   ↓
8. New batch appears in list automatically
```

### Example 3: Receive at Refinery

```
1. User on Refining Dashboard (/refining)
   ↓
2. Click "Confirm Receipt" on incoming batch
   ↓
3. Navigate to /refining/receiving/:id/confirm
   ↓
4. Confirm receipt and validate for processing
   ↓
5. navigateWithAutoRefresh(navigate, '/refining')
   ↓
6. Return to Refining Dashboard
   ↓
7. useAutoRefresh detects flag → fetchData()
   ↓
8. Batch moves to correct section automatically
```

## Benefits

### User Experience
- ✅ **Instant Feedback**: Users see changes immediately
- ✅ **No Manual Refresh**: Eliminates need for F5 or page reload
- ✅ **Confidence**: Users know their actions were successful
- ✅ **Consistency**: Same behavior across all list pages

### Developer Experience
- ✅ **Reusable Hook**: Single implementation for all pages
- ✅ **Simple API**: Two functions cover all use cases
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **Easy Integration**: Add to any page in 3 lines

### Performance
- ✅ **Selective Refresh**: Only refreshes when needed
- ✅ **No Polling**: Doesn't constantly check for updates
- ✅ **Minimal Overhead**: Small delay (100ms) is imperceptible
- ✅ **Clean State**: Properly cleans up navigation state

## Edge Cases Handled

### 1. Multiple Rapid Navigations
**Issue**: User navigates back and forth quickly
**Solution**: `hasRefreshedRef` prevents multiple refreshes

### 2. Direct URL Access
**Issue**: User types URL directly in browser
**Solution**: No `autoRefresh` flag = no unwanted refresh

### 3. Browser Back Button
**Issue**: Browser back might have stale state
**Solution**: Flag is cleared from history after use

### 4. Component Unmount
**Issue**: Component unmounts before refresh completes
**Solution**: Cleanup function in useEffect cancels timer

### 5. Disabled Auto-Refresh
**Issue**: Some pages shouldn't auto-refresh
**Solution**: `enabled: false` option disables functionality

## Testing Checklist

### Functional Tests
- [x] Validate batch for refinery → Dashboard refreshes
- [x] Confirm receipt at airport → Dashboard refreshes
- [x] Confirm receipt at refinery → Dashboard refreshes
- [x] Create new batch → Batch list refreshes
- [x] Multiple validations in sequence work correctly
- [x] Manual navigation (typing URL) doesn't trigger refresh
- [x] Browser back button works correctly

### Performance Tests
- [x] No noticeable delay when returning to page
- [x] No multiple network requests
- [x] State cleanup prevents memory leaks
- [x] Works with realtime subscriptions

### Edge Case Tests
- [x] Rapid navigation doesn't cause issues
- [x] Component unmount doesn't cause errors
- [x] Disabled auto-refresh prevents refresh
- [x] Additional state preserved in navigation

## Migration Guide

### Adding Auto-Refresh to a List Page

1. Import the hook:
```tsx
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
```

2. Add the hook call:
```tsx
useAutoRefresh({
  enabled: true,
  onRefresh: () => {
    // Your refresh logic here
    fetchData();
    // or
    refetch();
  },
});
```

3. Done! Page will auto-refresh when returning from actions.

### Adding Auto-Refresh Trigger to an Action Page

1. Import the helper:
```tsx
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';
```

2. Replace `navigate()` calls:
```tsx
// Before
navigate('/batches');

// After
navigateWithAutoRefresh(navigate, '/batches');
```

3. Done! Target page will auto-refresh.

## Configuration Options

### Hook Options

```typescript
{
  enabled: boolean;        // Default: true
  delay: number;          // Default: 100ms
  onRefresh: () => void;  // Required
}
```

### Navigation Options

```typescript
navigateWithAutoRefresh(
  navigate,
  '/path',
  {
    // Additional state
    someData: 'value'
  }
);
```

## Limitations

1. **Only Works with React Router**: Requires `react-router-dom` navigation
2. **Client-Side Only**: Doesn't work with SSR/SSG initially
3. **Requires Callback**: List pages must provide refresh function
4. **Not Automatic**: Must manually add to each page

## Future Enhancements

### Potential Improvements:
- [ ] Global state management for auto-refresh
- [ ] Configurable refresh strategies (immediate, debounced, etc.)
- [ ] Auto-detect refresh functions
- [ ] Support for query parameter changes
- [ ] Analytics tracking for refresh events

## Best Practices

### Do's ✅
- Use `navigateWithAutoRefresh` after successful actions
- Provide meaningful `onRefresh` callbacks
- Keep refresh logic lightweight
- Test with realtime subscriptions

### Don'ts ❌
- Don't trigger refresh on every navigation
- Don't perform heavy operations in `onRefresh`
- Don't forget to handle loading states
- Don't use for pages that shouldn't refresh

## Troubleshooting

### Problem: Page Not Refreshing

**Check**:
1. Is `useAutoRefresh` added to the list page?
2. Is `navigateWithAutoRefresh` used in action page?
3. Is `onRefresh` callback provided?
4. Are there any console errors?

### Problem: Multiple Refreshes

**Check**:
1. Is component re-rendering unnecessarily?
2. Are multiple `useAutoRefresh` hooks active?
3. Is the flag being cleared properly?

### Problem: Slow Refresh

**Check**:
1. Is the delay too long?
2. Is refresh logic performing heavy operations?
3. Are there network latency issues?

## Summary

The auto-refresh implementation provides a seamless user experience by automatically updating list pages when users return from performing actions. It's implemented using a reusable hook pattern that's easy to add to any page, requiring minimal code changes.

### Key Stats:
- ✅ **6 pages** with auto-refresh capability
- ✅ **1 reusable hook** (`useAutoRefresh`)
- ✅ **1 helper function** (`navigateWithAutoRefresh`)
- ✅ **Zero breaking changes** to existing validation features
- ✅ **No regression** in existing functionality

The system is production-ready and will significantly improve user experience when validating batches, creating entities, or updating statuses across the platform.
