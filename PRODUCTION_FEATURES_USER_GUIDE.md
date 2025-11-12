# Production Management System - User Guide

## New Features Overview

This guide covers the new and enhanced features in the Production Management System.

---

## 1. Daily Production Page - Enhanced Layout

### What's New
The Daily Production page has been reorganized for better workflow efficiency.

### Key Changes
- **Production History Table** now appears ABOVE the Production Trend Chart
- **Mining Company Filter** available in "All Companies" tab
- **Mining Company Column** visible when viewing all companies

### How to Use

#### Viewing Production History
1. Navigate to **Daily Production** from the main menu
2. The production history table is now the first major section
3. Quickly scan recent production entries before analyzing trends

#### Filtering by Mining Company
**Option 1: Tab Selection**
- Click on specific company tabs to view only that company's data
- Each tab shows the count of production records

**Option 2: Dropdown Filter** (in "All Companies" tab)
- Stay on "All Companies" tab
- Use the dropdown filter above the table
- Select a specific company to filter the view
- Table and chart update automatically

#### Mining Company Column
- **Visible:** When viewing "All Companies" tab
- **Hidden:** When viewing specific company tabs
- Shows company name for each production entry

---

## 2. Production Trend Chart - Company Comparison

### What's New
The Production Trend Chart now supports side-by-side company comparison.

### Features
- **Multiple Bars:** Each company displayed with different color
- **Color-Coded Legend:** Easy identification of companies
- **Auto-Grouping:** Activated when viewing "All Companies"

### How to Use

#### View Single Company Trend
1. Click on a specific company tab
2. Chart shows only that company's production
3. Single blue bar for daily production

#### Compare Multiple Companies
1. Click "All Companies" tab
2. Chart automatically switches to grouped view
3. Each bar represents production by company
4. Hover over bars to see exact values
5. Use legend to identify companies by color

### Color Scheme
- Blue - First company
- Emerald - Second company
- Amber - Third company
- Violet - Fourth company
- Pink - Fifth company
- Teal - Sixth company
- Orange - Seventh company
- Indigo - Eighth company

---

## 3. Production In Safe Page - Executive Dashboard

### Access
- Navigate to **Production** → **Production In Safe** in the sidebar
- Icon: Lock (yellow)

### Overview
Comprehensive dashboard for tracking bullion bars in the safe with executive-level KPIs and variance tracking.

---

### Section A: Filters

#### Available Filters
1. **Société Minière (Mining Company)**
   - Select "Toutes les Sociétés" for all companies
   - Or select specific company

2. **Statut (Status)**
   - All Statuses
   - Préparé (Prepared)
   - Expédié (Shipped)
   - Raffiné (Refined)
   - Vendu (Sold)

3. **Date Range**
   - Date Début (Start Date)
   - Date Fin (End Date)
   - Default: Last 30 days

#### How to Apply Filters
1. Select desired filters from dropdowns
2. Data updates automatically
3. All sections reflect filtered data
4. Export includes filtered data only

---

### Section B: Bullion Bar in Safe Table

#### Table Columns
1. **DATE** - Production date
2. **BULLION (g)** - Total bullion weight in grams
3. **ESTIMATED FINESSE (%)** - Estimated purity (RED text)
4. **PURE GOLD (g)** - Calculated pure gold weight
5. **ESTIMATED Oz** - Estimated ounces (RED text)
6. **BAR REFERENCE** - Bar identification number
7. **SOCIÉTÉ MINIÈRE** - Mining company name
8. **STATUT** - Current status with color badge

#### Table Features
- **Yellow Header:** Distinctive yellow background
- **Zebra Striping:** Alternating yellow and white rows
- **Hover Effect:** Yellow highlight on mouse over
- **Total Row:** Yellow footer with aggregated totals
- **Scrollable:** Horizontal scroll on smaller screens

#### Understanding the Total Row
- Shows aggregate BULLION, PURE GOLD, and ESTIMATED Oz
- Excludes company-specific totals
- Updates based on active filters

---

### Section C: Week-to-Date (WTD) Performance

#### Blue-Themed Card - Left Side

**Displayed Metrics:**

1. **WEEK TD FORECAST**
   - Target production for current week
   - Based on forecasting model

2. **WEEK TD BUDGET**
   - Budgeted production for current week
   - From annual budget breakdown

3. **WEEK TD ACTUAL** (Highlighted)
   - Actual production so far this week
   - Blue background emphasis
   - Real-time calculation

4. **WEEK ACTUAL VS FORECAST**
   - Variance: Actual minus Forecast
   - Percentage: Change from forecast
   - **Green Background:** Positive variance (exceeding forecast)
   - **Red Background:** Negative variance (below forecast)
   - **TrendingUp Arrow:** Positive
   - **TrendingDown Arrow:** Negative

5. **WEEK ACTUAL VS BUDGET**
   - Variance: Actual minus Budget
   - Percentage: Change from budget
   - Color-coded like forecast comparison

#### How to Interpret
- **Positive Variance (Green):** Production exceeds target - GOOD
- **Negative Variance (Red):** Production below target - NEEDS ATTENTION
- **Percentage:** Shows relative performance impact

---

### Section D: Month-to-Date (MTD) Performance

#### Purple-Themed Card - Right Side

**Displayed Metrics:**

1. **MTD FORECAST**
   - Target production for month-to-date
   - Cumulative from start of month

2. **MTD BUDGET**
   - Budgeted production for month-to-date
   - Cumulative from start of month

3. **MONTH ACTUAL** (Highlighted)
   - Actual production from start of month
   - Purple background emphasis
   - Real-time calculation

4. **MTD ACTUAL vs MTD FORECAST**
   - Variance: Actual minus Forecast
   - Percentage: Change from forecast
   - **Green Background:** Positive variance
   - **Yellow Background:** Negative variance
   - Trend indicator included

5. **MTD ACTUAL vs MTD BUDGET**
   - Variance: Actual minus Budget
   - Percentage: Change from budget
   - Color-coded with trend indicator

#### Key Differences from WTD
- Uses yellow for negative variance (less urgent than weekly red)
- Shows cumulative monthly performance
- Typically larger numbers than weekly

---

### Section E: Monthly Targets

#### Two Gray Cards

1. **MONTH BUDGET**
   - Total budgeted production for full month
   - Fixed target from annual budget

2. **MONTH FORECAST**
   - Predicted production for full month
   - May adjust based on trends

#### Purpose
- Provides full-month context
- Helps estimate end-of-month position
- Reference for scaling actuals

---

### Section F: Variance Comparison Tiles

#### Large Format Comparison Cards

1. **MONTH FORECAST vs ACTUAL**
   - Shows how actual production tracks forecast
   - Large variance display with percentage
   - **Green Border:** On track or exceeding
   - **Yellow Border:** Below forecast
   - Large trend icon (up/down arrow)

2. **MONTH BUDGET vs MONTH ACTUAL**
   - Shows performance against budget
   - Large variance display with percentage
   - Color-coded border
   - Large trend icon

#### When to Pay Attention
- **Red or Yellow Cards:** Immediate review needed
- **Large Negative Percentages:** Significant underperformance
- **Consistent Patterns:** May indicate systemic issues

---

## 4. Export Functionality

### CSV Export

#### From Daily Production Page
**Button:** "Export CSV" (top right)

**Includes:**
- Date
- Mining Company
- Bullion (g)
- Fineness (%)
- Pure Gold (g)
- Estimated Oz
- Bar Reference
- Notes

**Filename Format:** `production_YYYY-MM-DD_to_YYYY-MM-DD.csv`

#### From Production In Safe Page
**Button:** "Export CSV" (top right)

**Includes:**
- All table columns
- Total row with aggregates
- Filtered data only

**Filename Format:** `production_in_safe_YYYY-MM-DD_to_YYYY-MM-DD.csv`

#### How to Export
1. Apply desired filters
2. Click "Export CSV" button
3. File downloads automatically
4. Open in Excel, Google Sheets, or text editor

---

## 5. Best Practices

### Daily Workflow
1. **Morning:** Check Production In Safe dashboard for overnight updates
2. **Review WTD:** Assess weekly performance vs targets
3. **Check MTD:** Monitor monthly trajectory
4. **Review Details:** Drill into specific production entries if needed
5. **Compare Companies:** Use "All Companies" view for performance comparison

### Weekly Review
1. Navigate to Production In Safe
2. Review full Week-to-Date section
3. Analyze variances (forecast vs actual, budget vs actual)
4. Identify underperforming areas
5. Export data for detailed analysis
6. Compare against previous weeks

### Monthly Close
1. Review Month-to-Date metrics
2. Check Month Forecast vs Actual
3. Verify Month Budget vs Actual
4. Export complete month data
5. Analyze trends by company
6. Use chart comparisons for visual insights

### Troubleshooting

#### Data Not Showing
- Check date range filters
- Verify company filter selection
- Ensure status filter includes expected statuses
- Confirm production data exists for selected period

#### Totals Don't Match
- Review filter settings
- Check for date range limitations
- Verify company selection
- Confirm all required statuses included

#### Chart Not Displaying
- Ensure "All Companies" tab selected for comparison
- Check browser console for errors
- Refresh page
- Try different date range

---

## 6. Quick Reference

### Navigation Paths
- Daily Production: **Production** → **Daily Production**
- Production In Safe: **Production** → **Production In Safe**

### Filter Shortcuts
- **All Companies Tab:** Shows Mining Company column and grouped chart
- **Specific Company Tab:** Hides Mining Company column, single-series chart
- **Date Range:** Last 30 days default, adjust as needed

### Color Codes
- **Green:** Positive performance, exceeding targets
- **Red/Yellow:** Below targets, needs attention
- **Blue:** WTD section emphasis
- **Purple:** MTD section emphasis
- **Yellow Background:** Table headers and totals

### Status Badges
- **Prepared:** Gold - Ready for shipping
- **Shipped:** Blue - In transit
- **Refined:** Purple - Completed refining
- **Sold:** Green - Transaction complete

---

## 7. Support & Feedback

### Need Help?
- Contact your system administrator
- Refer to main system documentation
- Check PRODUCTION_SYSTEM_ENHANCEMENTS.md for technical details

### Report Issues
- Unexpected data values
- Filter not working correctly
- Export failures
- Chart display problems

### Feature Requests
- Additional filter options
- New comparison metrics
- Custom report formats
- Dashboard customization

---

## Version Information
- **Implementation Date:** November 12, 2025
- **Features:** Daily Production Enhancement, Production In Safe Dashboard
- **Status:** Production Ready

---

**End of User Guide**
