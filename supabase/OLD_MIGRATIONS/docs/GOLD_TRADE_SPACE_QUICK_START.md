# Gold Trade Space - Quick Start Guide

## 🚀 3-Step Setup

### Step 1: Execute Database Migration (5 minutes)

1. **Open Supabase Dashboard** → SQL Editor

2. **Copy and paste this file:**
   ```
   supabase/migrations/20251028130000_gold_trade_space_comprehensive_schema.sql
   ```

3. **Click RUN** ✅

   This creates:
   - 7 new tables
   - Forward rates (7/14/30 days)
   - Rand Refinery pre-configured
   - AI recommendation system
   - Pricing comparison views

---

### Step 2: Verify Gold Price Data (2 minutes)

Run this SQL to check if you have recent gold prices:

```sql
SELECT * FROM gold_prices_daily
ORDER BY price_date DESC
LIMIT 5;
```

**If empty or outdated**, run the gold price update service or manually insert recent data.

---

### Step 3: Access the Trade Space (Immediate)

Navigate to:
```
http://your-app-url/sales/trade-space
```

Or add a navigation link in your menu:
```tsx
<Link to="/sales/trade-space">
  <Store className="w-5 h-5" />
  Gold Trade Space
</Link>
```

---

## 📋 What You'll See

### Main Interface Layout

```
┌─────────────────────────────────────┬──────────────────────┐
│                                     │  GOLD PRICE WIDGET   │
│  AI QUANTITY RECOMMENDATION         │  $2,047.50/oz        │
│  (Purple card with Lightbulb icon)  │  ▲ +0.75% Bullish    │
│                                     │  30-day stats        │
├─────────────────────────────────────┤                      │
│  PRICING CALCULATOR                 │  CUSTOMERS LIST      │
│  Enter Quantity: [____] oz          │  • Customer A (USA)  │
│  [Calculate Pricing Options]        │  • Customer B (UAE)  │
│                                     │                      │
├─────────────────────────────────────┤  TRADING INFO        │
│  MECHANISM COMPARISON               │  Available: 500 oz   │
│  ┌──────┬──────┬──────┬──────┐    │  Hours: 7:30-4:30    │
│  │ Spot │ Fwd7 │Fwd14 │Fwd30 │    │                      │
│  └──────┴──────┴──────┴──────┘    │                      │
│                                     │                      │
├─────────────────────────────────────┴──────────────────────┤
│  FINANCIAL COMPARISON CHARTS & TABLES                      │
│  • Bar Chart: Total Value Comparison                       │
│  • Line Chart: Benefit Analysis                            │
│  • Detailed Table with Recommendations                     │
└────────────────────────────────────────────────────────────┘
```

---

## 🎯 User Journey Example

### Scenario: Selling 100 oz of Gold

1. **System shows AI recommendation:**
   ```
   💡 Recommended: 70 oz (70% of stock)
   Risk: LOW | Confidence: 85%

   Reasoning: Strong bullish trend with price 3%+ above
   30-day average. Capture gains now, keep 30% for
   potential further upside.

   Optimal Timing: Immediate - within 24-48 hours
   ```

2. **Enter quantity:** `100` oz

3. **Click "Calculate Pricing Options"**

4. **View comparison:**
   ```
   Spot Basis:       $204,750  (Baseline)
   Forward 7d:       $205,057  (+$307 benefit) ✨
   Forward 14d:      $205,323  (+$573 benefit)
   Forward 30d:      $205,937  (+$1,187 benefit) 🏆
   In-Process:       $203,726  (-$1,024 penalty)

   💡 RECOMMENDED: Forward 30d
   Reason: Bearish market - lock in forward pricing to
   protect against potential price drops.
   ```

5. **Select mechanism** by clicking the card

6. **Choose customer** from dropdown

7. **Click "Create Gold Sale Order"** ✅

---

## 🔍 Understanding the Recommendations

### Bullish Market (Price Rising)
```
Recommendation: SPOT BASIS
Quantity: 60-70% of stock
Reasoning: Sell now to capture high prices
Risk: Low
```

### Bearish Market (Price Falling)
```
Recommendation: FORWARD 30D
Quantity: 30-45% of stock
Reasoning: Lock in pricing to protect against drops
Risk: Medium-High
```

### Neutral Market (Stable)
```
Recommendation: FORWARD 14D
Quantity: 50% of stock
Reasoning: Balanced approach with price stability
Risk: Low-Medium
```

---

## 💰 Pricing Mechanism Details

### 1. Spot Basis
- **Settlement:** 2 business days
- **Price:** Current London AM rate
- **Best for:** Capturing immediate high prices
- **Risk:** Market may go higher (missed opportunity)

### 2. Forward 7/14/30 Days
- **Settlement:** 7, 14, or 30 days
- **Price:** Spot + Premium (0.15% to 0.58%)
- **Best for:** Price protection, bearish markets
- **Risk:** Requires buyer consent, longer wait

### 3. In-Process Basis
- **Settlement:** During refining (7-10 days)
- **Price:** Spot - Small discount (~0.5%)
- **Best for:** Material already at refinery
- **Risk:** Lower price due to discount

---

## 📊 Financial Comparison Breakdown

### What Each Chart Shows

#### Bar Chart (Total Value)
Shows absolute USD value for each mechanism:
- Tallest bar = Best financial outcome
- Compare heights to see differences
- Hover for exact values

#### Line Chart (Benefits)
Shows gain/loss vs Spot pricing:
- **Green line:** Absolute dollar benefit
- **Orange line:** Percentage benefit
- Positive = Better than Spot
- Negative = Worse than Spot

#### Comparison Table
Detailed breakdown:
- Price per oz
- Total value
- Benefit ($ and %)
- Settlement days
- 🏆 Recommended badge

---

## ⚙️ Configuration (Optional)

### Update Forward Rates

```sql
UPDATE forward_rates
SET adjustment_rate_percentage = 0.20
WHERE forward_days = 7;
```

### Add New Refinery

```sql
INSERT INTO refineries_approved (
  refinery_name,
  refinery_location,
  address_line1,
  city,
  country,
  is_approved
) VALUES (
  'Your Refinery Name',
  'City, Country',
  'Address Line 1',
  'City',
  'Country',
  true
);
```

### Adjust Trading Hours

```sql
UPDATE trading_hours_config
SET opening_time = '08:00:00',
    closing_time = '17:00:00'
WHERE market_name = 'New York Commodity Exchange';
```

---

## 🐛 Troubleshooting

### Issue: No gold price showing

**Solution:**
```sql
-- Check if data exists
SELECT * FROM gold_prices_daily ORDER BY price_date DESC LIMIT 1;

-- If empty, run gold price update service
-- Or manually insert test data:
INSERT INTO gold_prices_daily (
  price_date, opening_price, closing_price,
  high_price, low_price, london_am, london_pm,
  source, currency
) VALUES (
  CURRENT_DATE, 2045.00, 2047.50,
  2050.00, 2043.00, 2047.00, 2048.00,
  'Manual', 'USD'
);
```

### Issue: No customers showing

**Solution:**
```sql
-- Check customers
SELECT * FROM customers LIMIT 5;

-- Add test customer if needed
INSERT INTO customers (name, email, country)
VALUES ('Test Customer', 'test@example.com', 'USA');
```

### Issue: No available stock

**Solution:**
```sql
-- Check inventory
SELECT SUM(quantity_available_oz) as total_stock
FROM gold_inventory;

-- Add test inventory if needed
-- (First ensure you have batches and refining records)
```

---

## 📈 Sample Test Data

### Test Forward Rates (Already Included)
- 7 days: +0.15%
- 14 days: +0.28%
- 30 days: +0.58%

### Test Refinery (Already Included)
- Rand Refinery Ltd.
- Germiston, South Africa

---

## ✅ Success Checklist

Before testing, verify:

- [ ] Database migration executed successfully
- [ ] Gold prices available for today
- [ ] At least 1 customer exists
- [ ] At least 1 batch with available inventory
- [ ] Can navigate to `/sales/trade-space`
- [ ] Gold price widget shows live data
- [ ] AI recommendation appears
- [ ] Can calculate pricing options

---

## 🎓 Training Tips

### For Sellers:
1. **Always check AI recommendation first** - It considers market conditions
2. **Compare all mechanisms** - Don't assume spot is always best
3. **Consider settlement timing** - Longer forward = higher premium
4. **Monitor trend indicator** - Bullish/Bearish affects strategy

### For Management:
1. **Review historical comparisons** - See which mechanisms are chosen
2. **Monitor forward rate effectiveness** - Adjust premiums as needed
3. **Track AI recommendation accuracy** - Confidence scores over time
4. **Analyze customer preferences** - Some may prefer specific mechanisms

---

## 📞 Need Help?

Refer to the complete documentation:
- `GOLD_TRADE_SPACE_IMPLEMENTATION.md` - Full technical details
- Contract specification - Original requirements
- Service layer code - Business logic details

---

**Ready to Trade Gold!** 🎉

Navigate to `/sales/trade-space` and start selling with intelligent pricing.
