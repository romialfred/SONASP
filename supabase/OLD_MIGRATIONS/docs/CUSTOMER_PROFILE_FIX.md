# Customer Profile Page - Dynamic Data Fix

## Problem Identified

When clicking on any customer in the "Parties-prenantes > Clients" menu, the profile page always displayed the details of "Premium Gold Ltd." (the first customer in the hardcoded list), regardless of which customer was clicked.

### Root Cause

The `CustomerProfile.tsx` component was using hardcoded mock data:

```typescript
const mockCustomers = [
  { id: '1', name: 'Premium Gold Ltd.', ... },
  { id: '2', name: 'Global Metals Inc.', ... },
  // ... more hardcoded customers
];

const customer = mockCustomers.find((c) => c.id === id) || mockCustomers[0];
```

**Problem:** When the `id` from the URL didn't match any hardcoded ID, it would always fall back to `mockCustomers[0]` (Premium Gold Ltd.).

## Solution Implemented

### 1. Database Integration

Replaced hardcoded data with real-time database fetching:

```typescript
const fetchCustomerDetails = async () => {
  // Fetch customer data from Supabase
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)  // ← Uses the ACTUAL customer ID from URL
    .single();

  // Fetch sales data for THIS specific customer
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('quantity_oz, final_proceeds, created_at, status')
    .eq('customer_id', id)  // ← Filters sales by customer ID
    .in('status', ['approved', 'customer_approved', 'payment_received', 'completed']);

  // Calculate real metrics
  const totalPurchases = sales.length;
  const totalSpent = sales.reduce((sum, sale) => sum + parseFloat(sale.final_proceeds || '0'), 0);
  const averageOrderValue = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
  
  setCustomer({ ...customerData, ...calculatedMetrics });
};
```

### 2. Real-time Data Updates

The component now:
- ✅ Fetches customer data based on URL parameter `id`
- ✅ Calculates metrics from actual sales data
- ✅ Updates whenever the customer ID changes
- ✅ Shows loading state while fetching
- ✅ Displays error if customer not found

### 3. Enhanced User Experience

Added proper state management:

```typescript
const [customer, setCustomer] = useState<Customer | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchCustomerDetails();
}, [id]);  // ← Re-fetches when ID changes
```

### 4. Error Handling

Added comprehensive error handling:

```typescript
if (loading) {
  return <Loading />;
}

if (error || !customer) {
  return (
    <Alert variant="error" title="Unable to load customer">
      {error || 'Customer not found'}
    </Alert>
  );
}
```

## Database Schema Expected

### customers table:
```sql
customers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  country text NOT NULL,
  address text,
  contact_person text,
  tax_id text,
  payment_terms text,
  credit_limit numeric,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
)
```

### sales table (for metrics):
```sql
sales (
  id uuid PRIMARY KEY,
  customer_id uuid REFERENCES customers(id),
  quantity_oz numeric,
  final_proceeds numeric,
  status text,
  created_at timestamptz DEFAULT now()
)
```

## Metrics Calculation

The profile now calculates real metrics:

1. **Total Purchases**: Count of all completed sales for this customer
2. **Total Spent**: Sum of `final_proceeds` from all sales
3. **Average Order Value**: Total Spent / Total Purchases
4. **Last Purchase Date**: Most recent sale `created_at`
5. **Payment Rate**: Placeholder (0%) - requires payment tracking implementation

## Testing Checklist

### Test with Auramet International:
- [ ] Navigate to Parties-prenantes > Clients
- [ ] Click on "Auramet International"
- [ ] Verify page title shows "Auramet International" (not "Premium Gold Ltd.")
- [ ] Verify email shows "trading@auramet.com"
- [ ] Verify country shows "United States"
- [ ] Check metrics display correct sales data

### Test with StoneX Group Inc.:
- [ ] Navigate to Parties-prenantes > Clients
- [ ] Click on "StoneX Group Inc."
- [ ] Verify page title shows "StoneX Group Inc." (not "Premium Gold Ltd.")
- [ ] Verify email shows "metals@stonex.com"
- [ ] Verify country shows "United States"
- [ ] Check metrics display correct sales data

### Test Direct URL Access:
```
# Get customer IDs from database
SELECT id, name FROM customers;

# Test direct navigation
/customers/{auramet-id}  → Should show Auramet details
/customers/{stonex-id}   → Should show StoneX details
/customers/invalid-id    → Should show error message
```

## Database Verification Queries

### Check customers exist:
```sql
SELECT id, name, email, country 
FROM customers 
ORDER BY name;
```

### Check sales data:
```sql
SELECT 
  c.name as customer_name,
  COUNT(s.id) as total_purchases,
  SUM(s.final_proceeds) as total_spent,
  AVG(s.final_proceeds) as avg_order_value
FROM customers c
LEFT JOIN sales s ON s.customer_id = c.id
WHERE s.status IN ('approved', 'customer_approved', 'payment_received', 'completed')
GROUP BY c.id, c.name
ORDER BY c.name;
```

### Test specific customer:
```sql
-- Replace {customer_id} with actual ID
SELECT 
  c.*,
  COUNT(s.id) as purchases,
  SUM(s.final_proceeds) as total_spent
FROM customers c
LEFT JOIN sales s ON s.customer_id = c.id
WHERE c.id = '{customer_id}'
GROUP BY c.id;
```

## Files Modified

**src/pages/customers/CustomerProfile.tsx**
- Added database integration with Supabase
- Removed hardcoded mock data
- Added dynamic customer fetching based on URL parameter
- Implemented real-time metrics calculation
- Added loading and error states
- Enhanced user experience with proper feedback

## Visual Comparison

### Before (Always showing Premium Gold Ltd.):
```
Click Auramet     → Shows: Premium Gold Ltd. ❌
Click StoneX      → Shows: Premium Gold Ltd. ❌
Click Any Customer → Shows: Premium Gold Ltd. ❌
```

### After (Shows correct customer):
```
Click Auramet     → Shows: Auramet International ✅
Click StoneX      → Shows: StoneX Group Inc. ✅
Click Any Customer → Shows: That Specific Customer ✅
```

## Benefits

### For Users:
✅ Accurate customer information displayed
✅ Real-time data from database
✅ Correct metrics for each customer
✅ Reliable navigation between customers
✅ Professional user experience

### For Developers:
✅ No hardcoded data to maintain
✅ Single source of truth (database)
✅ Easier to add new customers
✅ Better error handling
✅ Cleaner, more maintainable code

## Known Limitations

1. **Payment Rate**: Currently shows 0% as payment tracking is not yet implemented
2. **Transaction History**: Still uses mock data (requires separate fix)
3. **Active Sales**: Still uses mock data (requires separate fix)
4. **Performance Chart**: Still uses mock data (requires separate fix)

## Next Steps

To fully complete the customer profile:

1. **Implement Transaction History:**
   - Fetch real sales from database
   - Display actual transaction dates and amounts
   - Link to real sale details pages

2. **Implement Active Sales:**
   - Fetch pending/approved sales for customer
   - Show real sale numbers and statuses
   - Link to actual sale pages

3. **Implement Payment Rate:**
   - Track payment confirmations
   - Calculate success rate from payment data
   - Display accurate payment metrics

4. **Implement Performance Chart:**
   - Calculate monthly aggregates from sales data
   - Display real purchase trends over time
   - Add date range selector

## Success Criteria

The fix is successful when:
1. ✅ Each customer shows their own unique details
2. ✅ Customer name in header matches selected customer
3. ✅ Email, phone, country are specific to that customer
4. ✅ Metrics reflect that customer's actual sales
5. ✅ No fallback to "Premium Gold Ltd."
6. ✅ Error message shown for invalid customer IDs
7. ✅ Loading state displays while fetching data
