# FX Rate Analysis - Setup Guide

## ⚠️ IMPORTANT: Fix the "relation does not exist" Error

You're seeing this error because the FX tables haven't been created yet.

## Quick Fix - Execute These 2 Migrations

Run these **TWO** SQL files in your Supabase SQL Editor **in this exact order**:

### **Step 1** - Create FX Tables:
```
supabase/migrations/20251027140000_create_fx_rates_comprehensive_system.sql
```
This creates: `fx_rate_sources`, `fx_rates_daily`, `fx_rates_monthly_aggregated`, `customer_fx_rates`

### **Step 2** - Add Sample Data:
```
supabase/migrations/20251027150000_add_fx_analysis_customer_transactions.sql
```
This adds: 3 months of FX rates and customer transactions (Aug-Oct 2024)

## How to Run the Migrations

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **"New query"**
4. Copy the entire contents of migration 1 and paste it
5. Click **"Run"**
6. Wait for success message: "3 months of FX rates added for ECB and Revolut"
7. Repeat steps 3-6 for migration 2
8. Wait for success message: "Customer FX transactions added for 3 months"

## Verify It Works

After running both migrations:

1. Navigate to `/prices/fx-rates`
2. Click on **"FX Rate Analysis"** tab
3. Data should load automatically
4. You should see 4 metric cards and transaction analysis

## What Gets Created

### Tables
- `fx_rate_sources` - Rate providers (ECB, Revolut)
- `fx_rates_daily` - Daily market rates
- `customer_fx_rates` - Customer payment transactions

### Sample Data
- **4 Customers**: Auramet, Emirates Gold, Swiss Gold, African PM
- **~10 Transactions**: Spanning August-October 2024
- **~180+ Market Rates**: Daily ECB and Revolut rates

### Sample Customers with Data
- **Auramet Trading LLC** - Has multiple transactions
- **Emirates Gold DMCC** - Has multiple transactions  
- **Swiss Gold Traders SA** - Has transactions
- **African Precious Metals** - Has transactions

## Expected Results

Once working, you'll see analysis showing:
- Customer rates vs ECB vs Revolut comparisons
- Opportunity costs (money saved or lost)
- Strategic recommendations
- Spread analysis and commentary

## Example Transaction

**Date**: October 6, 2024  
**Customer**: Auramet Trading LLC  
**USD Paid**: $1,647,428.90  
**Customer Rate**: 0.8517  
**ECB Spot**: 0.8562  
**EUR Received**: €1,403,103.00  
**Opportunity Cost**: +€7,413.50 (could have gotten better rate)

## If You Still Get Errors

1. Check Supabase logs for detailed error messages
2. Ensure migrations ran without errors
3. Verify tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%fx%';
```

4. Check data exists:
```sql
SELECT COUNT(*) FROM customer_fx_rates;
SELECT COUNT(*) FROM fx_rates_daily;
```

Should return > 0 for both.
