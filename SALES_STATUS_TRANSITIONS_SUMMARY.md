# Sales Status Transitions - Complete Reference Guide

## Overview

This document provides a complete reference of all sales status transitions defined in the `sales_status_transitions` table. The workflow follows a 7-step process with additional flexibility transitions for edge cases.

---

## Status Legend

| Status | Meaning | Description |
|--------|---------|-------------|
| `create_sales` | Draft | Sale is being created (rarely used as initial status) |
| `pending_approval` | Awaiting Review | Sale created, awaiting management review |
| `customer_rejected` | Rejected | Sale rejected by management or customer |
| `customer_approved` | ⚠️ Misleading Name! | **Actually means:** Management approved, customer notified |
| `waiting_for_payment` | Payment Expected | Customer confirmed payment commitment, awaiting payment |
| `virtual_payment` | Virtual Payment | System created virtual payment record to track expected payment |
| `payment_received` | Payment Confirmed | Management confirmed actual payment received |
| `completed` | Closed | Sale fully completed and closed |

### ⚠️ Important Status Name Clarification

**`customer_approved` is a misleading status name!**

- ❌ It does NOT mean "customer has approved"
- ✅ It means "management approved AND customer was notified"
- The actual customer approval happens when moving to `waiting_for_payment`

---

## Complete Transitions Table

### Main Workflow (7 Official Steps)

| Step | From Status | To Status | Description | Auto | Role | Trigger/Action |
|------|-------------|-----------|-------------|------|------|----------------|
| 1 | `create_sales` | `pending_approval` | Sale created, awaiting management review | ✅ Yes | System | Sale creation form submission |
| 2 | `pending_approval` | `customer_rejected` | Sale rejected | ❌ No | Customer/Management | Reject button clicked |
| 3 | `pending_approval` | `customer_approved` | **Management approves** - Customer notified | ❌ No | **Management** | Management approval button |
| 4 | `customer_approved` | `waiting_for_payment` | **Customer confirms** payment commitment | ❌ No | **Customer** | Customer clicks approve in email |
| 5 | `waiting_for_payment` | `virtual_payment` | Virtual payment record created | ✅ Yes | System | Auto-trigger after payment commitment |
| 6a | `waiting_for_payment` | `payment_received` | Real payment received (direct path) | ❌ No | Management | Payment confirmation |
| 6b | `virtual_payment` | `payment_received` | Real payment received (from virtual) | ❌ No | Management | Payment confirmation |
| 7 | `payment_received` | `completed` | Sale closed | ❌ No | Management | Final closure action |

---

### Additional Flexibility Transitions (Edge Cases)

| From Status | To Status | Description | Role | Purpose |
|-------------|-----------|-------------|------|---------|
| `customer_rejected` | `pending_approval` | Reopen after rejection | Management | Allow reconsidering rejected sales |
| `create_sales` | `customer_rejected` | Cancel before approval | Management | Quick cancellation |
| `customer_approved` | `customer_rejected` | Cancel after approval | Management | Cancellation after management approval |
| `customer_approved` | `payment_received` | Direct payment | Management | Skip waiting if payment already received |
| `pending_approval` | `waiting_for_payment` | **Customer approves before management** | Customer | Edge case: Customer acts first |

---

## Detailed Workflow Scenarios

### Scenario 1: Normal Flow (Management Approves First)

```
┌─────────────────┐
│  Sale Created   │
│ pending_approval│
└────────┬────────┘
         │
         │ Management reviews
         ├─────────────────────────────────────┐
         │                                     │
         │ APPROVE                             │ REJECT
         ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│ Management OK   │                  │    Rejected     │
│customer_approved│                  │customer_rejected│
└────────┬────────┘                  └─────────────────┘
         │
         │ Email sent to customer
         │ Customer reviews
         ├─────────────────────────────────────┐
         │                                     │
         │ APPROVE (payment commitment)        │ (reject not implemented yet)
         ▼                                     │
┌─────────────────┐                           │
│ Payment Pending │                           │
│waiting_for_payment│◄──────────────────────────┘
└────────┬────────┘
         │
         │ Auto-create virtual payment
         ▼
┌─────────────────┐
│ Virtual Payment │
│ virtual_payment │
└────────┬────────┘
         │
         │ Management confirms real payment
         ▼
┌─────────────────┐
│Payment Confirmed│
│payment_received │
└────────┬────────┘
         │
         │ Management closes sale
         ▼
┌─────────────────┐
│     Closed      │
│    completed    │
└─────────────────┘
```

---

### Scenario 2: Edge Case (Customer Approves Before Management)

```
┌─────────────────┐
│  Sale Created   │
│ pending_approval│
└────────┬────────┘
         │
         │ Customer clicks approve link
         │ (before management review)
         ▼
┌─────────────────┐
│ Payment Pending │
│waiting_for_payment│
└────────┬────────┘
         │
         │ Continue normal flow...
         ▼
```

This edge case transition was added in migration `20251101000012` to handle situations where customers act before management review.

---

### Scenario 3: Rejection and Reopening

```
┌─────────────────┐
│  Sale Created   │
│ pending_approval│
└────────┬────────┘
         │
         │ REJECT
         ▼
┌─────────────────┐
│    Rejected     │
│customer_rejected│
└────────┬────────┘
         │
         │ Management reconsiders
         │ REOPEN
         ▼
┌─────────────────┐
│  Back to Review │
│ pending_approval│
└─────────────────┘
```

---

## Code Implementation Reference

### Key Files

1. **Database Migration:** `supabase/migrations/20251101000002_create_sales_status_transitions.sql`
   - Creates the `sales_status_transitions` table
   - Defines 7 main workflow steps
   - Adds flexibility transitions

2. **Update Migration:** `supabase/migrations/20251101000012_add_pending_to_waiting_transition.sql`
   - Adds edge case: `pending_approval → waiting_for_payment`
   - Updates descriptions to clarify "customer_approved" means management approval
   - Adds documentation

3. **Status Constants:** `src/constants/salesStatuses.ts`
   - Defines all status constants
   - Provides labels and colors for UI

4. **Approval Service:** `src/services/approvalService.ts`
   - Handles management approval (Step 3)
   - Updates status to `customer_approved`
   - Sends email to customer

5. **Customer Approval:** `src/services/salesService.ts` - `customerApproveSale()`
   - Handles customer approval (Step 4)
   - Updates status to `waiting_for_payment`
   - Creates virtual payment record

---

## Validation and Enforcement

### Database Trigger

The `check_sales_status_transition()` trigger validates all status changes:

```sql
CREATE TRIGGER trigger_validate_sales_status_transition
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION check_sales_status_transition();
```

**What it does:**
- ✅ Checks if the transition exists in `sales_status_transitions` table
- ✅ Blocks invalid transitions with error message
- ✅ Allows valid transitions to proceed
- ✅ Logs transition history

**Example Error:**
```
Invalid status transition from pending_approval to payment_received.
Please follow the official workflow.
HINT: Check sales_status_transitions table for valid transitions
```

---

## Role Permissions

| Role | Can Perform Transitions |
|------|------------------------|
| **System** | Automatic transitions (Steps 1, 5) |
| **Management** | Approve (Step 3), Confirm payment (Steps 6a, 6b), Close sale (Step 7), Reject, Reopen, Cancel |
| **Customer** | Confirm payment commitment (Step 4), Reject (Step 2) |

---

## Status Colors (UI)

Used in `src/constants/salesStatuses.ts`:

| Status | Color | UI Class |
|--------|-------|----------|
| `create_sales` | Gray | `bg-gray-100 text-gray-800` |
| `pending_approval` | Yellow | `bg-yellow-100 text-yellow-800` |
| `customer_rejected` | Red | `bg-red-100 text-red-800` |
| `customer_approved` | Green | `bg-green-100 text-green-800` |
| `waiting_for_payment` | Blue | `bg-blue-100 text-blue-800` |
| `virtual_payment` | Purple | `bg-purple-100 text-purple-800` |
| `payment_received` | Emerald | `bg-emerald-100 text-emerald-800` |
| `completed` | Gray | `bg-gray-100 text-gray-800` |

---

## Common Issues and Solutions

### Issue 1: "Invalid status transition" Error

**Symptom:** Error message like "Invalid status transition from X to Y"

**Cause:** Trying to transition to a status that isn't allowed from the current status

**Solution:**
1. Check current sale status
2. Verify the transition exists in table above
3. If legitimate, add transition via migration
4. If not, fix the code to follow correct workflow

---

### Issue 2: Status Name Confusion

**Symptom:** Confusion about when "customer_approved" status is set

**Clarification:**
- `customer_approved` is set when **MANAGEMENT** approves (Step 3)
- It means "management approved, customer notified"
- Actual customer approval happens at Step 4 (→ `waiting_for_payment`)

**Why the confusing name?**
- Legacy naming from initial design
- Kept for backward compatibility
- Documented extensively to avoid confusion

---

### Issue 3: Missing Transition

**Symptom:** Code tries to transition but gets validation error

**Example:** Customer approving from `pending_approval` → `waiting_for_payment`

**Solution:** Migration `20251101000012` added this edge case transition

---

## Testing Checklist

- [ ] Create sale → status is `pending_approval`
- [ ] Management approves → status becomes `customer_approved`
- [ ] Customer receives email with approval link
- [ ] Customer clicks approve → status becomes `waiting_for_payment`
- [ ] Virtual payment auto-created → status becomes `virtual_payment`
- [ ] Management confirms payment → status becomes `payment_received`
- [ ] Management closes sale → status becomes `completed`
- [ ] Test rejection: Management rejects → status becomes `customer_rejected`
- [ ] Test reopen: Reopen rejected sale → status back to `pending_approval`
- [ ] Test edge case: Customer approves before management

---

## Database Query Examples

### View all transitions
```sql
SELECT 
  step_number,
  status_from,
  status_to,
  description_en,
  is_automatic,
  required_role
FROM sales_status_transitions
ORDER BY step_number, status_from;
```

### Check if transition is valid
```sql
SELECT EXISTS (
  SELECT 1 
  FROM sales_status_transitions
  WHERE status_from = 'pending_approval' 
    AND status_to = 'customer_approved'
) as is_valid;
```

### Find all possible next statuses
```sql
SELECT status_to, description_en, required_role
FROM sales_status_transitions
WHERE status_from = 'pending_approval';
```

---

## Summary

The sales workflow is a **7-step process** with additional **flexibility transitions** for edge cases:

1. ✅ **Validated:** All transitions validated by database trigger
2. ✅ **Documented:** Complete documentation of workflow and status meanings
3. ✅ **Flexible:** Edge cases handled with optional transitions
4. ✅ **Auditable:** Full history tracked for compliance
5. ⚠️ **Confusing naming:** "customer_approved" means management approved (documented)

**Total Transitions:** 12 (7 main steps + 5 flexibility transitions)

**Key Takeaway:** The workflow ensures proper approval flow while maintaining flexibility for real-world scenarios.

---

**Last Updated:** Based on migrations through `20251101000012`
**Status:** ✅ Complete and validated
