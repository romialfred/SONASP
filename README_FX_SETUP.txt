════════════════════════════════════════════════════════════════
                    FX ANALYSIS - QUICK START
════════════════════════════════════════════════════════════════

ERROR: "relation fx_customer_transactions does not exist"

This means FX tables haven't been created yet.

═══════════════════════════════════════════════════════════════
                    ⚡ 5-SECOND FIX
═══════════════════════════════════════════════════════════════

1. Open file: QUICK_FX_SETUP.sql
2. Copy ALL contents (Ctrl+A, Ctrl+C)  
3. Go to: Supabase Dashboard → SQL Editor
4. Paste & click "Run"
5. Wait for: "✅ FX ANALYSIS SETUP COMPLETE"
6. Refresh your browser

═══════════════════════════════════════════════════════════════
                    📁 FILES INCLUDED
═══════════════════════════════════════════════════════════════

⭐ QUICK_FX_SETUP.sql           - ONE FILE SETUP (use this!)
   SETUP_FX_ANALYSIS_NOW.txt   - Quick instructions
   FX_ANALYSIS_SETUP.md        - Detailed documentation
   verify-fx-setup.sql         - Check if setup worked

═══════════════════════════════════════════════════════════════
                    ✅ AFTER SETUP
═══════════════════════════════════════════════════════════════

→ Navigate to: /prices/fx-rates
→ Click tab: "FX Rate Analysis"  
→ Data loads automatically!

You'll see:
✓ 4 summary metric cards
✓ Transaction analysis tables
✓ Customer rate vs ECB vs Revolut comparison
✓ Opportunity cost calculations
✓ Strategic recommendations

═══════════════════════════════════════════════════════════════
                    ❓ TROUBLESHOOTING
═══════════════════════════════════════════════════════════════

Problem: Still see "relation does not exist"
→ Solution: Make sure QUICK_FX_SETUP.sql ran without errors
→ Check Supabase logs for error messages

Problem: No data showing in analysis
→ Solution: Run verify-fx-setup.sql to check data exists
→ Make sure you're logged in as authenticated user

Problem: SQL syntax error
→ Solution: Copy the ENTIRE file (don't copy partially)
→ Paste into a NEW query in SQL Editor

═══════════════════════════════════════════════════════════════
                    📊 WHAT GETS CREATED
═══════════════════════════════════════════════════════════════

Tables:
  • fx_rate_sources (4 sources: ECB, Revolut, Market, BCG)
  • fx_rates_daily (~180 rates for Aug-Oct 2024)
  • customer_fx_rates (3+ sample transactions)
  • fx_rates_monthly_aggregated (monthly stats)

Sample Customers:
  • Auramet Trading LLC
  • Emirates Gold DMCC
  • Swiss Gold Traders SA
  • African Precious Metals

Sample Data:
  • EUR/USD rates (ECB and Revolut)
  • Real transaction amounts ($1.6M - $2M USD)
  • Rate comparisons showing spreads
  • Opportunity cost analysis

═══════════════════════════════════════════════════════════════

That's it! Copy QUICK_FX_SETUP.sql → Paste → Run → Done! 🎉

═══════════════════════════════════════════════════════════════
