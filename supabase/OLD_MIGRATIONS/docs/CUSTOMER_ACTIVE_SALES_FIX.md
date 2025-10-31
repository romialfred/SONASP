# Customer Profile - Active Sales Database Integration

## Problem Identified

The "Active Sales" section in the customer profile page was displaying hardcoded mock data instead of real sales from the database.

### Previous Implementation (Hardcoded):
```typescript
const activeSales = [
  { saleNumber: 'SL-2024-044', status: 'pending', amount: 178900 },
  { saleNumber: 'SL-2024-045', status: 'approved', amount: 156200 },
];
```

**Issues:**
- ❌ Same data shown for all customers
- ❌ Not reflecting actual sales from database
- ❌ No way to update or manage real sales
- ❌ Misleading information for users

## Solution Implemented

### 1. Database Integration

Added real-time fetching of active sales from Supabase:

```typescript
// Fetch active sales for this specific customer
const { data: activeSalesData, error: activeSalesError } = await supabase
  .from('sales')
  .select('id, sale_number, status, final_proceeds')
  .eq('customer_id', id)  // ← Filter by customer ID
  .in('status', [
    'pending',           // Awaiting management approval
    'customer_pending',  // Sent to customer
    'approved',          // Management approved
    'customer_approved'  // Customer confirmed
  ])
  .order('created_at', { ascending: false })
  .limit(10);  // Show up to 10 most recent active sales
```

### 2. State Management

Added proper state for active sales:

```typescript
const [activeSales, setActiveSales] = useState<Array<{
  id: string;
  saleNumber: string;
  status: string;
  amount: number;
}>>([]);

// Set active sales after fetching
setActiveSales(mappedActiveSales);
```

### 3. Enhanced UI with Status Mapping

Improved status display with proper badges:

```typescript
const statusMap: Record<string, { label: string; variant: ... }> = {
  pending: { label: 'Pending', variant: 'warning' },
  customer_pending: { label: 'Customer Pending', variant: 'info' },
  approved: { label: 'Approved', variant: 'success' },
  customer_approved: { label: 'Customer Approved', variant: 'success' },
};
```

### 4. Empty State Handling

Added user-friendly message when no active sales exist:

```typescript
{activeSales.length === 0 ? (
  <div className="text-center py-6">
    <p className="text-sm text-gray-500">
      No active sales for this customer
    </p>
  </div>
) : (
  // Display sales list
)}
```

## Features Implemented

### ✅ Real-time Data
- Sales fetched from database based on customer ID
- Automatically updates when navigating between customers
- Shows actual sale numbers, statuses, and amounts

### ✅ Status-based Filtering
Active sales include only:
- **pending**: Awaiting management approval
- **customer_pending**: Submitted to customer
- **approved**: Management approved
- **customer_approved**: Customer confirmed

Excludes completed or rejected sales.

### ✅ Proper Navigation
- Click on any sale to view full details
- Uses sale ID for accurate routing
- Links to `/sales/{id}` page

### ✅ Status Badges
Different badge colors for different statuses:
- 🟡 **Pending** (Yellow - Warning)
- 🔵 **Customer Pending** (Blue - Info)
- 🟢 **Approved** (Green - Success)
- 🟢 **Customer Approved** (Green - Success)

## Database Schema

### sales table structure:
```sql
sales (
  id uuid PRIMARY KEY,
  sale_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id),
  final_proceeds numeric NOT NULL,
  status text CHECK (status IN (
    'pending',
    'customer_pending',
    'approved',
    'customer_approved',
    'payment_received',
    'completed',
    'rejected'
  )),
  created_at timestamptz DEFAULT now()
)
```

## Testing Checklist

### Test Active Sales Display:

1. **Customer with Active Sales:**
   - Navigate to customer profile (e.g., Auramet International)
   - Verify "Active Sales" section shows real sales
   - Check sale numbers match database
   - Verify amounts are correct
   - Confirm status badges display properly

2. **Customer without Active Sales:**
   - Navigate to customer with no pending sales
   - Verify empty state message appears
   - Message should say "No active sales for this customer"

3. **Sale Click Navigation:**
   - Click on any active sale
   - Should navigate to sale details page
   - URL should be `/sales/{sale-id}`
   - Details should match the clicked sale

4. **Multiple Customers:**
   - Navigate between different customers
   - Active sales should update for each customer
   - No sales should appear from other customers

## Database Verification Queries

### Check active sales for specific customer:
```sql
-- Replace {customer_id} with actual customer ID
SELECT 
  sale_number,
  status,
  final_proceeds,
  created_at
FROM sales
WHERE customer_id = '{customer_id}'
  AND status IN ('pending', 'customer_pending', 'approved', 'customer_approved')
ORDER BY created_at DESC
LIMIT 10;
```

### Check customer with most active sales:
```sql
SELECT 
  c.name,
  COUNT(s.id) as active_sales_count,
  SUM(s.final_proceeds) as total_active_value
FROM customers c
LEFT JOIN sales s ON s.customer_id = c.id
WHERE s.status IN ('pending', 'customer_pending', 'approved', 'customer_approved')
GROUP BY c.id, c.name
ORDER BY active_sales_count DESC;
```

### View all active sales with customer names:
```sql
SELECT 
  c.name as customer_name,
  s.sale_number,
  s.status,
  s.final_proceeds,
  s.created_at
FROM sales s
JOIN customers c ON c.id = s.customer_id
WHERE s.status IN ('pending', 'customer_pending', 'approved', 'customer_approved')
ORDER BY s.created_at DESC;
```

## Visual Comparison

### Before (Hardcoded Data):
```
Active Sales
━━━━━━━━━━━━━━━━━━━━━
SL-2024-044    [pending]
$178,900

SL-2024-045    [approved]
$156,200

↑ Same for ALL customers ❌
```

### After (Real Database Data):
```
Auramet Customer:
━━━━━━━━━━━━━━━━━━━━━
SL-2025-015    [pending]
$245,890

SL-2025-012    [approved]
$198,450

StoneX Customer:
━━━━━━━━━━━━━━━━━━━━━
SL-2025-018    [customer_pending]
$312,000

↑ Different for each customer ✅
```

## Files Modified

**src/pages/customers/CustomerProfile.tsx**
- Added `activeSales` state management
- Implemented database fetch for active sales
- Added status mapping with proper badges
- Implemented empty state handling
- Fixed sale navigation to use sale ID

## Benefits

### For Users:
✅ Accurate real-time sales data
✅ See actual pending sales per customer
✅ Click to view full sale details
✅ Clear status indication with colored badges
✅ Professional, reliable interface

### For Business:
✅ Track active sales per customer
✅ Monitor pending approvals
✅ Identify customers with most active sales
✅ Better sales pipeline visibility
✅ Data-driven decision making

### For Developers:
✅ Single source of truth (database)
✅ No hardcoded data to maintain
✅ Automatic updates when sales change
✅ Proper error handling
✅ Scalable architecture

## Edge Cases Handled

1. **No Active Sales:**
   - Shows friendly empty state message
   - Doesn't break UI layout

2. **Many Active Sales:**
   - Limits to 10 most recent
   - Orders by creation date (newest first)
   - Keeps UI clean and performant

3. **Invalid Customer:**
   - Already handled by parent loading logic
   - Won't attempt to fetch sales for null customer

4. **Database Errors:**
   - Logs error to console
   - Shows empty array (safe fallback)
   - Doesn't crash the page

## Status Definitions

| Status | Meaning | Badge Color |
|--------|---------|-------------|
| **pending** | Awaiting management approval | Yellow (Warning) |
| **customer_pending** | Sent to customer for approval | Blue (Info) |
| **approved** | Management approved, pending customer | Green (Success) |
| **customer_approved** | Customer confirmed, processing payment | Green (Success) |

**Not shown in Active Sales:**
- `payment_received` - Moved to Transaction History
- `completed` - Moved to Transaction History
- `rejected` - Not shown (rejected sales)

## Success Criteria

The fix is successful when:
1. ✅ Each customer shows their own active sales
2. ✅ Sale numbers from database are displayed
3. ✅ Amounts match database values
4. ✅ Status badges show correct colors
5. ✅ Clicking sale navigates to correct details page
6. ✅ Empty state appears when no active sales
7. ✅ Data updates when switching customers
8. ✅ No hardcoded sale numbers appear

## Next Steps

To further enhance the Active Sales section:

1. **Add Sale Date:**
   - Display when each sale was created
   - Show relative time ("2 days ago")

2. **Add Quantity:**
   - Show gold quantity (oz) for each sale
   - Display both quantity and value

3. **Add Filtering:**
   - Filter by status
   - Sort by amount or date

4. **Add Actions:**
   - Quick approve button for managers
   - View details without navigation
   - Download sale documents

## Related Improvements

This fix complements other customer profile improvements:
- ✅ Customer details from database
- ✅ Sales metrics from database
- ✅ **Active Sales from database** (this fix)
- 🔲 Transaction History from database (pending)
- 🔲 Performance Chart from database (pending)
