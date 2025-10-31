# Gold Price Live Widget - Visual Description

## Component Location
`src/components/dashboard/GoldPriceLive.tsx`

## Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│  Gold Price (London AM)              [Refresh Button]   │
│                                                          │
│  $2,635.50  /oz                           [↗]          │
│                                                          │
│  [↗ +$15.25]  [+0.58%]                                  │
│                                                          │
│  Last updated: Oct 27, 2025                             │
│  ─────────────────────────────────────────────────────  │
│  Previous: $2,620.25                                    │
└─────────────────────────────────────────────────────────┘
```

## Component Features

### 1. Header Section
- **Label**: "Gold Price (London AM)" in medium gray
- **Refresh Button**: Small circular icon button with spinner animation
  - Normal state: Static refresh icon
  - Loading state: Spinning animation
  - Hover state: Light gray background

### 2. Current Price Display
- **Font Size**: text-3xl (30px)
- **Weight**: Bold (font-bold)
- **Format**: $X,XXX.XX with 2 decimal places
- **Suffix**: "/oz" in small gray text

### 3. Variance Badges (Side by Side)
Two rounded pill-shaped badges:

**Dollar Amount Badge**:
- Trend icon (↗/↘/—)
- Dollar amount with +/- sign
- Background: Green-100 (up) / Red-100 (down) / Gray-100 (neutral)
- Text: Green-600 / Red-600 / Gray-600

**Percentage Badge**:
- Percentage with +/- sign and % symbol
- Same color scheme as dollar badge
- Format: +0.00% or -0.00%

### 4. Trend Icon (Right Side)
- **Size**: 56x56px (w-14 h-14)
- **Icon Size**: 20x20px (w-5 h-5)
- **Background**: Matches trend color (light shade)
- **Icons**:
  - TrendingUp: Green arrow pointing up-right
  - TrendingDown: Red arrow pointing down-right
  - Minus: Gray horizontal line

### 5. Last Update Info
- **Format**: "Last updated: Mon DD, YYYY"
- **Style**: Extra small gray text (text-xs text-gray-500)
- **Position**: Below variance badges

### 6. Previous Price Reference
- **Separator**: Light gray border line (border-t)
- **Layout**: Two columns
  - Left: "Previous:" label in gray
  - Right: Price value in medium gray
- **Format**: $X,XXX.XX

## Color Coding

### Price Increase (Positive Variance)
- **Badge Background**: bg-green-100 (light green)
- **Text Color**: text-green-600 (darker green)
- **Icon Background**: bg-green-50 (very light green)
- **Icon**: TrendingUp (↗)

### Price Decrease (Negative Variance)
- **Badge Background**: bg-red-100 (light red)
- **Text Color**: text-red-600 (darker red)
- **Icon Background**: bg-red-50 (very light red)
- **Icon**: TrendingDown (↘)

### No Change (Zero Variance)
- **Badge Background**: bg-gray-100 (light gray)
- **Text Color**: text-gray-600 (medium gray)
- **Icon Background**: bg-gray-50 (very light gray)
- **Icon**: Minus (—)

## States

### Loading State
Shows skeleton loader:
- Animated pulse effect
- Gray rectangles for:
  - Title (w-24)
  - Price (w-32)
  - Info text (w-20)

### No Data State
Shows fallback UI:
- Title: "Gold Price"
- Value: "N/A"
- Info: "No data available"

### With Single Data Point
- Shows current price normally
- Variance shows 0% (no comparison available)
- Previous price equals current price

### Normal State (With 2+ Data Points)
- Full functionality
- All elements visible
- Variance calculated from last 2 entries

## Responsive Design
- Flexible width (adapts to grid column)
- Icon stays on right side
- Badges stack horizontally with gap
- Text wraps appropriately on small screens

## Auto-Refresh
- Fetches new data every 5 minutes
- Silent refresh (no UI interruption)
- Can be triggered manually via refresh button

## Database Query
```sql
SELECT date, london_am_usd
FROM gold_prices
ORDER BY date DESC
LIMIT 2
```

## Integration
Replace the old gold price card in DashboardPage.tsx:
```tsx
// Before
<Card>
  <div className="p-6">
    <p className="text-sm text-gray-600">Gold Price</p>
    <p className="text-2xl font-bold">$X,XXX</p>
    // ...
  </div>
</Card>

// After
<GoldPriceLive />
```

## Example Scenarios

### Scenario 1: Price Increased
```
Current: $2,650.75
Previous: $2,635.50
Change: +$15.25 (+0.58%)
Icon: Green TrendingUp ↗
```

### Scenario 2: Price Decreased
```
Current: $2,610.00
Previous: $2,635.50
Change: -$25.50 (-0.97%)
Icon: Red TrendingDown ↘
```

### Scenario 3: No Change
```
Current: $2,635.50
Previous: $2,635.50
Change: $0.00 (0.00%)
Icon: Gray Minus —
```

## Accessibility
- Refresh button has title attribute for tooltip
- Disabled state prevents double-clicks
- Color contrast meets WCAG standards
- Screen reader friendly text
