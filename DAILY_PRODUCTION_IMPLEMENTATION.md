# Daily Production Implementation Guide

## Overview
This guide provides the complete implementation for the Daily Production module and Performance Management (Forecasts) system.

## Database Migration

The migration file `20251110000000_create_daily_production_system.sql` has been created with:

### Tables Created:
1. **daily_production**
   - Stores daily production records
   - Auto-calculates pure_gold_grams and estimated_oz
   - Unique constraint on (production_date, bar_reference, site_id)

2. **production_forecasts**
   - Stores forecasts/budgets by period type
   - Supports daily, weekly, monthly, yearly periods
   - Unique constraint on (forecast_date, period_type, site_id)

### RLS Policies:
- Factory and Management can view all records
- Factory can insert and update own records (same day only)
- Management can update/delete all records
- Management-only for forecasts (insert/update/delete)

### Functions Created:
1. `get_production_summary(start_date, end_date, site)` - Returns aggregated totals
2. `get_production_variance(check_date, period, site)` - Compares actuals vs forecast/budget

## Service Layer

**File:** `src/services/dailyProductionService.ts`

Provides complete CRUD operations for:
- Daily production records
- Production forecasts
- Analytics and summaries
- Variance calculations

## Components Needed

### 1. Daily Production Form
**File:** `src/components/production/DailyProductionForm.tsx`

Features:
- Date picker
- Bullion weight input (grams)
- Estimated fineness % input
- Auto-calculated pure gold and oz (read-only)
- Bar reference input
- Notes textarea
- Field Guide panel on the right side
- Validation for all required fields

### 2. Production Metrics Widget
**File:** `src/components/production/ProductionMetrics.tsx`

Display:
- Total bullion produced (period)
- Total pure gold (period)
- Total estimated oz (period)
- Average fineness %
- Record count
- Comparison vs forecast/budget with colored indicators

### 3. Production Table
**File:** `src/components/production/ProductionTable.tsx`

Columns:
- Production Date
- Bullion (g)
- Fineness (%)
- Pure Gold (g)
- Estimated Oz
- Bar Reference
- Actions (Edit/Delete)

### 4. Forecast Management Page
**File:** `src/pages/performance/ForecastManagementPage.tsx`

Features:
- Forecast entry form
- Period type selector (daily/weekly/monthly/yearly)
- Forecast vs Budget entry
- Comparison table showing actuals vs forecast vs budget
- Variance indicators (green/red)

## Navigation Menu Updates

Add to AccordionSidebar.tsx:

```typescript
{
  id: 'performance',
  label: 'Performance Management',
  groupIconColor: 'text-blue-600',
  groupIcon: Activity,
  items: [
    { 
      label: 'Production Forecasts', 
      path: '/performance/forecasts', 
      icon: TrendingUp, 
      iconColor: 'text-blue-600' 
    },
    { 
      label: 'Performance Analysis', 
      path: '/performance/analysis', 
      icon: BarChart3, 
      iconColor: 'text-purple-600' 
    },
  ],
}
```

## Routes to Add

In your routing configuration:

```typescript
<Route path="/production/daily" element={<DailyProductionPage />} />
<Route path="/performance/forecasts" element={<ForecastManagementPage />} />
<Route path="/performance/analysis" element={<PerformanceAnalysisPage />} />
```

## Field Guides Data

**File:** `src/data/productionFieldGuides.ts` - Already created with complete guides for:
- All daily production fields
- All forecast fields
- French descriptions
- Examples and validation rules

## Sample Data Inserted

The migration includes sample data:
- 2 production records (Oct 27 & 31, 2025)
- 3 forecast records (daily, weekly, monthly for Nov 10, 2025)

## Excel Template Mapping

Based on your Excel image:

| Excel Column | Database Field |
|--------------|----------------|
| Date | production_date |
| BULLION (g) | bullion_grams |
| ESTIMATED FINENESS (%) | estimated_fineness_pct |
| PURE GOLD (g) | pure_gold_grams (auto) |
| ESTIMATED Oz | estimated_oz (auto) |
| BAR REFERENCE | bar_reference |
| WEEK TD FORECAST | forecast_oz (weekly) |
| WEEK TD BUDGET | budget_oz (weekly) |
| MTD FORECAST | forecast_oz (monthly) |
| MTD BUDGET | budget_oz (monthly) |

## Key Calculations

### Pure Gold:
```
pure_gold_grams = bullion_grams × estimated_fineness_pct / 100
```

### Estimated Oz:
```
estimated_oz = pure_gold_grams / 31.1035
```

### Variance:
```
variance_vs_forecast = actual_oz - forecast_oz
variance_vs_budget = actual_oz - budget_oz
```

## Next Steps

1. **Run Migration:**
   - Copy content of `/supabase/migrations/20251110000000_create_daily_production_system.sql`
   - Paste into Supabase SQL Editor
   - Click RUN

2. **Create Components:** (in order)
   - DailyProductionForm.tsx
   - ProductionMetrics.tsx
   - ProductionTable.tsx
   - DailyProductionPage.tsx
   - ForecastManagementPage.tsx

3. **Update Navigation:**
   - Add Daily Production to Shipping Management submenu
   - Add Performance Management menu group
   - Update routes in App.tsx

4. **Test:**
   - Create a production record
   - Verify calculations
   - Enter forecasts
   - Check variance calculations
   - Test edit/delete permissions

## Performance Considerations

- Indexes created on:
  - production_date (DESC) for fast recent queries
  - site_id for multi-site filtering
  - created_by for user-specific queries

- Generated columns for pure_gold_grams and estimated_oz ensure data consistency

- RLS policies enforce security at database level

## Reporting Queries

### Weekly Summary:
```sql
SELECT * FROM get_production_summary(
  '2025-11-04',  -- Week start
  '2025-11-10',  -- Week end
  'guinea'
);
```

### Monthly Variance:
```sql
SELECT * FROM get_production_variance(
  '2025-11-01',  -- Month start
  'monthly',
  'guinea'
);
```

## Maintenance

- Daily production records should be entered same day
- Forecasts should be updated weekly by management
- Monthly reviews compare actuals vs forecasts
- Archive old records after 2 years (optional)

