# Sales Status Transitions - Quick Reference

## All Valid Transitions (12 Total)

| # | From → To | Description | Who | Type |
|---|-----------|-------------|-----|------|
| **MAIN WORKFLOW** |
| 1 | `create_sales` → `pending_approval` | Sale created | System | Auto |
| 2 | `pending_approval` → `customer_rejected` | Rejected | Management/Customer | Manual |
| 3 | `pending_approval` → `customer_approved` | ⚠️ **Management** approves | **Management** | Manual |
| 4 | `customer_approved` → `waiting_for_payment` | **Customer** confirms payment | **Customer** | Manual |
| 5 | `waiting_for_payment` → `virtual_payment` | Virtual payment created | System | Auto |
| 6a | `waiting_for_payment` → `payment_received` | Payment confirmed | Management | Manual |
| 6b | `virtual_payment` → `payment_received` | Payment confirmed | Management | Manual |
| 7 | `payment_received` → `completed` | Sale closed | Management | Manual |
| **EDGE CASES** |
| 8 | `customer_rejected` → `pending_approval` | Reopen rejected sale | Management | Manual |
| 9 | `create_sales` → `customer_rejected` | Cancel early | Management | Manual |
| 10 | `customer_approved` → `customer_rejected` | Cancel after approval | Management | Manual |
| 11 | `customer_approved` → `payment_received` | Direct payment | Management | Manual |
| 12 | `pending_approval` → `waiting_for_payment` | Customer approves early | Customer | Manual |

## Status Meanings

| Status | What It Actually Means | Common Confusion |
|--------|------------------------|------------------|
| `pending_approval` | Awaiting management review | ✅ Clear |
| `customer_approved` | ⚠️ **Management approved**, customer notified | ❌ Sounds like customer approved! |
| `waiting_for_payment` | Customer confirmed, awaiting payment | ✅ Clear |
| `payment_received` | Payment confirmed by management | ✅ Clear |
| `completed` | Sale fully closed | ✅ Clear |

## Quick Decision Tree

```
When sale is in 'pending_approval':
├─ Management approves? → 'customer_approved'
├─ Management rejects? → 'customer_rejected'
└─ Customer approves early? → 'waiting_for_payment' (edge case)

When sale is in 'customer_approved':
├─ Customer confirms payment? → 'waiting_for_payment'
├─ Management cancels? → 'customer_rejected'
└─ Payment already received? → 'payment_received' (skip waiting)

When sale is in 'waiting_for_payment':
├─ System auto-creates virtual? → 'virtual_payment'
└─ Real payment confirmed? → 'payment_received'

When sale is in 'virtual_payment':
└─ Real payment confirmed? → 'payment_received'

When sale is in 'payment_received':
└─ Management closes? → 'completed'

When sale is in 'customer_rejected':
└─ Management reopens? → 'pending_approval'
```

## Most Common Paths

### Path 1: Normal Happy Path (90% of cases)
```
pending_approval 
  → customer_approved (mgmt approves)
  → waiting_for_payment (customer confirms)
  → virtual_payment (auto)
  → payment_received (mgmt confirms)
  → completed (mgmt closes)
```

### Path 2: Quick Payment (skip virtual)
```
pending_approval 
  → customer_approved 
  → waiting_for_payment 
  → payment_received (direct)
  → completed
```

### Path 3: Rejection
```
pending_approval 
  → customer_rejected
  [end or reopen]
```

### Path 4: Edge Case (Customer First)
```
pending_approval 
  → waiting_for_payment (customer acts first)
  → virtual_payment
  → payment_received
  → completed
```

## Remember

1. **"customer_approved" = Management approved!** (confusing name, I know)
2. Real customer approval = transition to `waiting_for_payment`
3. Always check transition exists before updating status
4. Database trigger validates all transitions automatically

## Files to Apply

1. ✅ `20251101000011_fix_sales_approval_workflow.sql` - Adds tracking columns
2. ✅ `20251101000012_add_pending_to_waiting_transition.sql` - Adds edge case

Apply both in Supabase Dashboard SQL Editor.
