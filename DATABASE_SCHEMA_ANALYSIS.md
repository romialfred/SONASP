# Database Schema Analysis & Fix

## Executive Summary

Comprehensive analysis of the Gold Shipper database revealed multiple schema inconsistencies between table definitions and their usage in views and functions. This document details all findings and the comprehensive fix migration created.

---

## Issues Found

### 1. **SALES Table - Missing Columns**

**Problem:** The `sales` table was missing critical columns that were referenced in views and functions:

- `sale_date` - Referenced in `payments_with_details` view (line 46)
- `currency` - Expected but not defined
- `total_amount` - Referenced in multiple views
- `metal_type` - Referenced in commission calculation functions

**Impact:** Views would fail when trying to select these columns, causing "column does not exist" errors.

**Resolution:** Added all missing columns with appropriate defaults and constraints.

---

### 2. **PAYMENTS Table - Column Naming Inconsistency**

**Problem:** Inconsistent naming for payment proof URL field:
- Some migrations use `proof_url`
- Some views reference `payment_proof_url`

**Impact:** Views trying to access `payment_proof_url` would fail if only `proof_url` exists.

**Resolution:** Added `payment_proof_url` column and used `COALESCE` in views to handle both column names.

---

### 3. **PAYMENT_REMINDERS Table - Missing**

**Problem:** The `payment_reminders` table was referenced in:
- `payments_with_details` view (line 75)
- Payment module documentation
- But the table was never created in core migrations

**Impact:** Any view or query referencing this table would fail with "relation does not exist" error.

**Resolution:** Created complete `payment_reminders` table with:
- Full schema definition
- Appropriate indexes
- RLS policies
- Foreign key constraints

---

### 4. **PAYMENTS_WITH_DETAILS View - Column Mismatches**

**Problem:** View tried to access non-existent columns from customers table:
- Used `c.customer_name` but column is `c.name`
- Used `c.company_name` but column is `c.contact_person`
- Referenced `s.sale_date` which didn't exist

**Impact:** View creation would fail or return NULL values for customer information.

**Resolution:** Recreated view with correct column mappings:
```sql
c.name as customer_name,
c.contact_person as customer_contact,
COALESCE(s.sale_date, s.created_at::date) as sale_date
```

---

## Database Structure Analysis

### Core Tables (Verified)

#### **1. BATCHES System**
```
batches
├── id (uuid, PK)
├── batch_number (text, unique)
├── status (text)
├── origin_site_id (uuid, FK → sites)
├── current_site_id (uuid, FK → sites)
├── weight_grams (numeric)
├── weight_ounces (numeric)
├── shipping_date (date)
├── metal_type (text) ✓ ADDED
├── quality_grade (text)
├── expected_purity (numeric)
├── created_by (uuid, FK → auth.users)
└── created_at, updated_at (timestamptz)

Related Tables:
├── batch_status_history (audit trail)
├── receiving_records (airport/refinery receipts)
├── refining_records (processing data)
├── batch_documents (file attachments)
├── batch_quality_checks (QC records)
├── batch_splits (division tracking)
├── batch_merges (combination tracking)
└── batch_alerts (notifications)
```

#### **2. SALES System**
```
sales
├── id (uuid, PK)
├── sale_number (text, unique, auto-generated)
├── customer_id (uuid, FK → customers)
├── batch_id (uuid, FK → batches)
├── sale_date (date) ✓ ADDED
├── currency (text) ✓ ADDED
├── quantity_oz (numeric)
├── london_am_rate (numeric)
├── freight_cost (numeric)
├── other_costs (numeric)
├── gross_proceeds (numeric)
├── net_proceeds (numeric)
├── royalties (numeric)
├── final_proceeds (numeric)
├── total_amount (numeric) ✓ ADDED
├── metal_type (text) ✓ ADDED
├── status (text)
├── created_by (uuid)
├── approved_by (uuid)
├── customer_approved_at (timestamptz)
└── created_at, updated_at (timestamptz)

Related Tables:
├── sales_line_items (multi-batch sales)
├── sales_commissions (salesperson tracking)
├── sales_approvals (approval workflow)
├── sales_allocations (inventory reservation)
├── sales_payment_schedules (installments)
├── sales_documents (contracts, invoices)
├── sales_notifications_log (communications)
└── sales_audit_trail (change history)
```

#### **3. CUSTOMERS System**
```
customers
├── id (uuid, PK)
├── name (text) ← CORRECT column name
├── email (text, unique)
├── phone (text)
├── country (text)
├── address (text)
├── contact_person (text) ← NOT "company_name"
├── tax_id (text)
├── payment_terms (text)
├── credit_limit (numeric)
├── status (text)
└── created_at, updated_at (timestamptz)

Related Tables:
└── customer_contracts (pricing agreements)
```

#### **4. PAYMENTS System**
```
payments
├── id (uuid, PK)
├── sale_id (uuid, FK → sales)
├── customer_id (uuid, FK → customers)
├── expected_date (date)
├── actual_date (date)
├── due_date (date)
├── amount (numeric)
├── currency (text)
├── fx_rate (numeric)
├── bank_name (text)
├── account_number (text)
├── reference_number (text)
├── transaction_id (text)
├── payment_method (text)
├── proof_url (text)
├── payment_proof_url (text) ✓ ADDED (alias)
├── invoice_number (text)
├── notes (text)
├── status (text)
├── created_by (uuid)
├── approved_by (uuid)
├── verified_by (uuid)
└── created_at, approved_at, verified_at (timestamptz)

Related Tables:
├── payment_documents ✓ VERIFIED/CREATED
├── payment_history ✓ VERIFIED/CREATED
└── payment_reminders ✓ CREATED
```

#### **5. USERS & AUTH System**
```
user_profiles
├── id (uuid, PK, FK → auth.users)
├── email (text, unique)
├── full_name (text)
├── phone (text)
├── role (text) [factory, airport, refinery, customer, management]
├── is_active (boolean)
├── two_factor_enabled (boolean)
├── two_factor_secret (text, encrypted)
├── backup_codes (text[])
├── language (text) [en, fr]
├── email_notifications (boolean)
├── batch_notifications (boolean)
├── approval_notifications (boolean)
├── last_login_at (timestamptz)
├── last_login_ip (text)
├── failed_login_attempts (integer)
├── locked_until (timestamptz)
└── created_at, updated_at (timestamptz)

Related Tables:
├── user_site_assignments (multi-tenant access)
├── user_permissions (granular permissions)
├── user_sessions (active sessions)
└── security_events (audit log)
```

#### **6. SITES System**
```
sites
├── id (uuid, PK)
├── name (text)
├── site_type (text) [factory, airport, refinery]
├── country (text) [GN, CI, ML]
├── address (text)
├── contact_email (text)
├── contact_phone (text)
├── is_active (boolean)
└── created_at, updated_at (timestamptz)
```

---

## Views & Functions

### **Views Fixed**

#### 1. **payments_with_details**
Comprehensive payment information with related data.

**Fixed Issues:**
- Customer column name mappings
- Sale date handling (COALESCE with created_at)
- Total amount handling (COALESCE with final_proceeds)
- Payment proof URL (COALESCE both column names)

**Columns Provided:**
- Payment fields (id, amount, status, dates, etc.)
- Sale fields (sale_number, sale_date, totals, etc.)
- Customer fields (name, email, phone, country, contact)
- Document counts from payment_documents
- History counts from payment_history
- Reminder counts from payment_reminders
- User information (creator, approver, verifier)

#### 2. **payment_analytics**
Aggregated payment statistics by month.

**Fixed Issues:**
- Safe joins with LEFT JOIN
- Proper customer counting from sales table
- Null handling for date calculations

**Metrics Provided:**
- Total/approved/pending/rejected payment counts
- Amount totals and averages
- Unique customer counts
- Average payment delay days

---

## Key Functions

### **Auto-generation Functions**

1. **generate_sale_number()** - Format: `SL-YYYY-NNNNN`
2. **generate_invoice_number()** - Format: `INV-YYMM-NNNN`
3. **generate_batch_number()** - Auto-incremented unique identifier

### **Business Logic Functions**

1. **calculate_commission()** - Commission calculation based on rules
2. **check_inventory_available()** - Inventory availability check
3. **auto_allocate_inventory()** - FIFO inventory allocation
4. **user_has_permission()** - Permission checking
5. **get_user_sites()** - User site assignments

### **Logging Functions**

1. **log_security_event()** - Security event tracking
2. **log_payment_changes()** - Payment audit trail
3. **log_sales_changes()** - Sales audit trail

---

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

### **Access Patterns:**

1. **User Profiles**
   - Users can view/edit own profile
   - Management can view/edit all profiles

2. **Batches & Processing**
   - Users can view all batches
   - Users can create/edit own batches
   - Site-based filtering through user_site_assignments

3. **Sales & Customers**
   - Authenticated users can view all
   - Creation/modification based on role
   - Management has full access

4. **Payments**
   - Users can view payments for their sales
   - Management and customers have broader access
   - Document/history access tied to payment access

5. **System Tables**
   - Management-only access for most admin tables
   - Read-only access for active configuration tables

---

## Migration Execution Order

To fix your database, run these migrations **in this exact order**:

### **1. Schema Fix (REQUIRED - Run First)**
```
20251027100000_comprehensive_database_schema_fix.sql
```

This migration:
- ✓ Adds missing columns to sales table
- ✓ Adds missing columns to payments table
- ✓ Creates payment_reminders table
- ✓ Ensures payment_documents exists
- ✓ Ensures payment_history exists
- ✓ Recreates all views with correct columns
- ✓ Provides detailed logging output

### **2. Data Cleanup (Run Second)**
```
20251027080000_clean_all_data_fresh_start.sql
```

This migration:
- ✓ Checks table existence before deleting
- ✓ Removes all operational data
- ✓ Preserves user accounts and permissions
- ✓ Preserves system configuration
- ✓ Shows what was deleted and preserved

---

## Verification Checklist

After running the migrations, verify:

- [ ] All views can be queried without errors
- [ ] `SELECT * FROM payments_with_details LIMIT 1;` works
- [ ] `SELECT * FROM payment_analytics LIMIT 1;` works
- [ ] Sales table has columns: sale_date, currency, total_amount, metal_type
- [ ] Payments table has column: payment_proof_url
- [ ] payment_reminders table exists
- [ ] payment_documents table exists
- [ ] payment_history table exists
- [ ] RLS policies are enabled on all tables
- [ ] You can log in to the application
- [ ] No console errors related to missing columns

---

## Expected Output

When you run the comprehensive fix migration, you should see:

```
STEP 1: Fixing SALES table structure...
  ✓ Added sale_date column
  ✓ Added currency column
  ✓ Added total_amount column
  ✓ Added metal_type column

STEP 2: Fixing PAYMENTS table structure...
  ✓ Added payment_proof_url column

STEP 3: Ensuring PAYMENT_REMINDERS table exists...
  ✓ Created payment_reminders table with indexes and RLS

STEP 4: Ensuring PAYMENT_DOCUMENTS table exists...
  ✓ payment_documents table already exists

STEP 5: Ensuring PAYMENT_HISTORY table exists...
  ✓ payment_history table already exists

STEP 6: Recreating PAYMENTS_WITH_DETAILS view...
  ✓ Recreated payments_with_details view

STEP 7: Recreating PAYMENT_ANALYTICS view...
  ✓ Recreated payment_analytics view

========================================
DATABASE SCHEMA FIX COMPLETED!
========================================

Summary of changes:
-------------------
✓ Sales table: Added sale_date, currency, total_amount, metal_type columns
✓ Payments table: Added payment_proof_url column
✓ Payment_reminders table: Created with full structure
✓ Payment_documents table: Ensured exists with RLS
✓ Payment_history table: Ensured exists with RLS
✓ Payments_with_details view: Recreated with correct column names
✓ Payment_analytics view: Recreated safely

The database schema is now consistent and all views should work correctly!
========================================
```

---

## Next Steps

1. **Run the comprehensive fix migration first**
   - File: `20251027100000_comprehensive_database_schema_fix.sql`
   - This fixes all schema issues

2. **Then run the data cleanup migration**
   - File: `20251027080000_clean_all_data_fresh_start.sql`
   - This removes all dummy/seed data

3. **Verify everything works**
   - Test login
   - Check all pages load without errors
   - Verify you can create batches, customers, sales

4. **Start using your clean database**
   - Create your first real batch
   - Add your first real customer
   - Make your first real sale

---

## Technical Notes

### **Why Tables Were Missing**

The payment enhancement migrations (20251026000000 and later) created references to tables like `payment_reminders` but the table creation was in a conditional block that may not have executed if certain conditions weren't met.

### **Why Column Names Were Wrong**

Multiple migrations over time added columns with slightly different names, and views were created referencing the wrong variants. This happens in iterative development when schema evolves.

### **Why Views Failed**

Views compile at creation time. If they reference columns that don't exist, they fail. Our fix ensures all referenced columns exist before recreating views.

### **Database Safety**

All migrations use:
- `IF NOT EXISTS` checks before creating objects
- `IF EXISTS` checks in information_schema before altering
- Transaction-safe operations (though explicit transactions aren't needed)
- Detailed logging of all changes

---

## Conclusion

The database schema is now **fully documented and fixed**. All tables, columns, views, and functions are properly aligned. The comprehensive migration will:

1. Add all missing columns
2. Create all missing tables
3. Fix all view definitions
4. Ensure proper RLS policies
5. Provide detailed logging

After running the two migrations in order, your database will be clean, consistent, and ready for production use.
