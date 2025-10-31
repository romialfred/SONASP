# Sales and Payment Workflow - Comprehensive Analysis

## Executive Summary

This analysis examines the complete Sales and Payment workflow including database schema, code implementation, status transitions, forms, and identifies all gaps and bugs with proposed solutions.

**Analysis Date:** October 31, 2025
**Scope:** Complete sales and payment lifecycle from creation to completion

---

## 1. DATABASE SCHEMA ANALYSIS

### 1.1 Sales Table Structure

**Current Columns:**
- Core fields: `id`, `sale_number`, `sale_date`, `customer_id`, `quantity_oz`, `currency`
- Pricing: `london_am_rate`, `gross_proceeds`, `net_proceeds`, `royalties`, `final_proceeds`
- Costs: `freight_cost`, `other_costs`
- **NEW:** `seller_id`, `seller_type`, `is_internal_sale` (multi-vendor support)
- Workflow: `status`, `mechanism_type`
- Audit: `created_by`, `created_at`, `updated_at`

**Status Constraint:**
```sql
CHECK (status IN (
  'create_sales', 'pending_approval', 'customer_rejected',
  'customer_approved', 'waiting_for_payment', 'virtual_payment',
  'payment_received', 'completed'
))
```

### 1.2 Payments Table Structure

**Current Columns:**
- Core: `id`, `sale_id`, `customer_id`, `amount`, `currency`
- Dates: `expected_date`, `actual_date`
- **NEW:** `payment_type` ('virtual' | 'real')
- **NEW:** `customer_bank_id`, `seller_bank_id`, `fx_analysis_id`
- Legacy: `is_virtual` (boolean)
- Workflow: `status`, `reference_number`

### 1.3 FX Rate Analysis Table

**New Table Created:**
```sql
fx_rate_analysis (
  payment_id uuid REFERENCES payments,
  customer_rate numeric(18, 6),
  revolut_rate, ecb_rate, bceao_rate numeric(18, 6),
  best_rate, best_rate_source text,
  gain_loss_amount, gain_loss_percentage numeric,
  currency_pair text,
  analysis_date date
)
```

### 1.4 Sales Status Transitions Table

**Workflow Validation:**
```sql
sales_status_transitions (
  step_number integer,
  status_from text,
  status_to text,
  description text,
  is_automatic boolean,
  required_role text,
  notes text
)
```

**Seeded Transitions (7 official steps):**
1. `create_sales` → `pending_approval` (automatic)
2. `pending_approval` → `customer_rejected` (customer)
3. `pending_approval` → `customer_approved` (customer)
4. `customer_approved` → `waiting_for_payment` (automatic)
5. `waiting_for_payment` → `virtual_payment` (automatic)
6. `waiting_for_payment` OR `virtual_payment` → `payment_received` (management)
7. `payment_received` → `completed` (management)

---

## 2. IDENTIFIED GAPS & BUGS

### 2.1 DATABASE LAYER GAPS

#### GAP #1: Missing Seller Fields in SaleCreate Form
**Severity:** CRITICAL
**Impact:** New sales cannot enforce business rules

**Problem:**
- Database has `seller_id`, `seller_type`, `is_internal_sale` columns
- `SaleCreate.tsx` does NOT capture these fields
- Trigger `validate_sales_business_rules()` will be bypassed (checks `IF NEW.seller_id IS NULL`)

**Evidence:**
```typescript
// SaleCreate.tsx line 197-217
const { data, error } = await supabase.from('sales').insert([{
  sale_number: saleNumber,
  sale_date: new Date().toISOString().split('T')[0],
  customer_id: formData.customerId,
  // MISSING: seller_id, seller_type, is_internal_sale
  quantity_oz: ...,
  ...
}])
```

#### GAP #2: Inconsistent Status Values
**Severity:** HIGH
**Impact:** Database constraint violations

**Problem:**
- Database expects: `create_sales`, `pending_approval`, `customer_approved`, `waiting_for_payment`, etc.
- SaleCreate.tsx uses: `customer_pending` (line 214)
- SalesDashboard.tsx filters: `approved`, `customer_pending` (line 114)
- Database constraint will REJECT `customer_pending`

**Evidence:**
```typescript
// SaleCreate.tsx:214
status: 'customer_pending', // ❌ NOT in constraint!

// Database constraint expects:
'create_sales', 'pending_approval', 'customer_rejected',
'customer_approved', 'waiting_for_payment', 'virtual_payment',
'payment_received', 'completed'
```

#### GAP #3: Missing FX Analysis Integration
**Severity:** MEDIUM
**Impact:** No FX rate analysis recorded for payments

**Problem:**
- `fx_rate_analysis` table exists with complete schema
- `fxAnalysisService.ts` has all functions
- NO integration in payment recording flow
- Management cannot see gain/loss on customer rates

**Missing Integration Points:**
1. PaymentRecordPage should capture customer FX rate
2. Should fetch market rates (Revolut, ECB, BCEAO)
3. Should call `createFxAnalysis()` when recording payment
4. Should display analysis results

#### GAP #4: Auto Virtual Payment Trigger Issue
**Severity:** HIGH
**Impact:** Virtual payments may fail silently

**Problem:**
- Trigger `auto_create_virtual_payment()` fires on status change to `customer_approved`
- Trigger IMMEDIATELY changes status to `waiting_for_payment` (line 74)
- Second trigger `update_sale_to_virtual_payment_status()` expects sale in `waiting_for_payment` status
- Race condition: if triggers fire in wrong order, status may be inconsistent

**Evidence:**
```sql
-- First trigger (line 74)
NEW.status := 'waiting_for_payment';

-- Second trigger (line 122-123) expects this status
UPDATE sales SET status = 'virtual_payment'
WHERE id = NEW.sale_id AND status = 'waiting_for_payment';
```

#### GAP #5: Missing Customer Bank Accounts
**Severity:** MEDIUM
**Impact:** Cannot track which bank accounts used for payments

**Problem:**
- Payments table has `customer_bank_id` and `seller_bank_id`
- No UI to select bank accounts when recording payment
- No validation that bank accounts match payment currency

### 2.2 FRONTEND GAPS

#### GAP #6: No Seller Selection in Sale Creation
**Severity:** CRITICAL
**Impact:** Cannot create valid sales that pass business rules

**Required UI Changes:**
```typescript
// Need to add to SaleCreate form:
1. Seller Type Selection:
   - Radio buttons: "Mining Company Sale" or "Mansa Ressources Sale"

2. Seller Selection Dropdown:
   - If "Mining Company": Show mining_companies list
   - If "Mansa Ressources": Auto-select Mansa ID

3. Customer Dropdown Logic:
   - Call get_allowed_customers_for_seller(seller_id, seller_type)
   - Only show valid customers based on business rules

4. Visual Indicators:
   - Show "Internal Sale" badge if selling to Mansa
   - Show "External Sale" badge if Mansa selling to Auramet/StoneX
```

#### GAP #7: No FX Rate Analysis UI
**Severity:** MEDIUM
**Impact:** Cannot perform FX analysis for payments

**Missing Components:**
1. `ReceivedPaymentForm.tsx` - doesn't exist
2. `FxRateAnalysisPanel.tsx` - doesn't exist
3. No integration in PaymentRecordPage

**Required Components:**
```typescript
// ReceivedPaymentForm.tsx
- Customer bank account selector
- Seller bank account selector
- Customer FX rate input
- Payment proof upload
- Date and amount fields

// FxRateAnalysisPanel.tsx
- Real-time rate comparison (Customer vs Market)
- Display Revolut, ECB, BCEAO rates
- Calculate and show gain/loss
- Visual indicators (green = gain, red = loss)
- Detailed breakdown table
```

#### GAP #8: Status Flow Visualization Missing
**Severity:** LOW
**Impact:** Users don't understand workflow

**Problem:**
- 7-step workflow exists in database
- No visual representation in UI
- Users may not understand where sale is in workflow

**Solution:**
Create `SalesWorkflowVisualizer.tsx` component:
- Shows all 7 steps
- Highlights current step
- Grays out past steps
- Shows estimated time to completion

### 2.3 SERVICE LAYER GAPS

#### GAP #9: salesService Missing Multi-Vendor Functions
**Severity:** HIGH
**Impact:** Cannot query or validate vendor relationships

**Missing Functions:**
```typescript
// Need to add to salesService.ts:

export async function getAllowedCustomersForSeller(
  sellerId: string,
  sellerType: 'mining_company' | 'mansa_ressources'
): Promise<Customer[]>

export async function validateSaleBusinessRules(
  sellerId: string,
  sellerType: string,
  customerId: string
): Promise<{ isValid: boolean; errorMessage?: string }>

export async function getMiningCompanies(): Promise<MiningCompany[]>

export async function getMansaRessourcesId(): Promise<string>

export async function getInternalSales(filters?): Promise<Sale[]>

export async function getExternalSales(filters?): Promise<Sale[]>
```

#### GAP #10: Payment Service Missing FX Integration
**Severity:** MEDIUM
**Impact:** No FX analysis on payment recording

**Missing in paymentService.ts:**
```typescript
export async function recordRealPayment(
  paymentId: string,
  data: {
    actual_date: string;
    reference_number: string;
    customer_bank_id: string;
    seller_bank_id: string;
    customer_fx_rate: number;
    currency_pair: string;
    payment_proof_url?: string;
  }
): Promise<{ success: boolean; fxAnalysisId?: string }>
```

### 2.4 WORKFLOW LOGIC BUGS

#### BUG #1: Duplicate Status Update in customerApproveSale
**Severity:** MEDIUM
**Location:** `salesService.ts:401-408`

**Problem:**
```typescript
// Line 401: Updates to 'waiting_for_payment'
let statusResult = await updateSaleStatus(
  saleId,
  'waiting_for_payment',
  ...
);

// BUT trigger auto_create_virtual_payment() ALREADY sets this!
// Line 74 in migration: NEW.status := 'waiting_for_payment';
```

**Impact:** Redundant database update, audit log confusion

**Solution:** Remove explicit status update, trust trigger

#### BUG #2: Fallback Status Logic Incorrect
**Severity:** LOW
**Location:** `salesService.ts:411-419`

**Problem:**
```typescript
// If waiting_for_payment fails, tries customer_approved
// But trigger ALREADY moved it from customer_approved!
if (!statusResult.success) {
  statusResult = await updateSaleStatus(saleId, 'customer_approved', ...);
}
```

**Solution:** Remove fallback, log error if transition fails

#### BUG #3: No Validation for Status Transitions
**Severity:** HIGH
**Impact:** UI may attempt invalid transitions

**Problem:**
- Database has trigger to validate transitions
- Frontend has no pre-validation
- User clicks action → Database rejects → Poor UX

**Solution:**
```typescript
// Add to salesService.ts
export async function canTransitionTo(
  currentStatus: string,
  targetStatus: string
): Promise<boolean> {
  const { data } = await supabase
    .from('sales_status_transitions')
    .select('id')
    .eq('status_from', currentStatus)
    .eq('status_to', targetStatus)
    .maybeSingle();

  return !!data;
}
```

#### BUG #4: Virtual Payment Creation Doesn't Handle Errors
**Severity:** HIGH
**Location:** `salesService.ts:330-380`

**Problem:**
```typescript
// Creates virtual payment
const { data: virtualPayment, error: paymentError } = await supabase
  .from('payments').insert({...});

if (paymentError) {
  // Has fallback BUT doesn't rollback sale status change
  // Sale could be in 'customer_approved' with NO payment record
}
```

**Impact:** Orphaned sales without payment records

**Solution:** Use transaction or revert sale status on payment creation failure

---

## 3. MISSING FEATURES

### 3.1 Payment Recording Flow

**What's Missing:**
1. Form to record actual payment (replace virtual)
2. Bank account selection
3. FX rate capture and analysis
4. Payment proof upload
5. Conversion from virtual → real payment

### 3.2 Multi-Vendor Workflow UI

**What's Missing:**
1. Seller selection in sale creation
2. Filtered customer dropdown based on seller
3. Visual indicators for internal vs external sales
4. Mining company → Mansa → Customer flow visualization
5. Sales analytics by vendor type

### 3.3 FX Rate Analysis Dashboard

**What's Missing:**
1. Historical FX analysis view
2. Gain/loss trends over time
3. Best/worst performing rates
4. Currency pair comparisons
5. Alert system for unfavorable rates

### 3.4 Workflow Audit Trail

**What's Missing:**
1. Visual timeline of sale progression
2. Who approved each step
3. Time spent in each status
4. Email communication log
5. Status change reasons/notes

---

## 4. PROPOSED SOLUTIONS & IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (HIGH PRIORITY)

#### Task 1.1: Fix Status Value Inconsistencies
**Duration:** 2 hours

**Changes:**
```typescript
// 1. Update SaleCreate.tsx:214
status: 'pending_approval', // Changed from 'customer_pending'

// 2. Update SalesDashboard.tsx:114
.in('status', ['pending_approval', 'customer_approved', ...])
// Changed from 'approved', 'customer_pending'

// 3. Add status normalization helper
export function getSaleInitialStatus(): string {
  return 'create_sales'; // or 'pending_approval'
}
```

#### Task 1.2: Add Seller Fields to SaleCreate Form
**Duration:** 4 hours

**Implementation:**
```typescript
// Add to formData state:
const [formData, setFormData] = useState({
  sellerType: 'mansa_ressources', // default
  sellerId: '',
  customerId: '',
  ...
});

// Add seller selection UI:
<FormField label="Seller Type" required>
  <Select value={formData.sellerType} onChange={handleSellerTypeChange}>
    <option value="mining_company">Mining Company</option>
    <option value="mansa_ressources">Mansa Ressources S.A</option>
  </Select>
</FormField>

{formData.sellerType === 'mining_company' && (
  <FormField label="Mining Company" required>
    <Select value={formData.sellerId} onChange={handleSellerChange}>
      {miningCompanies.map(mc => (
        <option key={mc.id} value={mc.id}>{mc.name}</option>
      ))}
    </Select>
  </FormField>
)}

// Fetch filtered customers:
useEffect(() => {
  if (formData.sellerId && formData.sellerType) {
    fetchAllowedCustomers(formData.sellerId, formData.sellerType);
  }
}, [formData.sellerId, formData.sellerType]);
```

#### Task 1.3: Add Multi-Vendor Functions to salesService
**Duration:** 3 hours

```typescript
export async function getAllowedCustomersForSeller(
  sellerId: string,
  sellerType: string
) {
  const { data, error } = await supabase
    .rpc('get_allowed_customers_for_seller', {
      p_seller_id: sellerId,
      p_seller_type: sellerType
    });

  if (error) throw error;
  return { success: true, data };
}

export async function getMiningCompanies() {
  const { data, error } = await supabase
    .from('mining_companies')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return { success: true, data };
}

export async function validateSaleBusinessRules(
  sellerId: string,
  sellerType: string,
  customerId: string
) {
  const { data, error } = await supabase
    .rpc('is_valid_customer_for_seller', {
      p_seller_id: sellerId,
      p_seller_type: sellerType,
      p_customer_id: customerId
    });

  if (error) throw error;
  return {
    success: true,
    isValid: data[0]?.is_valid,
    errorMessage: data[0]?.error_message
  };
}
```

#### Task 1.4: Fix Auto Virtual Payment Trigger
**Duration:** 2 hours

**Database Fix:**
```sql
-- Modify trigger to NOT change status inline
-- Let the AFTER trigger handle it
CREATE OR REPLACE FUNCTION auto_create_virtual_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'customer_approved'
     AND OLD.status != 'customer_approved' THEN

    -- Create payment only
    INSERT INTO payments (...);

    -- DO NOT modify NEW.status here
    -- Let AFTER trigger handle status transition
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Code Fix:**
```typescript
// Remove status updates from customerApproveSale
// Trust database triggers to handle workflow
export async function customerApproveSale(
  saleId: string,
  customerEmail: string
) {
  // Just update to customer_approved
  // Triggers will handle rest
  const { error } = await supabase
    .from('sales')
    .update({ status: 'customer_approved' })
    .eq('id', saleId);

  if (error) throw error;
  return { success: true };
}
```

### Phase 2: Feature Implementation (MEDIUM PRIORITY)

#### Task 2.1: Create ReceivedPaymentForm Component
**Duration:** 6 hours

**Features:**
- Customer bank account selector
- Seller bank account selector
- Actual payment date picker
- Reference number input
- Customer FX rate input
- Payment proof file upload
- FX rate comparison preview

#### Task 2.2: Integrate FX Analysis
**Duration:** 4 hours

**Changes:**
```typescript
// In PaymentRecordPage.tsx
const handleRecordPayment = async (formData) => {
  // 1. Record real payment
  const paymentResult = await recordRealPayment({
    paymentId: virtualPayment.id,
    ...formData
  });

  // 2. Create FX analysis
  const fxResult = await createFxAnalysis({
    payment_id: paymentResult.paymentId,
    customer_rate: formData.customer_fx_rate,
    revolut_rate: currentMarketRates.revolut,
    ecb_rate: currentMarketRates.ecb,
    bceao_rate: currentMarketRates.bceao,
    amount_paid: formData.amount,
    payment_currency: formData.currency,
    currency_pair: formData.currency_pair,
    created_by: user.id
  });

  // 3. Display analysis results
  setFxAnalysis(fxResult.data);
};
```

#### Task 2.3: Create FxRateAnalysisPanel Component
**Duration:** 5 hours

**Features:**
- Real-time rate comparison table
- Gain/loss calculation display
- Visual indicators (green/red)
- Market spread analysis
- Historical comparison chart

#### Task 2.4: Add Workflow Visualization
**Duration:** 4 hours

**Component:** `SalesWorkflowVisualizer.tsx`
```typescript
const WORKFLOW_STEPS = [
  { status: 'create_sales', label: 'Created', icon: FileText },
  { status: 'pending_approval', label: 'Pending', icon: Clock },
  { status: 'customer_approved', label: 'Approved', icon: CheckCircle },
  { status: 'waiting_for_payment', label: 'Awaiting Payment', icon: DollarSign },
  { status: 'virtual_payment', label: 'Virtual Payment', icon: CreditCard },
  { status: 'payment_received', label: 'Paid', icon: CheckCircle },
  { status: 'completed', label: 'Completed', icon: Award },
];

// Render progress bar with current step highlighted
```

### Phase 3: Enhancements (LOW PRIORITY)

#### Task 3.1: Add Pre-validation for Status Transitions
**Duration:** 3 hours

#### Task 3.2: Create FX Analysis Dashboard
**Duration:** 8 hours

#### Task 3.3: Add Sales Audit Trail View
**Duration:** 6 hours

#### Task 3.4: Implement Email Notification Templates
**Duration:** 4 hours

---

## 5. TESTING REQUIREMENTS

### 5.1 Database Tests

```sql
-- Test 1: Business rule validation
INSERT INTO sales (seller_type, seller_id, customer_id, ...)
VALUES ('mining_company', '<mining-id>', '<wrong-customer-id>', ...);
-- Expected: ERROR - Mining company can only sell to Mansa

-- Test 2: Status transition validation
UPDATE sales SET status = 'completed' WHERE status = 'create_sales';
-- Expected: ERROR - Invalid transition

-- Test 3: Virtual payment auto-creation
UPDATE sales SET status = 'customer_approved' WHERE id = '<sale-id>';
-- Expected: Payment record created, status becomes 'waiting_for_payment'
```

### 5.2 Frontend Tests

```typescript
// Test 1: Seller selection filters customers
test('mining company can only see Mansa in customers', async () => {
  render(<SaleCreate />);
  selectSellerType('mining_company');
  selectSeller('Mining Co A');

  const customers = await getCustomerOptions();
  expect(customers).toHaveLength(1);
  expect(customers[0]).toContain('Mansa Ressources');
});

// Test 2: FX analysis calculates correctly
test('fx analysis shows gain when best rate higher', () => {
  const result = calculateFxAnalysis({
    customerRate: 600,
    revolutRate: 605,
    amount: 100000
  });

  expect(result.gainLossAmount).toBe(500000); // 100k * 5
  expect(result.bestSource).toBe('Revolut');
});
```

### 5.3 Integration Tests

```typescript
// Test complete workflow
test('complete sale workflow end-to-end', async () => {
  // 1. Create sale with seller
  const sale = await createSale({
    sellerType: 'mansa_ressources',
    customerId: auramettId,
    ...
  });
  expect(sale.status).toBe('pending_approval');

  // 2. Customer approves
  await customerApproveSale(sale.id);
  const updated = await getSale(sale.id);
  expect(updated.status).toBe('waiting_for_payment');

  // 3. Check virtual payment created
  const payments = await getPayments({ saleId: sale.id });
  expect(payments).toHaveLength(1);
  expect(payments[0].payment_type).toBe('virtual');

  // 4. Record real payment with FX
  await recordRealPayment(payments[0].id, {
    customerRate: 600,
    ...
  });

  // 5. Verify FX analysis created
  const fxAnalysis = await getFxAnalysis(payments[0].id);
  expect(fxAnalysis).toBeTruthy();
});
```

---

## 6. SUMMARY OF FINDINGS

### Critical Issues (Must Fix):
1. ✅ **Status value inconsistencies** - Database will reject sales
2. ✅ **Missing seller fields in form** - Cannot create valid sales
3. ✅ **Missing multi-vendor service functions** - Core functionality blocked
4. ✅ **Virtual payment trigger race condition** - Status may be inconsistent

### High Priority Gaps:
5. ✅ **No FX analysis integration** - Missing valuable feature
6. ✅ **No payment recording UI** - Cannot complete workflow
7. ✅ **Missing seller selection in UI** - Cannot enforce business rules
8. ✅ **No status transition pre-validation** - Poor user experience

### Medium Priority Gaps:
9. ✅ **No bank account selection** - Missing payment details
10. ✅ **No FX rate analysis UI** - Feature not accessible
11. ✅ **No workflow visualization** - User confusion

### Recommendations:
1. **Immediate:** Fix status inconsistencies and add seller fields (4-6 hours)
2. **Week 1:** Complete multi-vendor implementation (20 hours)
3. **Week 2:** Implement FX analysis integration (15 hours)
4. **Week 3:** Add workflow visualization and enhancements (12 hours)

**Total Estimated Effort:** 47-52 hours (6-7 development days)

---

## 7. CONCLUSION

The Sales and Payment workflow has a solid database foundation with comprehensive business rules, status transitions, and FX analysis capabilities. However, the frontend implementation is incomplete and contains critical bugs that prevent the system from functioning as designed.

**Key Strengths:**
- ✅ Robust database schema with proper constraints
- ✅ Comprehensive business rule validation
- ✅ Complete FX analysis infrastructure
- ✅ Automated virtual payment system
- ✅ Detailed audit logging

**Key Weaknesses:**
- ❌ Frontend forms don't capture required data
- ❌ Status values don't match database constraints
- ❌ Service layer missing critical functions
- ❌ No FX analysis user interface
- ❌ Incomplete payment recording flow
- ❌ No workflow visualization

**Priority:** Implement Phase 1 fixes immediately to restore basic functionality, then proceed with Phase 2 features to complete the workflow as designed.
