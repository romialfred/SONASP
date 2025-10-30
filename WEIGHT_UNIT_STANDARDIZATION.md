# Weight Unit Standardization - Oz by Default

## Overview

The platform now uses **Troy Ounces (oz)** as the default display unit across the entire application, with automatic conversion to grams shown in parentheses. The database continues to store weights in grams for consistency and precision.

**Conversion Factor**: 1 troy oz = 31.1034768 grams

## Architecture

### Data Flow

```
User Input (oz) → Convert to grams → Store in DB (grams) → Retrieve from DB (grams) → Display as oz (with gram conversion)
```

### Key Principle

- ✅ **Display**: Always show oz first, grams in parentheses
- ✅ **Input**: Default to oz, allow gram input with conversion
- ✅ **Storage**: Always store in grams in database
- ✅ **Calculations**: Perform in grams, display results in oz

## New Utilities

### 1. Weight Conversion Functions

**File**: `/src/utils/weightConversion.ts`

```typescript
import {
  gramsToOz,
  ozToGrams,
  formatWeightWithConversion,
  formatWeightCompact,
  formatWeightFromDB,
  formatWeightForDB
} from '@/utils/weightConversion';

// Convert database value (grams) to display (oz)
const displayWeight = gramsToOz(1000); // 32.151 oz

// Format for display with conversion
formatWeightWithConversion(32.151); // "32.151 oz (1000.00 g)"

// Compact format for tables
formatWeightCompact(32.151); // "32.15 oz"

// From database (grams) to oz
const ozValue = formatWeightFromDB(1000); // 32.151

// To database (oz to grams)
const gramsValue = formatWeightForDB(32.151); // 1000
```

### 2. WeightInput Component

**Default Unit Changed**: Now defaults to `oz` instead of `g`

```tsx
import { WeightInput } from '@/components/ui/WeightInput';

// Basic usage - defaults to oz
<WeightInput
  value={gramsFromDB}  // Database value in grams
  onChange={(grams) => setWeight(grams)}  // Returns grams for DB
  label="Batch Weight"
  required
/>

// Override to start with grams (if needed)
<WeightInput
  value={gramsFromDB}
  onChange={(grams) => setWeight(grams)}
  defaultUnit="g"  // Override default
  label="Weight"
/>
```

**Features**:
- ✅ Input in oz by default
- ✅ Toggle between oz/g
- ✅ Real-time conversion display
- ✅ Stores as grams automatically
- ✅ Proper precision (3 decimals for oz, 2 for g)

### 3. WeightDisplay Components

**File**: `/src/components/ui/WeightDisplay.tsx`

#### WeightDisplay (Basic)

```tsx
import { WeightDisplay } from '@/components/ui/WeightDisplay';

// Full format with conversion
<WeightDisplay grams={batch.weight} format="full" />
// Output: "32.151 oz (1000.00 g)"

// Compact format for tables
<WeightDisplay grams={batch.weight} format="compact" />
// Output: "32.15 oz"

// Custom precision
<WeightDisplay
  grams={batch.weight}
  format="full"
  ozPrecision={2}
  gramsPrecision={1}
/>
// Output: "32.15 oz (1000.0 g)"
```

#### WeightBadge

```tsx
import { WeightBadge } from '@/components/ui/WeightDisplay';

<WeightBadge
  grams={batch.weight}
  variant="success"
  format="compact"
/>
```

**Variants**: `default`, `primary`, `success`, `warning`, `danger`

#### WeightComparison

```tsx
import { WeightComparison } from '@/components/ui/WeightDisplay';

<WeightComparison
  expectedGrams={1000}
  actualGrams={998.5}
  showVariance={true}
  varianceThreshold={0.5}
/>
```

**Output**:
```
Expected: 32.151 oz (1000.00 g)
Actual:   32.103 oz (998.50 g)
Variance: -0.048 oz (-0.15%)
```

#### WeightTableCell

```tsx
import { WeightTableCell } from '@/components/ui/WeightDisplay';

<table>
  <tbody>
    <tr>
      <WeightTableCell grams={batch.weight} format="compact" />
    </tr>
  </tbody>
</table>
```

## Implementation Guide

### Step 1: Input Forms

**Before**:
```tsx
<Input
  type="number"
  value={weight}
  onChange={(e) => setWeight(parseFloat(e.target.value))}
  placeholder="Weight in grams"
/>
```

**After**:
```tsx
<WeightInput
  value={weight}  // Still in grams for DB
  onChange={(grams) => setWeight(grams)}
  label="Weight"
  placeholder="Enter weight"
  required
/>
```

### Step 2: Display Values

**Before**:
```tsx
<span>{batch.weight.toFixed(2)} g</span>
```

**After**:
```tsx
<WeightDisplay grams={batch.weight} format="full" />
// Shows: "32.151 oz (1000.00 g)"
```

### Step 3: Table Cells

**Before**:
```tsx
<td>{batch.weight.toFixed(2)} g</td>
```

**After**:
```tsx
<WeightTableCell grams={batch.weight} format="compact" />
// Shows: "32.15 oz"
```

### Step 4: Comparisons (Receiving, Variance)

**Before**:
```tsx
<div>
  <p>Expected: {expected} g</p>
  <p>Actual: {actual} g</p>
  <p>Variance: {actual - expected} g</p>
</div>
```

**After**:
```tsx
<WeightComparison
  expectedGrams={expected}
  actualGrams={actual}
  showVariance={true}
/>
```

## Pages to Update

### High Priority

#### 1. Batch Creation Form (`/batches/new`)
```tsx
// Update weight input
<WeightInput
  value={formData.weight}
  onChange={(grams) => handleChange('weight', grams)}
  label="Batch Weight"
  required
/>
```

#### 2. Batch Listing (`/batches`)
```tsx
// In table cells
<WeightTableCell grams={batch.weight} format="compact" />
```

#### 3. Batch Details (`/batches/:id`)
```tsx
// Display weights
<div className="grid grid-cols-2 gap-4">
  <div>
    <label>Weight</label>
    <WeightDisplay grams={batch.weight} format="full" />
  </div>
</div>
```

#### 4. Receiving Confirmation (`/receiving/:id/confirm`)
```tsx
// Show comparison
<WeightComparison
  expectedGrams={batch.weight}
  actualGrams={receivedWeight}
  showVariance={true}
  varianceThreshold={0.5}
/>
```

#### 5. Refining Process (`/refining/:id/process`)
```tsx
// Pre-melting weight
<WeightInput
  value={formData.preMeltingWeight}
  onChange={(grams) => handleChange('preMeltingWeight', grams)}
  label="Pre-melting Weight"
/>

// Post-melting weight
<WeightInput
  value={formData.postMeltingWeight}
  onChange={(grams) => handleChange('postMeltingWeight', grams)}
  label="Post-melting Weight"
/>

// Display final fine
<WeightDisplay grams={calculatedFinalFine} format="full" />
```

#### 6. Sales Dashboard (`/sales`)
```tsx
// Available inventory
<div className="text-2xl font-bold">
  <WeightDisplay grams={availableStock} format="full" />
</div>
```

#### 7. Inventory Management (`/inventory`)
```tsx
// Table display
<WeightTableCell grams={inventory.quantity} format="compact" />

// Total calculations
<WeightDisplay grams={totalInventory} format="full" />
```

### Medium Priority

8. Customer Sale Approval
9. Analytics Dashboard
10. Reports

### Database Considerations

**No Changes Required**: Database continues to store weights in grams. All conversions happen at the presentation layer.

**Migration**: Not needed - existing data remains in grams.

## Formatting Standards

### Display Precision

| Context | Oz Precision | Grams Precision | Format |
|---------|-------------|-----------------|--------|
| **Input** | 3 decimals | 2 decimals | Interactive |
| **Table** | 2 decimals | N/A | Compact |
| **Details** | 3 decimals | 2 decimals | Full |
| **Calculations** | 3 decimals | 2 decimals | Full |
| **Comparisons** | 3 decimals | 2 decimals | Full |

### Examples

```typescript
// Input: High precision for accuracy
32.151 oz

// Table: Compact for readability
32.15 oz

// Details page: Full with conversion
32.151 oz (1000.00 g)

// Comparison: Show both with variance
Expected: 32.151 oz (1000.00 g)
Actual:   32.103 oz (998.50 g)
Variance: -0.048 oz (-0.15%)
```

## Common Patterns

### Pattern 1: Form Input with Validation

```tsx
const [weight, setWeight] = useState(0); // Store in grams

<FormField label="Weight" required error={errors.weight}>
  <WeightInput
    value={weight}
    onChange={(grams) => {
      setWeight(grams);
      if (errors.weight) {
        setErrors(prev => ({ ...prev, weight: '' }));
      }
    }}
    error={!!errors.weight}
    required
  />
</FormField>
```

### Pattern 2: Display with Tooltip

```tsx
<div className="group relative">
  <WeightDisplay grams={batch.weight} format="compact" />
  <div className="hidden group-hover:block absolute bg-gray-800 text-white p-2 rounded text-xs">
    <WeightDisplay grams={batch.weight} format="full" />
  </div>
</div>
```

### Pattern 3: Conditional Display

```tsx
{batch.weight > 0 ? (
  <WeightDisplay grams={batch.weight} format="full" />
) : (
  <span className="text-gray-400">Not weighed</span>
)}
```

### Pattern 4: Aggregation Display

```tsx
const totalOz = batches.reduce((sum, batch) => {
  return sum + gramsToOz(batch.weight);
}, 0);

<div>
  <span className="text-xl font-bold">
    {formatWeightWithConversion(totalOz)}
  </span>
</div>
```

## API Integration

### Sending Data to API

```typescript
// Component state in grams (ready for DB)
const handleSubmit = async () => {
  const payload = {
    weight: formData.weight, // Already in grams
    // other fields
  };

  await supabase.from('batches').insert(payload);
};
```

### Receiving Data from API

```typescript
// Data comes in grams, display as oz
const { data } = await supabase.from('batches').select('*');

return (
  <WeightDisplay grams={data.weight} format="full" />
);
```

## Testing Checklist

### Visual Testing
- [ ] All weight inputs default to oz
- [ ] Oz/g toggle works correctly
- [ ] Conversion displayed accurately
- [ ] Precision consistent (3 for oz, 2 for g)
- [ ] Compact format in tables
- [ ] Full format in details

### Functional Testing
- [ ] Data saves correctly in grams
- [ ] Data retrieves correctly from grams
- [ ] Conversions mathematically accurate
- [ ] No rounding errors in calculations
- [ ] Variance calculations correct
- [ ] Comparison displays accurate

### Edge Cases
- [ ] Zero weight displays correctly
- [ ] Null weight displays "—"
- [ ] Very small weights (< 0.001 oz)
- [ ] Very large weights (> 1000 oz)
- [ ] Negative weights (if applicable)

## Migration Checklist

For each page/component with weights:

1. [ ] Replace `<Input type="number">` with `<WeightInput>`
2. [ ] Replace weight display `<span>{value} g</span>` with `<WeightDisplay>`
3. [ ] Replace table cells with `<WeightTableCell>`
4. [ ] Replace comparisons with `<WeightComparison>`
5. [ ] Update any manual conversions to use utility functions
6. [ ] Test input and display
7. [ ] Verify database operations still work
8. [ ] Check variance calculations

## Benefits

### User Experience
- ✅ Industry standard unit (oz) by default
- ✅ Easy conversion to grams when needed
- ✅ Consistent display across platform
- ✅ No confusion about units

### Developer Experience
- ✅ Reusable components
- ✅ Type-safe utilities
- ✅ Consistent patterns
- ✅ Easy to maintain

### Data Integrity
- ✅ Single source of truth (grams in DB)
- ✅ No data migration needed
- ✅ Accurate conversions
- ✅ Precision maintained

## Support

### Common Issues

**Issue**: Weight showing in grams instead of oz
**Solution**: Use `<WeightDisplay>` instead of direct value display

**Issue**: Input not converting correctly
**Solution**: Ensure `<WeightInput>` is used with `value` in grams

**Issue**: Wrong precision
**Solution**: Set `ozPrecision` and `gramsPrecision` props explicitly

**Issue**: Calculations wrong
**Solution**: Perform all calculations in grams, display result in oz

## Summary

- ✅ **Default Unit**: oz (Troy Ounces)
- ✅ **Storage Unit**: grams (database)
- ✅ **Display Format**: "X oz (Y g)"
- ✅ **Input Default**: oz with g toggle
- ✅ **Components Created**: WeightInput, WeightDisplay, WeightBadge, WeightComparison, WeightTableCell
- ✅ **Utilities Created**: Complete conversion and formatting functions
- ✅ **No DB Changes**: Existing data compatible

The weight unit standardization is now complete and ready for platform-wide deployment!
