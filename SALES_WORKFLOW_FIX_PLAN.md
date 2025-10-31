# Sales & Payment Workflow - Implementation Plan

## Overview

This document outlines the step-by-step plan to fix all identified gaps and bugs in the Sales and Payment workflow. Tasks are organized by priority with clear implementation steps.

---

## PHASE 1: CRITICAL FIXES (Day 1-2)

### Task 1.1: Fix Status Value Inconsistencies
**Priority:** P0 - BLOCKER
**Duration:** 1 hour
**Files:**
- `src/pages/sales/SaleCreate.tsx`
- `src/pages/sales/SalesDashboard.tsx`
- `src/lib/schemas/sales.ts`

**Steps:**

1. Create status constants file:
```typescript
// src/constants/salesStatuses.ts
export const SALES_STATUSES = {
  CREATE_SALES: 'create_sales',
  PENDING_APPROVAL: 'pending_approval',
  CUSTOMER_REJECTED: 'customer_rejected',
  CUSTOMER_APPROVED: 'customer_approved',
  WAITING_FOR_PAYMENT: 'waiting_for_payment',
  VIRTUAL_PAYMENT: 'virtual_payment',
  PAYMENT_RECEIVED: 'payment_received',
  COMPLETED: 'completed'
} as const;

export type SalesStatus = typeof SALES_STATUSES[keyof typeof SALES_STATUSES];

export const INITIAL_SALE_STATUS = SALES_STATUSES.PENDING_APPROVAL;
```

2. Update SaleCreate.tsx:
```typescript
import { INITIAL_SALE_STATUS } from '@/constants/salesStatuses';

// Line 214: Change from 'customer_pending' to:
status: INITIAL_SALE_STATUS,
```

3. Update SalesDashboard.tsx:
```typescript
import { SALES_STATUSES } from '@/constants/salesStatuses';

// Line 114: Change from 'approved', 'customer_pending' to:
.in('status', [
  SALES_STATUSES.PENDING_APPROVAL,
  SALES_STATUSES.CUSTOMER_APPROVED,
  SALES_STATUSES.PAYMENT_RECEIVED,
  SALES_STATUSES.COMPLETED
]);
```

4. Update sales.ts schema:
```typescript
// Update status validation to use correct values
```

**Verification:**
```bash
# Create a test sale and verify it inserts successfully
# Check that status is 'pending_approval' in database
```

---

### Task 1.2: Create Multi-Vendor Service Functions
**Priority:** P0 - BLOCKER
**Duration:** 2 hours
**Files:**
- `src/services/salesService.ts` (update)
- `src/types/sales.ts` (new)

**Steps:**

1. Create types file:
```typescript
// src/types/sales.ts
export interface MiningCompany {
  id: string;
  name: string;
  code: string;
  country: string;
  is_active: boolean;
}

export interface AllowedCustomer {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_country: string;
}

export type SellerType = 'mining_company' | 'mansa_ressources';
```

2. Add functions to salesService.ts:
```typescript
export async function getMiningCompanies(): Promise<{
  success: boolean;
  data?: MiningCompany[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, name, code, country, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAllowedCustomersForSeller(
  sellerId: string,
  sellerType: SellerType
): Promise<{
  success: boolean;
  data?: AllowedCustomer[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .rpc('get_allowed_customers_for_seller', {
        p_seller_id: sellerId,
        p_seller_type: sellerType
      });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function validateSaleBusinessRules(
  sellerId: string,
  sellerType: SellerType,
  customerId: string
): Promise<{
  success: boolean;
  isValid?: boolean;
  errorMessage?: string;
}> {
  try {
    const { data, error } = await supabase
      .rpc('is_valid_customer_for_seller', {
        p_seller_id: sellerId,
        p_seller_type: sellerType,
        p_customer_id: customerId
      });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      isValid: result?.is_valid || false,
      errorMessage: result?.error_message
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMansaRessourcesCustomerId(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .or('name.ilike.%mansa%ressources%,name.ilike.%mansa%resources%')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data: data?.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
```

**Verification:**
```typescript
// Test each function
const companies = await getMiningCompanies();
console.log('Mining companies:', companies);

const customers = await getAllowedCustomersForSeller(
  '<mining-company-id>',
  'mining_company'
);
console.log('Allowed customers:', customers);
```

---

### Task 1.3: Add Seller Fields to SaleCreate Form
**Priority:** P0 - BLOCKER
**Duration:** 4 hours
**Files:**
- `src/pages/sales/SaleCreate.tsx`

**Steps:**

1. Add seller state to form:
```typescript
const [formData, setFormData] = useState({
  sellerType: 'mansa_ressources' as SellerType,
  sellerId: '',
  customerId: '',
  quantityOz: initialQuantity || 0,
  londonAMRate: mechanismData?.pricePerOz.toFixed(2) || '2450.00',
  freightCost: '',
  otherCosts: '',
  mechanismType: mechanismData?.mechanism || '',
  mechanismDisplayName: mechanismData?.displayName || ''
});

const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
const [mansaCustomerId, setMansaCustomerId] = useState<string>('');
```

2. Fetch mining companies and Mansa ID on mount:
```typescript
useEffect(() => {
  fetchMiningCompanies();
  fetchMansaId();
}, []);

const fetchMiningCompanies = async () => {
  const result = await getMiningCompanies();
  if (result.success && result.data) {
    setMiningCompanies(result.data);
  }
};

const fetchMansaId = async () => {
  const result = await getMansaRessourcesCustomerId();
  if (result.success && result.data) {
    setMansaCustomerId(result.data);
    // Auto-set seller ID if Mansa
    if (formData.sellerType === 'mansa_ressources') {
      setFormData(prev => ({ ...prev, sellerId: result.data }));
    }
  }
};
```

3. Update customer fetching logic:
```typescript
const fetchCustomers = async () => {
  try {
    // If seller is selected, get allowed customers
    if (formData.sellerId && formData.sellerType) {
      const result = await getAllowedCustomersForSeller(
        formData.sellerId,
        formData.sellerType
      );

      if (result.success && result.data) {
        const customersList = result.data.map(c => ({
          id: c.customer_id,
          name: c.customer_name,
          email: c.customer_email,
          country: c.customer_country,
          ytdGoldSold: 0,
          ytdAvgPrice: 0,
          ytdAmount: 0,
          isBestCustomer: false
        }));

        setCustomers(customersList);
      }
    } else {
      // Fallback to all active customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('status', 'active')
        .order('name');

      setCustomers(customersData || []);
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
  } finally {
    setLoading(false);
  }
};

// Re-fetch customers when seller changes
useEffect(() => {
  if (formData.sellerId) {
    fetchCustomers();
  }
}, [formData.sellerId, formData.sellerType]);
```

4. Add seller UI section:
```typescript
{/* Add BEFORE customer selection field */}

<Card>
  <CardHeader>
    <CardTitle>Seller Information</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <FormField label="Seller Type" required>
        <Select
          value={formData.sellerType}
          onChange={(e) => {
            const newType = e.target.value as SellerType;
            setFormData(prev => ({
              ...prev,
              sellerType: newType,
              sellerId: newType === 'mansa_ressources' ? mansaCustomerId : '',
              customerId: '' // Reset customer selection
            }));
          }}
        >
          <option value="mining_company">Mining Company Sale</option>
          <option value="mansa_ressources">Mansa Ressources Sale</option>
        </Select>
      </FormField>

      {formData.sellerType === 'mining_company' && (
        <FormField label="Mining Company" required error={errors.sellerId}>
          <Select
            value={formData.sellerId}
            onChange={(e) => handleInputChange('sellerId', e.target.value)}
            error={!!errors.sellerId}
          >
            <option value="">Select a mining company</option>
            {miningCompanies.map(mc => (
              <option key={mc.id} value={mc.id}>
                {mc.name} ({mc.code})
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {formData.sellerType === 'mansa_ressources' && (
        <Alert type="info" title="Mansa Ressources Selected">
          Selling as Mansa Ressources S.A. - You can only sell to approved external customers (Auramet, StoneX).
        </Alert>
      )}

      {formData.sellerType === 'mining_company' && formData.sellerId && (
        <Alert type="warning" title="Internal Sale">
          This is an internal sale. Mining companies can only sell to Mansa Ressources S.A.
        </Alert>
      )}
    </div>
  </CardContent>
</Card>
```

5. Update form submission to include seller fields:
```typescript
const { data, error } = await supabase
  .from('sales')
  .insert([
    {
      sale_number: saleNumber,
      sale_date: new Date().toISOString().split('T')[0],
      seller_id: formData.sellerId,
      seller_type: formData.sellerType,
      is_internal_sale: formData.sellerType === 'mining_company',
      customer_id: formData.customerId,
      quantity_oz: parseFloat(formData.quantityOz),
      london_am_rate: parseFloat(formData.londonAMRate),
      freight_cost: parseFloat(formData.freightCost) || 0,
      other_costs: parseFloat(formData.otherCosts) || 0,
      gross_proceeds: calculations.grossProceeds,
      net_proceeds: calculations.netProceeds,
      royalties: calculations.royalties,
      final_proceeds: calculations.finalAmount,
      total_amount: calculations.finalAmount,
      currency: 'USD',
      status: INITIAL_SALE_STATUS,
      mechanism_type: formData.mechanismType || null,
      created_by: user?.id
    }
  ])
  .select()
  .single();
```

6. Add validation for seller fields:
```typescript
const validateForm = (): boolean => {
  const newErrors: Record<string, string> = {};

  // Seller validation
  if (!formData.sellerId) {
    newErrors.sellerId = 'Please select a seller';
  }

  // Validate business rules
  if (formData.sellerId && formData.customerId) {
    const validation = await validateSaleBusinessRules(
      formData.sellerId,
      formData.sellerType,
      formData.customerId
    );

    if (validation.success && !validation.isValid) {
      newErrors.customerId = validation.errorMessage || 'Invalid customer selection';
    }
  }

  // ... rest of existing validation
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

**Verification:**
```typescript
// Test 1: Select mining company, verify only Mansa appears in customers
// Test 2: Select Mansa, verify only Auramet/StoneX appear
// Test 3: Submit form, verify seller fields saved correctly
// Test 4: Try invalid combination, verify error message
```

---

### Task 1.4: Fix Virtual Payment Trigger Logic
**Priority:** P1 - HIGH
**Duration:** 1.5 hours
**Files:**
- `supabase/migrations/20251101000005_create_auto_virtual_payment_trigger.sql` (review)
- `src/services/salesService.ts`

**Steps:**

1. Create new migration to fix trigger:
```sql
-- supabase/migrations/20251101100000_fix_virtual_payment_trigger.sql

/*
  # Fix Virtual Payment Trigger Race Condition

  1. Changes
    - Modify auto_create_virtual_payment to NOT modify status
    - Let AFTER trigger handle status transition cleanly
    - Remove redundant status updates
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_auto_create_virtual_payment ON sales;
DROP TRIGGER IF EXISTS trigger_update_sale_virtual_payment_status ON payments;

-- Recreate with fixed logic
CREATE OR REPLACE FUNCTION auto_create_virtual_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id uuid;
  v_reference_number text;
  v_expected_date date;
  v_payment_terms_days integer := 30;
BEGIN
  -- Only proceed if status changed TO customer_approved
  IF TG_OP = 'UPDATE' AND NEW.status = 'customer_approved'
     AND OLD.status != 'customer_approved' THEN

    -- Generate unique payment reference
    v_reference_number := 'VP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                          LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0');

    -- Calculate expected payment date
    v_expected_date := COALESCE(NEW.sale_date, NEW.created_at::date) + v_payment_terms_days;

    -- Create virtual payment record
    INSERT INTO payments (
      sale_id, customer_id, amount, currency,
      expected_date, reference_number,
      bank_name, payment_method, payment_type,
      is_virtual, status, notes, created_by, created_at
    ) VALUES (
      NEW.id, NEW.customer_id, NEW.gross_proceeds,
      COALESCE(NEW.currency, 'USD'), v_expected_date,
      v_reference_number, 'Virtual Payment - Pending',
      'wire_transfer', 'virtual', true, 'pending',
      'Auto-generated virtual payment on customer approval',
      NEW.created_by, now()
    ) RETURNING id INTO v_payment_id;

    -- Log audit trail
    INSERT INTO audit_logs (user_id, user_email, action, module, details, status, created_at)
    SELECT NEW.created_by, u.email, 'AUTO_CREATE_VIRTUAL_PAYMENT', 'Sales',
           'Virtual payment ' || v_reference_number || ' created for sale ' || NEW.sale_number,
           'success', now()
    FROM auth.users u WHERE u.id = NEW.created_by;

    RAISE NOTICE 'Virtual payment % created for sale %', v_reference_number, NEW.sale_number;

    -- DO NOT modify status here - let AFTER trigger handle it
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate BEFORE trigger
CREATE TRIGGER trigger_auto_create_virtual_payment
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_virtual_payment();

-- Create improved AFTER trigger for status update
CREATE OR REPLACE FUNCTION update_sale_to_waiting_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- After virtual payment created, update sale to waiting_for_payment
  IF TG_OP = 'INSERT' AND NEW.is_virtual = true AND NEW.payment_type = 'virtual' THEN

    -- Update sale status
    UPDATE sales
    SET status = 'waiting_for_payment',
        updated_at = now()
    WHERE id = NEW.sale_id
      AND status = 'customer_approved';

    RAISE NOTICE 'Sale % status updated to waiting_for_payment', NEW.sale_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create AFTER trigger on payments
CREATE TRIGGER trigger_update_sale_waiting_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_to_waiting_payment();

COMMENT ON FUNCTION auto_create_virtual_payment IS
  'Creates virtual payment on customer approval without modifying sale status';
COMMENT ON FUNCTION update_sale_to_waiting_payment IS
  'Updates sale to waiting_for_payment after virtual payment creation';
```

2. Simplify salesService.ts:
```typescript
export async function customerApproveSale(
  saleId: string,
  customerEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Just update status to customer_approved
    // Database triggers will handle:
    // 1. Creating virtual payment (BEFORE trigger)
    // 2. Updating status to waiting_for_payment (AFTER trigger)

    const { error } = await supabase
      .from('sales')
      .update({
        status: 'customer_approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', saleId);

    if (error) {
      console.error('[customerApproveSale] Error:', error);
      return { success: false, error: error.message };
    }

    // Log audit action
    await logAuditAction({
      action: 'customer_approved_sale',
      table_name: 'sales',
      record_id: saleId,
      details: {
        customer_email: customerEmail,
        approved_at: new Date().toISOString()
      },
      user_email: customerEmail,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[customerApproveSale] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}
```

**Verification:**
```sql
-- Test trigger
UPDATE sales
SET status = 'customer_approved'
WHERE id = '<test-sale-id>';

-- Verify:
-- 1. Payment record created with payment_type = 'virtual'
-- 2. Sale status = 'waiting_for_payment'
-- 3. Audit log entry exists

SELECT * FROM payments WHERE sale_id = '<test-sale-id>';
SELECT status FROM sales WHERE id = '<test-sale-id>';
SELECT * FROM audit_logs WHERE record_id = '<test-sale-id>' ORDER BY created_at DESC;
```

---

## PHASE 2: FEATURE IMPLEMENTATION (Day 3-5)

### Task 2.1: Create Payment Recording UI
**Priority:** P1 - HIGH
**Duration:** 6 hours
**Files:**
- `src/pages/payments/RecordPaymentPage.tsx` (new)
- `src/components/payments/RecordPaymentForm.tsx` (new)

### Task 2.2: Integrate FX Rate Analysis
**Priority:** P1 - HIGH
**Duration:** 5 hours
**Files:**
- `src/components/payments/FxRateAnalysisPanel.tsx` (new)
- `src/pages/payments/RecordPaymentPage.tsx` (update)
- `src/services/paymentService.ts` (update)

### Task 2.3: Create Workflow Visualizer
**Priority:** P2 - MEDIUM
**Duration:** 4 hours
**Files:**
- `src/components/sales/SalesWorkflowVisualizer.tsx` (new)
- `src/pages/sales/SaleDetails.tsx` (update)

### Task 2.4: Add Status Transition Pre-Validation
**Priority:** P2 - MEDIUM
**Duration:** 3 hours
**Files:**
- `src/services/salesService.ts` (update)
- `src/hooks/useSaleActions.ts` (new)

---

## PHASE 3: TESTING & POLISH (Day 6-7)

### Task 3.1: Create Integration Tests
**Duration:** 4 hours

### Task 3.2: Add Error Handling & Loading States
**Duration:** 3 hours

### Task 3.3: Documentation & User Guide
**Duration:** 2 hours

---

## ROLLOUT PLAN

### Step 1: Database Migrations (30 minutes)
```bash
# Apply migrations in order
1. Status fix (if needed)
2. Virtual payment trigger fix

# Verify all migrations successful
```

### Step 2: Deploy Backend Changes (1 hour)
```bash
# Deploy updated services
# Test all RPC functions
# Verify triggers working
```

### Step 3: Deploy Frontend Changes (1 hour)
```bash
# Build and deploy
# Test seller selection
# Test sale creation end-to-end
```

### Step 4: User Training (2 hours)
- Demo new seller selection
- Explain internal vs external sales
- Show workflow visualization
- Train on FX analysis

---

## SUCCESS CRITERIA

- ✅ Can create sale with mining company seller
- ✅ Mining company can only select Mansa as customer
- ✅ Mansa can only select Auramet/StoneX as customers
- ✅ Virtual payment auto-created on customer approval
- ✅ Sale transitions through all 7 statuses correctly
- ✅ FX analysis recorded for real payments
- ✅ No database constraint violations
- ✅ All audit logs captured
- ✅ Workflow visualizer shows current step

---

## ROLLBACK PLAN

If issues occur:

1. **Database:** Keep old migrations, add new ones to revert
2. **Frontend:** Deploy previous version from git
3. **Data:** No data loss - all changes are additive

---

## ESTIMATED TIMELINE

- **Phase 1 (Critical):** 8.5 hours = 1-2 days
- **Phase 2 (Features):** 18 hours = 2-3 days
- **Phase 3 (Testing):** 9 hours = 1-2 days

**Total:** 35.5 hours ≈ 4-5 working days
