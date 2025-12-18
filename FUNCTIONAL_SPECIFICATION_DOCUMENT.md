# FUNCTIONAL SPECIFICATION DOCUMENT
## Gold Shipper - Precious Metals Supply Chain Management Platform

**Version:** 2.0
**Date:** December 2025
**Prepared for:** Enterprise Sales & Business Development
**Document Type:** Comprehensive Functional Specification

---

## EXECUTIVE SUMMARY

### Platform Overview

**Gold Shipper** is an enterprise-grade, end-to-end supply chain management platform specifically designed for precious metals operations in West Africa. The platform digitizes and automates the complete lifecycle of gold and silver from mine extraction through international shipment, refining, customs clearance, sales, and final payment collection.

### Business Challenge Addressed

West African mining operations face critical challenges in managing precious metals:
- **Lack of real-time visibility** across the supply chain from production to payment
- **Manual tracking errors** leading to inventory discrepancies and financial losses
- **Regulatory compliance complexity** with export licenses, customs, and government reporting
- **Fragmented systems** creating data silos and inefficiencies
- **Multi-stakeholder coordination** across factories, airports, refineries, and customers
- **Currency and pricing complexity** with multiple currencies, daily price fluctuations, and forward pricing mechanisms
- **Audit and traceability gaps** exposing companies to compliance risks

### Solution Value Proposition

Gold Shipper delivers measurable business value through:

| **Value Driver** | **Impact** |
|------------------|------------|
| **Operational Efficiency** | 70% reduction in manual data entry and paperwork processing |
| **Inventory Accuracy** | 99.9% inventory accuracy with real-time tracking and automated reconciliation |
| **Compliance Assurance** | 100% audit trail with automated regulatory reporting and license quota management |
| **Revenue Optimization** | 5-8% revenue improvement through optimized pricing mechanisms and reduced losses |
| **Cost Reduction** | 40% reduction in administrative overhead and shipping documentation costs |
| **Decision Speed** | Real-time dashboards enable 10x faster decision-making for management |
| **Risk Mitigation** | Automated alerts and variance detection reduce financial exposure |

### Target Market

- **Primary**: West African gold and silver mining operations (Guinea, Mali, Côte d'Ivoire)
- **Secondary**: International precious metals trading companies
- **Company Size**: Mid-to-large scale operations (annual production > 10,000 oz)
- **Users**: 50-500 concurrent users across multiple sites and roles

### Key Differentiators

1. **Industry-Specific Design**: Built specifically for West African precious metals operations with deep understanding of regional compliance requirements
2. **Complete End-to-End Coverage**: Only platform covering production → customs → freight → refining → sales → payment
3. **Multi-Entity Support**: Handles complex multi-mining company, multi-site operations with proper data segregation
4. **Advanced Pricing Engine**: Multiple pricing mechanisms (Spot, Forward 14D, Forward 30D) with real-time LBMA integration
5. **Regulatory Compliance Built-In**: Export license quota management, customs documentation, audit trails
6. **Multi-Currency & Multi-Language**: Full support for CFA Franc, USD, EUR with French/English interfaces
7. **Real-Time Collaboration**: Instant status updates, notifications, and document sharing across stakeholders

---

## PLATFORM ARCHITECTURE

### Technology Stack

#### Frontend Layer
- **Framework**: React 18 with TypeScript for type-safe development
- **Build Tool**: Vite for lightning-fast development and optimized production builds
- **UI Framework**: Tailwind CSS with custom design system matching precious metals industry aesthetics
- **State Management**: React Context API for global state (Auth, Dialogs, Notifications)
- **Routing**: React Router DOM v7 with protected routes and role-based navigation
- **Charts & Visualization**: Recharts library for interactive analytics dashboards
- **Internationalization**: i18next with full French/English translation support
- **PDF Generation**: jsPDF with AutoTable for professional document generation
- **Document Parsing**: PDF.js for certificate and document processing

#### Backend Layer
- **Database**: PostgreSQL (Supabase) with 47+ tables optimized for precious metals workflows
- **Authentication**: Supabase Auth with email/password and Microsoft Entra SSO integration
- **Real-Time Engine**: Supabase Realtime for live updates across users
- **File Storage**: Supabase Storage with secure buckets for documents
- **Edge Functions**: Serverless functions for LBMA price integration, FX rates, and email notifications
- **API Layer**: RESTful and GraphQL APIs with row-level security

#### Security & Infrastructure
- **Row-Level Security (RLS)**: Database-level security ensuring data isolation
- **Two-Factor Authentication**: TOTP-based 2FA for enhanced security
- **Audit Logging**: Complete audit trail on all data modifications
- **Encrypted Storage**: Data encrypted at rest and in transit
- **Backup & Recovery**: Automated daily backups with point-in-time recovery
- **Scalability**: Cloud-native architecture supporting thousands of concurrent users

### Database Architecture

The platform utilizes **47+ specialized tables** organized into 10 functional modules:

1. **Production Module** (6 tables): Daily production tracking, documents, budgets
2. **Shipping Module** (8 tables): Shipment preparation, items, signatories, documents
3. **Freight & Customs Module** (6 tables): Customs operations, freight shipments, commercial invoices
4. **Export Licensing Module** (3 tables): License management, quota tracking, documents
5. **Inventory Module** (4 tables): Gold/silver inventory, transactions, balances
6. **Sales Module** (5 tables): Sales, pre-sales, customer settings, pricing
7. **Payment Module** (4 tables): Payments, virtual settlements, bank accounts
8. **Stakeholder Module** (8 tables): Mining companies, refineries, customers, depositors
9. **Market Data Module** (4 tables): LBMA prices, FX rates, forward rates
10. **System Module** (9 tables): Users, permissions, audit logs, status history

**Key Technical Features**:
- Comprehensive foreign key relationships ensuring referential integrity
- Automated triggers for calculations (totals, balances, quotas)
- Generated columns for performance optimization
- Composite unique constraints preventing data duplication
- Indexed columns for sub-second query performance
- Materialized views for complex reporting queries

---

## DETAILED FUNCTIONAL MODULES

### MODULE 1: DAILY PRODUCTION MANAGEMENT

#### Business Objective
Enable mining sites to accurately record, track, and analyze daily gold and silver production with real-time budget compliance monitoring and complete traceability from extraction to export.

#### Key Features

**1.1 Production Registration**
- **Bar Reference System**: Unique, auto-generated bar reference numbers for each production batch
- **Multi-Metal Tracking**: Simultaneous recording of gold and silver content with fineness percentages
- **Weight Management**:
  - Gross weight in grams (automatic conversion to troy ounces)
  - Pure gold calculation: `gross_weight × fineness`
  - Pure silver calculation: `gross_weight × silver_content`
- **Site Assignment**: Link production to specific mining company and site location
- **Date Tracking**: Production date with timestamp for complete audit trail
- **Notes & Comments**: Free-text field for operational notes (e.g., ore quality, processing anomalies)

**1.2 Production Status Workflow**
```
prepared → ready_for_customs → shipped → cancelled
```
- **Prepared**: Initial status after production entry (available for shipping)
- **Ready for Customs**: Production cleared for export license allocation
- **Shipped**: Production included in export shipment
- **Cancelled**: Production cancelled (with reason requirement)

Each status transition is logged with:
- User who made the change
- Timestamp
- Previous and new status
- Change reason/notes

**1.3 Budget Management System**

**Annual Budget Configuration**
- Set annual production targets by mining company and site
- Measured in troy ounces (oz) of pure gold
- Multi-year planning capability
- Budget approval workflow

**Monthly Budget Allocation**
- Break down annual budget into monthly targets
- Automatic daily budget calculation: `monthly_budget / days_in_month`
- Seasonal adjustment factors
- Historical pattern analysis

**Quarterly Forecast Adjustments**
- Mid-year forecast revisions (Q2, Q3, Q4)
- Variance analysis and trend projection
- Market condition adjustments
- Stakeholder approval process

**Budget vs. Actual Tracking**
- Real-time comparison of actual vs. budgeted production
- Variance percentage calculation
- Color-coded alerts:
  - 🟢 Green: Within 10% of budget
  - 🟡 Yellow: 10-20% variance
  - 🔴 Red: >20% variance
- Cumulative year-to-date analysis
- Forecast to completion projections

**1.4 Document Management**
- **Assay Certificates**: Upload and link laboratory analysis certificates
- **Production Reports**: Daily production summary documents
- **Quality Control**: Photos, inspection reports, processing notes
- **Secure Storage**: Documents stored in Supabase Storage with RLS protection
- **PDF Preview**: In-app document preview without download
- **Version Control**: Document history and revision tracking
- **Search & Filter**: Full-text search across document metadata

**1.5 Production Analytics Dashboard**

**Key Metrics**
- Total production today/this week/this month/YTD
- Budget achievement percentage
- Production trend charts (daily, weekly, monthly)
- Average fineness by period
- Silver content analysis
- Production velocity (oz per day)

**Visualizations**
- Production timeline chart (line graph)
- Budget vs. actual comparison (bar chart)
- Production by mining company (pie chart)
- Fineness distribution (histogram)
- Monthly production heatmap

**Export Capabilities**
- Excel export with detailed production records
- PDF production summary reports
- CSV data exports for external analysis
- Automated email reports (scheduled)

#### User Roles & Permissions

| Role | View | Create | Edit | Delete | Approve |
|------|------|--------|------|--------|---------|
| **Factory** | Own site | ✓ | Own records | Own records | ✗ |
| **Management** | All sites | ✓ | All records | All records | ✓ |
| **Airport** | All sites | ✗ | ✗ | ✗ | ✗ |
| **Refinery** | Related | ✗ | ✗ | ✗ | ✗ |

#### Business Rules

1. **Uniqueness**: Bar reference numbers must be unique across all mining companies
2. **Required Fields**: Production date, mining company, gross weight, and fineness are mandatory
3. **Data Validation**:
   - Fineness must be between 50% and 99.99%
   - Gross weight must be > 0
   - Production date cannot be in the future
4. **Status Transitions**: Cannot skip workflow steps (e.g., cannot go from "prepared" to "shipped" without "ready_for_customs")
5. **Budget Alerts**: System sends notifications when production exceeds budget by >10%
6. **Deletion Rules**: Cannot delete production records after they've been included in a shipment
7. **Multi-Site Isolation**: Users only see production from their assigned mining companies (unless Management role)

#### Integration Points

**Upstream**:
- Receives production data from factory systems (manual entry or API integration)
- Integrates with laboratory systems for assay certificate import

**Downstream**:
- Feeds into Shipping Preparation (available batches for export)
- Updates Budget Dashboard (real-time budget compliance)
- Triggers Export License quota checking
- Feeds Analytics module for reporting

#### Technical Implementation

**Database Tables**:
- `daily_production`: Main production records
- `production_documents`: Linked documents and certificates
- `production_status_history`: Status change audit trail
- `annual_budgets`: Annual production targets
- `monthly_budgets`: Monthly budget allocations
- `quarterly_forecasts`: Forecast adjustments

**Key Database Functions**:
```sql
-- Calculate pure gold content
CREATE FUNCTION calculate_pure_gold()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pure_gold_grams = NEW.gross_weight_grams * (NEW.fineness / 100);
  NEW.pure_gold_oz = NEW.pure_gold_grams / 31.1035;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Budget compliance check
CREATE FUNCTION check_budget_compliance()
RETURNS TABLE(variance_percentage NUMERIC) AS $$
  SELECT ((actual - budget) / budget * 100) as variance_percentage
  FROM production_vs_budget_view;
$$ LANGUAGE sql;
```

**API Endpoints**:
- `POST /api/production` - Create new production record
- `GET /api/production` - List productions (filtered, paginated)
- `GET /api/production/:id` - Get production details
- `PUT /api/production/:id` - Update production record
- `DELETE /api/production/:id` - Delete production (soft delete)
- `POST /api/production/:id/status` - Change production status
- `POST /api/production/:id/documents` - Upload documents
- `GET /api/production/budget-summary` - Budget vs. actual summary

#### Reporting Outputs

1. **Daily Production Summary**
   - Date, site, bar references
   - Total weights (gross, pure gold, silver)
   - Average fineness
   - Budget compliance status

2. **Monthly Production Report**
   - Production by mining company
   - Budget achievement percentage
   - Trend analysis vs. previous months
   - Forecast to completion

3. **Annual Production Analysis**
   - Year-over-year comparison
   - Seasonal patterns
   - Fineness trends
   - Site performance rankings

---

### MODULE 2: SHIPPING PREPARATION & EXPORT DOCUMENTATION

#### Business Objective
Streamline the preparation of gold shipments for international export with complete documentation, traceability, and compliance with government export requirements.

#### Key Features

**2.1 Expedition Lot Number System**
- **Auto-Generated Format**: `[MC]/YYYY-NNN`
  - `[MC]` = Mining Company abbreviation (e.g., "KGM", "YAN", "SMK")
  - `YYYY` = Current year
  - `NNN` = Sequential counter (resets annually per company)
- **Example**: `KGM/2025-045` (45th shipment from Kobada Gold Mine in 2025)
- **Unique Constraint**: Cannot duplicate expedition lot numbers
- **Counter Management**: Automatic increment with concurrency protection
- **Manual Override**: Management can manually set counter for special cases

**2.2 Production Batch Selection**
- **Batch Browser**: View all production records with status "prepared" or "ready_for_customs"
- **Multi-Select Interface**: Checkbox selection of multiple production batches
- **Filters**:
  - Mining company
  - Date range
  - Bar reference search
  - Fineness range
  - Minimum weight
- **Preview Calculations**: Real-time totals as batches are selected:
  - Total net weight (grams and oz)
  - Total pure gold (grams and oz)
  - Total silver content
  - Average fineness
  - Number of items
- **Validation**: Prevents selecting batches from different mining companies in same shipment

**2.3 Shipment Details Configuration**

**Destination Information**
- **Company Name**: Refinery or intermediate destination
- **Complete Address**: Street, city, country
- **Contact Person**: Name, phone, email
- **Delivery Instructions**: Special handling notes

**Packaging Details**
- **Number of Boxes**: Total boxes in shipment
- **Gross Weight**: Total weight including packaging (kg)
- **Net Weight**: Weight of gold only (auto-calculated from selected batches)
- **Box Descriptions**: Detailed description of each box
- **Packaging Type**: Wooden crate, sealed metal box, etc.

**Security Measures**
- **Seal Number 1**: Primary security seal (required)
- **Seal Number 2**: Secondary security seal (required)
- **Seal Photos**: Upload photos of applied seals
- **Seal Validation**: Check against seal number registry

**Transport Details**
- **Transport Company**: Selection from registered freight companies
- **Vehicle Details**: Truck/aircraft identification
- **Driver/Pilot**: Name and credentials
- **Estimated Departure**: Date and time
- **Estimated Arrival**: Date and time

**2.4 Signatory Management**

**Multi-Signatory Support**
- Add multiple signatories per shipment (typically 2-4)
- Each signatory has:
  - **Full Name**: As per identity document
  - **Position/Title**: Company role (e.g., "Mine Manager", "Security Officer")
  - **Company**: Organization represented
  - **ID Document**: Passport/national ID number
  - **Signature**: Digital signature or scanned signature image

**Signatory Roles**
- **Preparer**: Person who prepared the shipment
- **Approver**: Manager who approved release
- **Security Officer**: Person responsible for sealing
- **Witness**: Independent witness to shipment preparation

**2.5 Packing List PDF Generation**

**Professional Document Layout**
- Company logo and letterhead
- Shipment reference number (expedition lot number)
- Date and place of preparation
- Destination details
- Comprehensive item listing table:
  - Item number
  - Bar reference
  - Gross weight (g)
  - Fineness (%)
  - Pure gold (oz)
  - Silver content (g)
- Summary totals:
  - Total items
  - Total net weight
  - Total pure gold
  - Total boxes
- Seal numbers clearly displayed
- Signatory blocks with signature lines
- Company stamps/seals placeholder

**Multi-Language Support**
- Generate in English or French
- Dual-language option for international shipments

**QR Code Integration**
- Embedded QR code linking to shipment tracking
- Scan to verify authenticity

**2.6 Shipment Status Workflow**
```
pending → prepared → shipped → received → cancelled
```

**Status Definitions**:
- **Pending**: Shipment being prepared, batches being selected
- **Prepared**: Shipment complete, packing list generated, ready for dispatch
- **Shipped**: Shipment dispatched, in transit
- **Received**: Shipment received at destination (updated by receiving party)
- **Cancelled**: Shipment cancelled (with reason)

**Status Change Notifications**:
- Email notifications to relevant stakeholders
- SMS alerts for critical status changes
- In-app notifications with push support
- Status history with complete audit trail

**2.7 Export License Linkage**

**License Selection**
- View available export licenses for the mining company
- Filter by:
  - Active status
  - Remaining quota (oz)
  - Expiration date
- License details display:
  - License number
  - Issuing authority
  - Valid from/to dates
  - Total authorized quantity
  - Used quantity
  - Remaining quantity

**Automatic Quota Deduction**
- When shipment is marked "shipped", system automatically:
  - Deducts pure gold oz from license quota
  - Updates license remaining quantity
  - Checks if license is exhausted
  - Changes license status to "exhausted" if quota fully used
  - Sends alert if license nearing depletion (<10% remaining)

**License Validation Rules**
- Cannot use expired license
- Cannot exceed remaining quota
- One shipment can only use one license
- Warning if license expires within 30 days

**2.8 Document Attachment**

**Supported Document Types**
- Assay certificates (one per production batch)
- Transport authorization
- Insurance certificate
- Customs pre-clearance
- Export permit copy
- Security clearance
- Company authorization letter

**Document Management Features**
- Drag-and-drop upload
- PDF preview in browser
- Document categorization by type
- Multiple documents per shipment
- Version control for updated documents
- Automatic document bundling for export

#### User Roles & Permissions

| Role | View | Create | Edit | Delete | Approve | Generate PDF |
|------|------|--------|------|--------|---------|--------------|
| **Factory** | Own company | ✓ | Own drafts | Own drafts | ✗ | ✓ |
| **Airport** | All | ✓ | All | Draft only | ✓ | ✓ |
| **Management** | All | ✓ | All | All | ✓ | ✓ |
| **Refinery** | Related | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Customer** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

#### Business Rules

1. **Mining Company Consistency**: All production batches in a shipment must be from the same mining company
2. **Status Progression**: Cannot skip workflow steps
3. **Seal Requirements**: Both seal numbers required before marking "prepared"
4. **License Requirements**: Export license must be linked before shipping
5. **Weight Validation**: Gross weight must equal or exceed net weight
6. **Signatory Minimum**: At least 2 signatories required
7. **Document Requirements**: Packing list must be generated before shipping
8. **Batch Uniqueness**: One production batch can only be in one active shipment
9. **Edit Restrictions**: Cannot edit shipment after status "shipped"
10. **Deletion Rules**: Can only delete shipments in "pending" status

#### Integration Points

**Upstream**:
- Imports available production batches from Production Module
- Reads export license data from Export License Module
- Reads mining company and refinery data from Stakeholder Module

**Downstream**:
- Feeds into Freight & Customs Module (customs clearance)
- Updates production batch status to "shipped"
- Deducts quantities from export license quotas
- Feeds into Analytics Module for shipment metrics
- Creates records in Freight Shipments Module

**External**:
- Email notifications to freight companies
- SMS notifications to transport drivers
- Integration with transport company tracking systems (optional)

#### Technical Implementation

**Database Tables**:
- `shipping_preparations`: Main shipment records
- `shipping_production_items`: Many-to-many link between shipments and production batches
- `shipping_signatories`: Signatory information
- `shipping_documents`: Attached documents
- `shipping_status_history`: Status change audit trail
- `shipping_ingots`: Detailed ingot/bar information
- `expedition_lot_counters`: Auto-increment counters per mining company

**Key Database Functions**:
```sql
-- Generate expedition lot number
CREATE FUNCTION generate_expedition_lot_number(company_id UUID)
RETURNS TEXT AS $$
DECLARE
  company_abbr TEXT;
  current_year INT;
  next_counter INT;
BEGIN
  SELECT abbreviation INTO company_abbr FROM mining_companies WHERE id = company_id;
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Get and increment counter
  INSERT INTO expedition_lot_counters (mining_company_id, year, counter)
  VALUES (company_id, current_year, 1)
  ON CONFLICT (mining_company_id, year)
  DO UPDATE SET counter = expedition_lot_counters.counter + 1
  RETURNING counter INTO next_counter;

  RETURN company_abbr || '/' || current_year || '-' || LPAD(next_counter::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Calculate shipment totals
CREATE FUNCTION calculate_shipping_totals()
RETURNS TRIGGER AS $$
BEGIN
  SELECT
    SUM(dp.gross_weight_grams),
    SUM(dp.pure_gold_oz),
    SUM(dp.silver_content_grams),
    COUNT(*),
    AVG(dp.fineness)
  INTO
    NEW.total_net_weight_grams,
    NEW.total_pure_gold_oz,
    NEW.total_silver_content_grams,
    NEW.number_of_items,
    NEW.average_fineness
  FROM shipping_production_items spi
  JOIN daily_production dp ON dp.id = spi.production_id
  WHERE spi.shipping_id = NEW.id;

  NEW.total_net_weight_oz = NEW.total_net_weight_grams / 31.1035;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**API Endpoints**:
- `POST /api/shipping` - Create new shipment
- `GET /api/shipping` - List shipments (filtered, paginated)
- `GET /api/shipping/:id` - Get shipment details
- `PUT /api/shipping/:id` - Update shipment
- `DELETE /api/shipping/:id` - Delete shipment
- `POST /api/shipping/:id/status` - Change status
- `POST /api/shipping/:id/batches` - Add production batches
- `DELETE /api/shipping/:id/batches/:batchId` - Remove batch
- `POST /api/shipping/:id/signatories` - Add signatory
- `POST /api/shipping/:id/documents` - Upload document
- `GET /api/shipping/:id/packing-list.pdf` - Generate packing list PDF
- `POST /api/shipping/:id/link-license` - Link export license

#### Reporting Outputs

1. **Packing List** (PDF)
   - Professional format for customs and transport
   - Detailed item listing with all weights and fineness
   - Signatory blocks
   - Seal numbers and security information

2. **Shipment Summary Report**
   - Shipment timeline and status history
   - Production batch details
   - Associated documents
   - License quota usage

3. **Monthly Shipment Statistics**
   - Total shipments by mining company
   - Total ounces shipped
   - Average shipment size
   - Export license utilization
   - Shipment frequency analysis

---

### MODULE 3: EXPORT LICENSE MANAGEMENT & QUOTA TRACKING

#### Business Objective
Ensure compliance with government export regulations by managing export licenses, tracking quota usage in real-time, and preventing unauthorized or over-quota shipments.

#### Key Features

**3.1 License Registration**

**Basic License Information**
- **License Number**: Government-issued unique identifier (e.g., "ML-EXP-2025-0456")
- **Issuing Authority**: Government ministry or agency name
- **License Type**: Precious metals export license, temporary export, etc.
- **Mining Company**: Which company this license belongs to
- **Issued Date**: Date license was granted
- **Valid From**: Start date of license validity period
- **Valid To**: Expiration date of license
- **Days Remaining**: Auto-calculated countdown to expiration

**Quota Information**
- **Authorized Quantity**: Total kilograms or troy ounces authorized for export
- **Unit of Measurement**: kg or oz (system converts as needed)
- **Used Quantity**: Total already exported under this license (auto-updated)
- **Remaining Quantity**: Real-time calculation: `authorized - used`
- **Utilization Percentage**: Visual indicator of quota usage

**Financial Information**
- **Average Sale Price**: Expected or committed sale price per oz (USD)
- **Total Value**: `authorized_quantity × average_sale_price`
- **Export Duty**: Applicable export tax/duty percentage
- **Fee Paid**: License fee paid to government

**Administrative Details**
- **Reference Number**: Internal tracking reference
- **Notes**: Free-text notes on license conditions, restrictions, or special requirements
- **Renewal Information**: Details about renewal process or next license application

**3.2 License Status Management**

**Status Workflow**:
```
pending → active → exhausted
         ↓         ↓
     expired   suspended
         ↓         ↓
     cancelled ← cancelled
```

**Status Definitions**:

- **Pending**: License application submitted, awaiting approval
  - Not yet valid for use
  - No quota deductions allowed
  - Monitoring for approval notification

- **Active**: License is valid and available for use
  - Within validity period (valid_from <= today <= valid_to)
  - Has remaining quota available
  - Can be linked to shipments
  - Primary working status

- **Exhausted**: Quota fully utilized
  - Used quantity >= authorized quantity
  - Auto-updated by system when quota consumed
  - Cannot be used for new shipments
  - Historical record maintained

- **Expired**: Validity period ended
  - Today > valid_to date
  - Cannot be used for new shipments
  - May trigger renewal process
  - Historical record maintained

- **Suspended**: Temporarily suspended by authority
  - Manual status set by administrator
  - Cannot be used until reactivated
  - Reason required (government order, investigation, etc.)

- **Cancelled**: License cancelled or revoked
  - Manual status set by administrator
  - Permanent termination
  - Reason required (regulatory violation, company request, etc.)

**Status Change Triggers**:
- **Automatic**:
  - `pending` → `active`: On valid_from date at midnight
  - `active` → `expired`: On valid_to date + 1 day
  - `active` → `exhausted`: When used_quantity >= authorized_quantity
- **Manual**:
  - `active` → `suspended`: By administrator
  - `suspended` → `active`: By administrator
  - Any status → `cancelled`: By administrator

**3.3 Quota Tracking & Deduction**

**Real-Time Quota Calculation**
```sql
remaining_quantity = authorized_quantity - used_quantity
utilization_percentage = (used_quantity / authorized_quantity) × 100
```

**Automatic Quota Deduction**
When a shipment is marked "shipped", the system:
1. Identifies the linked export license
2. Calculates the shipment's pure gold oz total
3. Deducts from the license's used_quantity
4. Recalculates remaining_quantity
5. Checks if license now exhausted (remaining ≤ 0)
6. Updates license status if exhausted
7. Logs the transaction in quota_usage_history

**Quota Deduction Example**:
```
License ML-EXP-2025-0456:
  Authorized: 1,000 oz
  Used (before): 750 oz
  Remaining: 250 oz

Shipment KGM/2025-045:
  Pure gold: 180 oz

After shipment:
  Used (after): 930 oz (750 + 180)
  Remaining: 70 oz (1,000 - 930)
  Utilization: 93%
  Status: active (alert: <10% remaining)
```

**Quota Validation Before Shipment**
Before linking a license to a shipment, the system validates:
- ✅ License status is "active"
- ✅ License not expired (valid_to >= today)
- ✅ Shipment quantity <= remaining quota
- ✅ License belongs to same mining company as shipment
- ❌ If any check fails, shipment cannot proceed

**3.4 Alert & Notification System**

**Automated Alerts**:

**Quota Depletion Alerts**
- **90% Threshold**: Warning when 90% of quota used
  - Notify: License manager, management
  - Action: Plan for next license application

- **95% Threshold**: Critical alert
  - Notify: All stakeholders
  - Action: Urgent license renewal or request additional quota

- **100% Exhausted**: License fully utilized
  - Notify: All stakeholders, freeze new shipments using this license
  - Action: Must obtain new license before next shipment

**Expiration Alerts**
- **30 Days Before**: First warning
  - Notify: License manager
  - Action: Initiate renewal process

- **14 Days Before**: Urgent reminder
  - Notify: Management, license manager
  - Action: Expedite renewal

- **7 Days Before**: Critical alert
  - Notify: All stakeholders
  - Action: Emergency renewal or temporary license request

- **Expired**: License no longer valid
  - Notify: All stakeholders
  - Action: Cannot create new shipments

**Status Change Alerts**
- When license suspended or cancelled
- When license activated or reactivated
- When license exhausted

**Notification Channels**:
- In-app notifications (real-time)
- Email notifications (immediate)
- SMS for critical alerts (optional)
- Dashboard alerts with color coding

**3.5 License Document Management**

**Document Types**:
- **License Certificate**: Original government-issued license (PDF scan)
- **Supporting Documents**:
  - Application form
  - Approval letter
  - Payment receipt
  - Company registration
  - Mining permit
  - Export authorization
  - Amendment documents (if quota increased)
  - Renewal correspondence

**Document Features**:
- Multiple documents per license
- Document categorization by type
- Upload date and uploaded by tracking
- PDF preview in browser
- Download original document
- Document version history
- Document expiry dates (for time-limited authorizations)

**3.6 License Utilization Reports**

**License Summary Report**
- License number and status
- Validity period
- Quota authorized vs. used
- Utilization percentage
- Remaining quota
- Number of shipments under this license
- Total value exported
- Days until expiration

**Quota Usage Detail Report**
- Chronological list of all shipments using the license
- Each shipment with:
  - Shipment date
  - Expedition lot number
  - Pure gold oz deducted
  - Cumulative used quantity
  - Remaining quota after each shipment

**License Portfolio Report**
- All licenses for a mining company
- Current status distribution (active, expired, exhausted)
- Total authorized quota across all licenses
- Total remaining quota available
- Upcoming expirations
- Recommended actions

**Government Submission Report**
- Formatted for government regulatory reporting
- Compliance summary
- Quota utilization by license
- Export value calculations
- Duty calculations

#### User Roles & Permissions

| Role | View | Create | Edit | Delete | Change Status | View Quota |
|------|------|--------|------|--------|---------------|------------|
| **Factory** | Own company | Request | ✗ | ✗ | ✗ | ✓ |
| **Airport** | All | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Management** | All | ✓ | ✓ | ✗ (soft) | ✓ | ✓ |
| **Admin** | All | ✓ | ✓ | ✓ (soft) | ✓ | ✓ |
| **Refinery** | Related | ✗ | ✗ | ✗ | ✗ | ✗ |

#### Business Rules

1. **Uniqueness**: License numbers must be unique across the system
2. **Date Validation**:
   - Valid_from must be <= valid_to
   - Valid_to must be in the future for new licenses
   - Cannot create license with expired dates
3. **Quota Rules**:
   - Authorized quantity must be > 0
   - Used quantity cannot be manually decreased (only via shipment cancellation)
   - Cannot deduct more than remaining quota
4. **Status Transitions**:
   - Cannot manually change status to "exhausted" (automatic only)
   - Cannot manually change status to "expired" (automatic only)
   - Can only reactivate "suspended" licenses
   - Cannot reactivate "cancelled" licenses
5. **Shipment Linkage**:
   - One shipment can only use one license
   - License must be "active" to be used
   - Shipment quantity must not exceed remaining quota
6. **Mining Company Restriction**: License can only be used for shipments from the same mining company
7. **Deletion Protection**: Cannot delete licenses with linked shipments (soft delete only)
8. **Amendment Tracking**: Any changes to authorized quantity must be documented with amendment documents

#### Integration Points

**Upstream**:
- Receives license data from government systems (manual entry or API integration)
- Links to mining company master data

**Downstream**:
- Provides available licenses to Shipping Preparation Module
- Auto-deducts quota when shipments are finalized
- Feeds into Compliance Reporting Module
- Updates export authorization status for customs

**External**:
- Email notifications for expiration and depletion alerts
- SMS alerts for critical quota events
- API endpoints for government reporting systems (if available)
- Integration with company ERP for financial tracking

#### Technical Implementation

**Database Tables**:
- `export_licenses`: Main license records
- `export_license_documents`: Attached documents
- `quota_usage_history`: Audit trail of all quota deductions
- `license_status_history`: Status change tracking

**Key Database Functions**:
```sql
-- Calculate remaining quantity (generated column)
CREATE FUNCTION calculate_remaining_quantity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_quantity = NEW.authorized_quantity - NEW.used_quantity;
  NEW.utilization_percentage = (NEW.used_quantity / NEW.authorized_quantity) * 100;

  -- Auto-update status if exhausted
  IF NEW.remaining_quantity <= 0 AND NEW.status = 'active' THEN
    NEW.status = 'exhausted';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check license availability
CREATE FUNCTION check_license_availability(license_id UUID, shipment_oz NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
  lic RECORD;
BEGIN
  SELECT status, remaining_quantity, valid_to
  INTO lic
  FROM export_licenses
  WHERE id = license_id;

  -- Check all conditions
  RETURN (
    lic.status = 'active' AND
    lic.remaining_quantity >= shipment_oz AND
    lic.valid_to >= CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql;

-- Deduct quota from license
CREATE FUNCTION deduct_license_quota(license_id UUID, quantity_oz NUMERIC, shipment_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update used quantity
  UPDATE export_licenses
  SET used_quantity = used_quantity + quantity_oz
  WHERE id = license_id;

  -- Log the deduction
  INSERT INTO quota_usage_history (license_id, shipment_id, quantity_oz, timestamp)
  VALUES (license_id, shipment_id, quantity_oz, NOW());

  -- Send alert if approaching depletion
  PERFORM send_quota_alert_if_needed(license_id);
END;
$$ LANGUAGE plpgsql;
```

**API Endpoints**:
- `POST /api/licenses` - Create new license
- `GET /api/licenses` - List licenses (filtered by company, status)
- `GET /api/licenses/:id` - Get license details
- `PUT /api/licenses/:id` - Update license
- `DELETE /api/licenses/:id` - Delete license (soft delete)
- `POST /api/licenses/:id/status` - Change license status
- `POST /api/licenses/:id/documents` - Upload documents
- `GET /api/licenses/:id/usage-history` - Get quota usage history
- `GET /api/licenses/:id/check-availability` - Check if license can be used for a shipment
- `POST /api/licenses/:id/deduct-quota` - Deduct quota (triggered by shipment)
- `GET /api/licenses/expiring-soon` - Get licenses expiring within 30 days
- `GET /api/licenses/nearly-exhausted` - Get licenses >90% utilized

#### Reporting Outputs

1. **License Certificate** (PDF Export)
   - Professional format for government submission
   - License details
   - Quota information
   - Utilization summary

2. **Quota Utilization Report**
   - License-by-license breakdown
   - Shipment details contributing to quota usage
   - Timeline visualization

3. **Compliance Summary Report**
   - All licenses for a company
   - Status overview
   - Upcoming expiration warnings
   - Over-quota alerts (if any violations)

4. **Government Export Submission Report**
   - Formatted according to government requirements
   - Total exports by license
   - Duty calculations
   - Regulatory compliance attestation

---

### MODULE 4: FREIGHT & CUSTOMS CLEARANCE

#### Business Objective
Manage the customs clearance process and coordinate international freight logistics to ensure compliant and efficient export of precious metals from West Africa to international refineries.

#### Key Features

**4.1 Customs Operations Management**

**Customs Declaration**
- **Declaration Number**: Government customs declaration unique identifier
- **Declaration Date**: Date customs declaration submitted
- **Customs Office**: Specific customs office handling the clearance
- **Customs Officer**: Name and badge number of handling officer
- **Customs Station Code**: Official station code (e.g., "GIN-CKY-001" for Conakry, Guinea)

**Documentation Required**
- **Commercial Invoice**: Detailed breakdown of metal value
- **Packing List**: From Shipping Preparation module
- **Export License**: Copy of valid export license
- **Assay Certificates**: For each production batch
- **Certificate of Origin**: Proof gold mined in declaring country
- **Insurance Certificate**: Transit insurance documentation
- **Transport Authorization**: Government permit for precious metals transport

**Customs Approval Process**
- **Submission Workflow**:
  1. Compile all required documents
  2. Submit to customs electronically or in person
  3. Await customs inspection (may include physical inspection)
  4. Customs officer reviews and approves
  5. Receive customs approval certificate
  6. Obtain customs clearance stamp

- **Approval Tracking**:
  - **Approval Date**: Date customs granted clearance
  - **Approval Reference**: Customs approval certificate number
  - **Clearance Type**: Standard, expedited, or special clearance
  - **Export Duty Paid**: Amount paid in local currency
  - **Export Duty Receipt**: Receipt number from payment

**Customs Status Workflow**:
```
customs_pending → customs_approved → ready_for_transport → in_transit → cleared_export
                       ↓
                 customs_rejected (with rejection reason)
```

**4.2 Commercial Invoice Generation**

**Invoice Purpose**: Professional customs invoice required for international freight, detailing the shipment value for customs authorities and insurance.

**Invoice Components**:

**Header Section**
- Company name, logo, and letterhead
- Invoice number: `CINV-[ShipmentRef]-[Date]`
- Invoice date
- Seller details (mining company):
  - Full registered name
  - Complete address
  - Tax identification number
  - Business registration number
- Buyer details (refinery or consignee):
  - Company name
  - Address
  - Country
  - Contact person

**Shipment Details**
- Expedition lot number (shipment reference)
- Date of shipment
- Port of loading
- Port of discharge
- Final destination
- Transport method (air freight, sea freight)
- Expected delivery date

**Item Breakdown Table**
| Item # | Description | Bar Ref | Gross Weight (g) | Fineness (%) | Pure Gold (oz) | Silver (g) | Unit Price (USD/oz) | Line Total (USD) |
|--------|-------------|---------|------------------|--------------|----------------|------------|---------------------|------------------|
| 1 | Gold bullion | KGM-2025-123 | 1,250.0 | 95.5 | 38.58 | 15.2 | 2,050.00 | $79,089.00 |
| 2 | Gold bullion | KGM-2025-124 | 1,180.0 | 96.2 | 36.62 | 12.8 | 2,050.00 | $75,071.00 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Summary Section**
- **Total Items**: Count of individual bars/ingots
- **Total Gross Weight**: Sum in grams and kilograms
- **Total Pure Gold**: Sum in troy ounces
- **Total Silver Content**: Sum in grams
- **Weighted Average Fineness**: Across all items

**Financial Calculations**
- **Gold Price per Oz**: LBMA AM price on shipment date
- **Subtotal**: `Total pure oz × Price per oz`
- **Insurance** (if applicable): Percentage of subtotal
- **Freight** (if included): Flat rate or per kg
- **Export Duty** (if applicable): Percentage of subtotal
- **Total Invoice Value**: Sum of all charges

**Currency Information**
- **Invoice Currency**: USD (primary)
- **Local Currency Equivalent**: CFA Franc or GNF
- **Exchange Rate**: Official rate on invoice date
- **Exchange Rate Source**: Central Bank reference

**Terms and Conditions**
- **Payment Terms**: As per sales agreement
- **Incoterms**: Typically EXW (Ex Works) or FOB (Free On Board)
- **Insurance**: Who bears risk during transport
- **Dispute Resolution**: Governing law and jurisdiction

**Certification Statement**
```
"I hereby certify that the information on this invoice is true and correct,
and that the gold described herein originates from [Country] and complies
with all applicable export regulations and international standards."

Authorized Signatory: _________________
Name: _________________
Title: _________________
Date: _________________
Company Stamp: [    ]
```

**PDF Generation Features**:
- Professional layout matching international standards
- Multi-page support for large shipments
- Embedded company logo and seal
- QR code for verification
- Watermark (optional): "ORIGINAL", "COPY", "CUSTOMS COPY"
- Multi-copy generation: Original, Customs, Transport, Company file

**4.3 Freight Company & Transport Coordination**

**Freight Company Selection**
- **Registered Freight Companies**: Database of approved international freight forwarders
- **Company Details**:
  - Company name
  - Country of operation
  - Specialization (air freight, sea freight, both)
  - Contact person and emergency contact
  - Phone, email, website
  - Service level agreements (SLAs)
  - Insurance coverage details
  - Track record (on-time percentage, claims history)

**Air Waybill (AWB) Management**
- **AWB Number**: Unique airway bill number (11 digits)
- **Flight Details**:
  - Flight number
  - Departure airport (IATA code)
  - Arrival airport (IATA code)
  - Scheduled departure date/time
  - Scheduled arrival date/time
  - Actual departure date/time (updated by airline)
  - Actual arrival date/time (updated by airline)
- **Cargo Details**:
  - Number of pieces
  - Total weight (kg)
  - Volume (cubic meters)
  - Handling instructions: "VALUABLE CARGO - HANDLE WITH CARE"
  - Special requirements: Security escort, temperature control, etc.

**Bill of Lading (for Sea Freight)**
- **B/L Number**: Unique bill of lading number
- **Vessel Details**:
  - Vessel name
  - IMO number
  - Departure port
  - Arrival port
  - Estimated time of departure (ETD)
  - Estimated time of arrival (ETA)
  - Container number (if containerized)
  - Seal numbers

**Tracking Integration**
- **Tracking Number**: Carrier tracking number
- **Status Updates**: Real-time status from freight company
  - Cargo collected from origin
  - Departed origin airport/port
  - In transit
  - Arrived destination airport/port
  - Cleared customs at destination
  - Out for delivery
  - Delivered to consignee
- **GPS Tracking** (if available): Real-time location
- **Alerts**:
  - Departure confirmation
  - Arrival confirmation
  - Delay notifications
  - Emergency alerts (diversions, damage, theft attempts)

**4.4 Insurance & Risk Management**

**Insurance Coverage**
- **Insurance Company**: Name of underwriter
- **Policy Number**: Insurance policy reference
- **Coverage Amount**: Total insured value (typically 110% of invoice value)
- **Coverage Type**: All-risk, named perils, or transit insurance
- **Coverage Period**: From origin to destination
- **Deductible**: Amount deductible in case of claim
- **Premium**: Insurance cost (usually % of insured value)

**Risk Assessment**
- **Route Risk Analysis**: Assess transit route for security risks
- **Country Risk**: Political stability, theft rates
- **Transport Mode Risk**: Air (low risk) vs. Sea (medium risk) vs. Road (higher risk)
- **Value at Risk**: Total value being transported

**Security Measures**
- **Escort Requirements**: Armed escort for high-value shipments
- **Secure Storage**: At transit points
- **Chain of Custody**: Documented handoffs at each stage
- **GPS Tracking Devices**: Real-time location monitoring
- **Tamper-Evident Packaging**: Seals and packaging that show if opened

**4.5 Destination Receiving Confirmation**

**Refinery Receipt Process**
- **Notification**: Email/SMS notification when shipment arrives at refinery
- **Physical Receipt**: Refinery confirms receipt in system
- **Weight Verification**: Refinery weighs shipment
  - Expected gross weight (from packing list)
  - Actual received weight (measured by refinery)
  - Variance calculation: `(actual - expected) / expected × 100%`
  - Acceptable variance threshold: ±0.5% (configurable)

**Variance Handling**
- **Within Tolerance** (≤0.5% variance):
  - Auto-accept receipt
  - Update shipment status to "received"
  - Proceed to refining process

- **Exceeds Tolerance** (>0.5% variance):
  - Flag for investigation
  - Require reconciliation report
  - Management approval needed to proceed
  - Possible insurance claim
  - Potential dispute with freight company

**Seal Verification**
- **Seal Integrity Check**: Refinery verifies seals intact
- **Seal Number Verification**: Confirms seal numbers match packing list
- **Photo Documentation**: Refinery uploads photos of received shipment with seals
- **Discrepancy Reporting**: If seals broken or tampered, immediate alert

**Receipt Documentation**
- **Goods Received Note (GRN)**: Refinery-issued receipt document
- **GRN Number**: Unique receipt number
- **GRN Date**: Date goods received
- **Condition Report**: Physical condition of shipment
- **Quality Report**: Initial visual assessment (before refining)

#### User Roles & Permissions

| Role | View | Create Customs | Approve Customs | Assign Freight | Track Status |
|------|------|----------------|-----------------|----------------|--------------|
| **Factory** | Own company | ✗ | ✗ | ✗ | ✓ |
| **Airport** | All | ✓ | ✗ | ✓ | ✓ |
| **Management** | All | ✓ | ✓ | ✓ | ✓ |
| **Customs Officer** | Related | ✗ | ✓ (external) | ✗ | ✗ |
| **Freight Company** | Assigned | ✗ | ✗ | ✗ | Update status |
| **Refinery** | Incoming | ✗ | ✗ | ✗ | Confirm receipt |

#### Business Rules

1. **Customs Clearance**: Cannot mark shipment as "ready_for_transport" without customs approval
2. **Document Completeness**: All required customs documents must be attached before submission
3. **Export License Verification**: Customs officer must verify export license validity
4. **Commercial Invoice**: Must be generated before customs submission
5. **Freight Assignment**: Cannot assign freight company until customs approved
6. **AWB/B/L Requirement**: AWB or B/L number required before marking "in_transit"
7. **Seal Verification**: Receiving party must verify seals before accepting
8. **Variance Threshold**: Variances >0.5% require management approval
9. **Insurance**: Mandatory for shipments >$100,000 USD value
10. **Status Sequence**: Cannot skip workflow steps

#### Integration Points

**Upstream**:
- Imports shipment data from Shipping Preparation Module
- Imports export license details from License Module
- Imports production batch details for customs invoice

**Downstream**:
- Updates shipment status in Shipping Preparation
- Triggers Freight Shipment creation (to refinery)
- Feeds into Refining Module (upon receipt confirmation)
- Updates analytics for customs clearance times

**External**:
- Integration with customs authority systems (if API available)
- Integration with freight company tracking systems
- Email notifications to freight companies and refineries
- SMS alerts for status changes

#### Technical Implementation

**Database Tables**:
- `freight_customs_operations`: Main customs clearance records
- `freight_customs_documents`: Attached customs documents
- `freight_customs_invoice_data`: Commercial invoice details
- `transport_bookings`: Freight booking details
- `insurance_policies`: Insurance coverage records

**Key Database Functions**:
```sql
-- Generate commercial invoice data
CREATE FUNCTION generate_commercial_invoice(shipment_id UUID)
RETURNS JSON AS $$
DECLARE
  invoice_data JSON;
  gold_price NUMERIC;
  fx_rate NUMERIC;
BEGIN
  -- Get current LBMA price and FX rate
  SELECT price_usd INTO gold_price FROM gold_prices_daily WHERE date = CURRENT_DATE LIMIT 1;
  SELECT rate INTO fx_rate FROM fx_rates WHERE from_currency = 'USD' AND to_currency = 'XOF' AND date = CURRENT_DATE LIMIT 1;

  -- Compile invoice data
  SELECT json_build_object(
    'shipment_id', sp.id,
    'expedition_lot', sp.expedition_lot_number,
    'seller', mc.name,
    'seller_address', mc.address,
    'buyer', r.name,
    'buyer_address', r.address,
    'items', (
      SELECT json_agg(json_build_object(
        'bar_reference', dp.bar_reference,
        'gross_weight_g', dp.gross_weight_grams,
        'fineness', dp.fineness,
        'pure_gold_oz', dp.pure_gold_oz,
        'unit_price_usd', gold_price,
        'line_total_usd', dp.pure_gold_oz * gold_price
      ))
      FROM shipping_production_items spi
      JOIN daily_production dp ON dp.id = spi.production_id
      WHERE spi.shipping_id = sp.id
    ),
    'total_pure_oz', sp.total_pure_gold_oz,
    'gold_price_usd', gold_price,
    'subtotal_usd', sp.total_pure_gold_oz * gold_price,
    'fx_rate', fx_rate
  ) INTO invoice_data
  FROM shipping_preparations sp
  JOIN mining_companies mc ON mc.id = sp.mining_company_id
  JOIN refineries r ON r.id = sp.refinery_id
  WHERE sp.id = shipment_id;

  RETURN invoice_data;
END;
$$ LANGUAGE plpgsql;

-- Calculate variance on receipt
CREATE FUNCTION calculate_receipt_variance(shipment_id UUID, actual_weight_g NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  expected_weight NUMERIC;
  variance_pct NUMERIC;
BEGIN
  SELECT total_net_weight_grams INTO expected_weight
  FROM shipping_preparations
  WHERE id = shipment_id;

  variance_pct = ((actual_weight_g - expected_weight) / expected_weight) * 100;

  RETURN variance_pct;
END;
$$ LANGUAGE plpgsql;
```

**API Endpoints**:
- `POST /api/customs` - Create customs operation
- `GET /api/customs` - List customs operations
- `GET /api/customs/:id` - Get customs details
- `PUT /api/customs/:id` - Update customs operation
- `POST /api/customs/:id/approve` - Approve customs clearance
- `POST /api/customs/:id/reject` - Reject customs clearance
- `POST /api/customs/:id/documents` - Upload documents
- `GET /api/customs/:id/commercial-invoice.pdf` - Generate commercial invoice PDF
- `POST /api/freight-booking` - Create freight booking
- `PUT /api/freight-booking/:id/awb` - Add AWB number
- `POST /api/freight-booking/:id/track` - Update tracking status
- `POST /api/receive-shipment` - Confirm shipment receipt at refinery

#### Reporting Outputs

1. **Commercial Invoice** (PDF)
   - Professional format for customs and freight
   - Detailed item breakdown
   - Financial calculations
   - Signatures and certifications

2. **Customs Declaration Summary** (PDF)
   - Formatted for customs authority
   - All required regulatory information
   - Export duty calculations
   - Supporting document checklist

3. **Freight Manifest** (PDF)
   - Complete cargo details
   - Handling instructions
   - Emergency contact information
   - Insurance details

4. **Monthly Customs Report**
   - Total exports by destination
   - Average clearance time
   - Export duty paid
   - Compliance metrics

---

### MODULE 5: FREIGHT SHIPMENTS TO REFINERY

#### Business Objective
Consolidate multiple production batches into organized freight shipments bound for international refineries, with complete commercial documentation, automatic value calculations, and full traceability.

#### Key Features

**5.1 Freight Shipment Creation**

**Reference Number System**
- **Format**: `HUM-SMK-XXX/YYYY`
  - `HUM-SMK` = Humgold SMK (company prefix)
  - `XXX` = Sequential number (001, 002, 003...)
  - `YYYY` = Year
  - Example: `HUM-SMK-045/2025`
- **Auto-Generation**: System automatically assigns next available number
- **Unique Constraint**: No duplicate shipment references

**Production Batch Selection**
- **Multi-Select Interface**: Select multiple production batches for one freight shipment
- **Status Filter**: Only show production with status "shipped" or "ready_for_customs"
- **Mining Company Filter**: Filter by mining company
- **Date Range**: Select batches from specific period
- **Preview Panel**: Real-time totals as batches selected
- **Validation**: System prevents duplicate usage (one batch can only be in one freight shipment)

**Automatic Calculations via Database Triggers**

When production batches are added/removed, system automatically recalculates:

```sql
-- Total Bullion Weight (Gross Weight)
total_bullion_weight_grams = SUM(production.gross_weight_grams)
total_bullion_weight_oz = total_bullion_weight_grams / 31.1035

-- Pure Gold Content
total_pure_gold_grams = SUM(production.pure_gold_grams)
total_pure_gold_oz = SUM(production.pure_gold_oz)

-- Pure Silver Content
total_silver_grams = SUM(production.silver_content_grams)

-- Weighted Average Fineness
average_fineness = (SUM(production.gross_weight_grams × production.fineness) / total_bullion_weight_grams)

-- Commercial Value (USD)
total_value_usd = total_pure_gold_oz × lbma_am_price_usd

-- Commercial Value (Local Currency)
total_value_local = total_value_usd × fx_rate
```

All calculations update in real-time as the shipment composition changes.

**5.2 Refinery Destination**

**Refinery Selection**
- **Registered Refineries**: Choose from database of approved international refineries
- **Refinery Information Display**:
  - Refinery name
  - Country location
  - Contact person
  - Phone/email
  - Address for shipping
  - Certification (LBMA Good Delivery, etc.)
  - Historical processing data (average turnaround time, refining efficiency)

**Shipping Destination Details**
- Complete refinery address
- Contact person at refinery
- Emergency contact
- Special delivery instructions
- Operating hours for receiving
- Inspection requirements

**5.3 Commercial Terms & Pricing**

**Gold Price Snapshot**
- **LBMA AM Price**: Gold price at time of shipment creation (locked)
- **Price Date**: Date price captured
- **Price Source**: LBMA, Kitco, or other source
- **Currency**: USD per troy ounce
- **Price Type**: Spot, Forward 14D, or Forward 30D

**Foreign Exchange Rate Snapshot**
- **FX Rate**: Exchange rate at time of shipment creation (locked)
- **Rate Date**: Date rate captured
- **Rate Source**: Central Bank, ECB, or commercial bank
- **Currency Pair**: USD/XOF (CFA Franc) or USD/GNF (Guinean Franc)
- **Rate Type**: Buying rate, selling rate, or mid-market rate

**Value Locking**
Both gold price and FX rate are locked at shipment creation to:
- Protect against price fluctuations during transit
- Provide accurate financial planning
- Match customs declaration values
- Facilitate insurance calculations

**5.4 Packaging & Box Management**

**Box Configuration**
- **Number of Boxes**: Total boxes in freight shipment
- **Box List**: Detailed list of each box:
  - Box number (1, 2, 3...)
  - Box weight (gross weight including packaging)
  - Number of items in box
  - Box sealing method
  - Security seal numbers applied to each box
  - Box description (e.g., "Wooden crate, metal-lined, double-sealed")

**Box Assignment to Production Batches**
- Assign each production batch to specific box number
- Track which bars/ingots are in which box
- Box manifest for easy retrieval

**Example**:
```
Box 1 (45.5 kg):
  - KGM-2025-123 (1,250 g)
  - KGM-2025-124 (1,180 g)
  - KGM-2025-125 (1,310 g)
  - ...
  Total items in box: 18
  Seal numbers: S-12345, S-12346

Box 2 (47.2 kg):
  - KGM-2025-141 (1,405 g)
  - ...
```

**5.5 Signatory Management**

**Multi-Signatory Support**
- Add multiple signatories for the freight shipment
- Typically 3-5 signatories:
  - Logistics Manager (preparer)
  - Operations Manager (approver)
  - Finance Manager (value certification)
  - Security Officer (seal verification)
  - Customs Officer (export clearance)

**Signatory Information**
- Full name
- Position/title
- Company/organization
- Contact details
- Signature (digital or scanned image)
- Date signed
- Signature authority level

**Digital Signature Integration**
- Support for digital signature certificates
- Signature verification
- Timestamp on signature
- Non-repudiation

**5.6 Status Workflow**

```
pending → approved → shipped_to_refinery → received_at_refinery → refining_complete
    ↓
cancelled (with reason)
```

**Status Definitions**:

- **Pending**: Freight shipment being prepared, batches being added
  - Editable
  - Can add/remove production batches
  - Totals recalculate automatically

- **Approved**: Shipment complete and approved for dispatch
  - Locked for editing (production batches cannot be changed)
  - Generates final documentation (Bullion Summary, Customs Invoice)
  - Ready for physical shipment

- **Shipped to Refinery**: Shipment dispatched, in transit
  - AWB/B/L number recorded
  - Tracking active
  - Insurance active
  - ETA to refinery

- **Received at Refinery**: Refinery confirms receipt
  - Weight verification
  - Seal verification
  - Goods Received Note (GRN) issued
  - Ready for refining process

- **Refining Complete**: Gold refined and entered into inventory
  - Final weights recorded
  - Losses calculated
  - Inventory updated

- **Cancelled**: Shipment cancelled before dispatch
  - Reason required
  - Production batches released back to "shipped" status
  - Available for inclusion in new freight shipment

**5.7 PDF Document Generation**

**Bullion Summary Report**
Professional PDF document containing:

**Header**
- Company logo and letterhead
- Document title: "BULLION SUMMARY"
- Shipment reference: HUM-SMK-XXX/YYYY
- Date of preparation
- Page numbers

**Shipment Overview**
- Total number of items
- Total bullion weight (kg and oz)
- Total pure gold (oz)
- Total silver content (g)
- Average fineness (%)
- Number of boxes
- Destination refinery

**Detailed Item Table**
| Item | Bar Reference | Gross Weight (g) | Fineness (%) | Pure Gold (oz) | Silver (g) | Box # |
|------|---------------|------------------|--------------|----------------|-----------|-------|
| 1 | KGM-2025-123 | 1,250.0 | 95.5 | 38.58 | 15.2 | 1 |
| 2 | KGM-2025-124 | 1,180.0 | 96.2 | 36.62 | 12.8 | 1 |
| ... | ... | ... | ... | ... | ... | ... |

**Summary Totals**
- Total: XXX items
- Total Gross Weight: X,XXX g (XXX oz)
- Total Pure Gold: XXX oz
- Total Silver: XXX g
- Weighted Avg Fineness: XX.X%

**Commercial Value**
- LBMA AM Price: $X,XXX.XX per oz (date)
- Total Value USD: $X,XXX,XXX.XX
- FX Rate: X.XXXX (USD/XOF or USD/GNF)
- Total Value Local: CFA X,XXX,XXX

**Box Manifest**
- Box-by-box breakdown
- Items in each box
- Seal numbers

**Signatories**
- Signature blocks for all signatories
- Date and stamp placeholders

**Customs Invoice (Export)**
Similar to commercial invoice in Customs module, but specific to freight shipment:
- Detailed line items
- Customs harmonized codes
- Export duty calculations
- Insurance details
- Terms and conditions

**5.8 Business Rules & Validations**

1. **Unique Batch Usage**: One production batch can only be in one active freight shipment (enforced by unique constraint)
2. **Status Locking**: Cannot edit production batches after status "approved"
3. **Mining Company Consistency**: All production batches in shipment should ideally be from same mining company (warning if mixed)
4. **Weight Validation**: Total box weights should approximately equal total bullion weight + packaging allowance
5. **Signatory Minimum**: At least 2 signatories required before approval
6. **Price/FX Locking**: Once approved, gold price and FX rate cannot be changed
7. **Cancellation Rules**: Can only cancel shipments in "pending" or "approved" status (not after shipped)
8. **Deletion Protection**: Cannot delete freight shipments after status "shipped_to_refinery"

#### Integration Points

**Upstream**:
- Imports production batches from Production Module and Shipping Preparation
- Imports LBMA prices from Market Data Module
- Imports FX rates from Market Data Module
- Imports refinery data from Stakeholder Module

**Downstream**:
- Feeds into Refining Module (upon receipt)
- Updates production batch status
- Creates inventory entries (after refining)
- Feeds into Analytics for shipment tracking

**External**:
- Email notifications to refinery upon shipment
- Tracking updates from freight companies
- Integration with refinery systems (if API available)

#### User Roles & Permissions

| Role | View | Create | Edit | Delete | Approve | Generate PDF |
|------|------|--------|------|--------|---------|--------------|
| **Factory** | Own company | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Airport** | All | ✓ | Pending | Pending | ✗ | ✓ |
| **Refinery** | Incoming | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Management** | All | ✓ | All | Approved | ✓ | ✓ |

---

### MODULE 6: REFINING PROCESS & QUALITY CONTROL

#### Business Objective
Track the gold refining process at international refineries, calculate final fine gold content after melting, manage quality certifications, and prepare refined gold for inventory entry and sale.

#### Key Features

**6.1 Freight Shipment Receipt Confirmation**

**Receipt Process**
When freight shipment arrives at refinery:
- Refinery logs into system
- Views incoming freight shipments
- Confirms receipt of specific shipment
- Records:
  - **Actual Arrival Date/Time**: When shipment physically received
  - **Receiving Person**: Name of refinery personnel
  - **Initial Inspection**: Visual condition assessment
  - **Seal Verification**: Confirms seals intact and numbers match
  - **Seal Photos**: Upload photos of seals before breaking

**Weight Verification**
- **Expected Gross Weight**: From freight shipment record
- **Actual Received Weight**: Measured by refinery upon receipt
- **Variance Calculation**: `(actual - expected) / expected × 100%`
- **Variance Threshold**: ±0.5% acceptable
- **Over-Threshold Handling**: If variance >0.5%, requires:
  - Detailed variance report
  - Photos of shipment
  - Management approval to proceed
  - Potential insurance claim initiation

**Shipment Status Update**
- Update freight shipment status to "received_at_refinery"
- Trigger notification to all stakeholders
- Start refining timeline tracking

**6.2 Pre-Melting Assessment**

**Bar/Ingot Inventory**
- Unpack all boxes
- Verify bar count matches packing list
- Verify bar reference numbers
- Record:
  - **Pre-Melting Weight**: Total weight before melting (should match gross weight from export)
  - **Number of Pieces**: Count of bars/ingots
  - **Visual Quality**: Color, surface condition, casting quality
  - **Purity Assessment**: XRF (X-ray fluorescence) testing for preliminary fineness check

**Pre-Melting Documentation**
- Photos of all bars/ingots
- Individual bar weights (if available)
- Any anomalies noted (damaged bars, unexpected colors, etc.)
- XRF test results

**6.3 Melting & Refining Process**

**Melting Process**
1. **Batch Preparation**: Prepare bars for melting furnace
2. **Furnace Loading**: Load bars into refining furnace
3. **Temperature Control**: Melt at appropriate temperature (typically 1,064°C for gold)
4. **Flux Addition**: Add borax or other fluxing agents to separate impurities
5. **Slag Removal**: Remove slag (waste material) from molten gold
6. **Sampling**: Take sample for assay

**Post-Melting Measurements**
- **Post-Melting Weight**: Weight of refined gold after melting and slag removal
- **Weight Loss**: `pre_melting_weight - post_melting_weight`
- **Weight Loss Percentage**: `(weight_loss / pre_melting_weight) × 100%`
- **Expected Loss Range**: Typically 1-5% depending on initial fineness

**6.4 Fineness Testing & Certification**

**Assay Testing**
- **Fire Assay**: Traditional cupellation method (most accurate)
- **XRF Analysis**: X-ray fluorescence for non-destructive testing
- **ICP-MS**: Inductively coupled plasma mass spectrometry (for trace elements)

**Fineness Determination**
- **Final Fineness**: Percentage purity after refining
- **Typical Results**: 99.5% to 99.99% for refined gold
- **Standard Achieved**:
  - LBMA Good Delivery: Minimum 99.5% fineness
  - Investment grade: 99.9% (often called "three nines")
  - Ultra-pure: 99.99% ("four nines")

**Impurity Analysis**
Record percentages of other metals:
- Silver (Ag)
- Copper (Cu)
- Iron (Fe)
- Other trace elements

**Refining Certificate**
Refinery issues official certificate containing:
- Certificate number
- Issue date
- Original shipment reference
- Pre-melting weight
- Post-melting weight
- Final fineness achieved
- Assay method used
- Refiner signature and company seal
- Accreditation (ISO 17025, LBMA, etc.)

**6.5 Final Fine Gold Calculation**

**Mathematical Formula**:
```
final_fine_gold_grams = post_melting_weight_grams × (fineness / 100) × (metal_retained_percentage / 100)

final_fine_gold_oz = final_fine_gold_grams / 31.1035
```

**Components Explained**:

1. **Post-Melting Weight**: Weight after refining (e.g., 15,500 grams)
2. **Fineness**: Purity percentage (e.g., 99.9%)
3. **Metal Retained Percentage**: Percentage of metal retained by refinery as fees (e.g., 98%)
   - Refineries typically retain 1-2% as refining fee
   - This is deducted from the final fine gold amount

**Example Calculation**:
```
Original Gross Weight: 16,000 grams
Pre-Melting Weight: 15,950 grams (some loss during unpacking/handling)
Post-Melting Weight: 15,200 grams (750g loss during refining - impurities removed)
Fineness Achieved: 99.9%
Metal Retained: 98.5% (1.5% refining fee)

Final Fine Gold (grams) = 15,200 × (99.9 / 100) × (98.5 / 100)
                        = 15,200 × 0.999 × 0.985
                        = 14,955 grams

Final Fine Gold (oz) = 14,955 / 31.1035
                     = 480.74 oz
```

**Comparison to Export**:
```
Original Export: 485.20 oz pure gold (from freight shipment)
Final Fine: 480.74 oz
Difference: -4.46 oz (0.92% loss)
Reason: Refining losses (impurities removed) + refining fee
```

**6.6 Variance Analysis & Reporting**

**Expected vs. Actual Analysis**

Compare final results against expectations:

| Metric | Expected (Export) | Actual (Refining) | Variance | % Variance |
|--------|-------------------|-------------------|----------|------------|
| Gross Weight (g) | 16,000 | 15,950 | -50 | -0.31% |
| Pure Gold (oz) | 485.20 | 480.74 | -4.46 | -0.92% |
| Fineness (%) | 95.5 | 99.9 | +4.4 | +4.61% |

**Variance Tolerances**:
- **Weight Variance**: ±1% acceptable
- **Fineness Improvement**: Expected to increase significantly after refining
- **Pure Gold Variance**: ±2% acceptable (accounting for impurities removed + refining fee)

**Variance Investigation**:
If variance exceeds tolerances:
- Detailed variance report required
- Refinery provides explanation
- Photos and assay evidence
- Management review
- Potential dispute with refinery
- Insurance claim if significant loss

**6.7 Quality Control & Certification**

**Internal Quality Checks**
- Verify all calculations
- Cross-check weights with refinery scales
- Verify fineness certification
- Check refinery accreditation current
- Verify certificate authenticity

**External Verification** (for high-value shipments)
- Independent assay laboratory
- Third-party weight verification
- Insurance surveyor inspection

**Certification Storage**
- Upload refining certificate (PDF)
- Store assay reports
- Archive chain of custody documents
- Maintain in document management system

**6.8 Status Updates & Notifications**

**Refining Timeline Tracking**
- Receipt date
- Melting scheduled date
- Melting completed date
- Assay completed date
- Certificate issued date
- Ready for inventory date

**Notifications**:
- Email notification when received at refinery
- Email notification when refining complete
- Email notification when certificate issued
- Alert if refining taking longer than expected (>7 days)

**Status Update to Freight Shipment**:
Update freight shipment status to "refining_complete"

#### User Roles & Permissions

| Role | View | Confirm Receipt | Record Refining | Issue Certificate | Approve Results |
|------|------|-----------------|-----------------|-------------------|-----------------|
| **Refinery** | Assigned | ✓ | ✓ | ✓ | ✗ |
| **Management** | All | ✓ | ✓ | ✓ | ✓ |
| **Factory** | Own company | ✗ | ✗ | ✗ | ✗ |
| **Customer** | ✗ | ✗ | ✗ | ✗ | ✗ |

#### Business Rules

1. **Receipt Before Refining**: Must confirm receipt before entering refining data
2. **Weight Validation**: Post-melting weight cannot exceed pre-melting weight
3. **Fineness Range**: Final fineness must be between 95% and 100%
4. **Metal Retained**: Metal retained percentage typically 97-99%
5. **Certificate Required**: Refining certificate must be uploaded before marking complete
6. **Variance Approval**: Variances >2% require management approval
7. **Final Fine Cannot Be Negative**: Calculations must result in positive final fine gold amount
8. **One Refining Record per Shipment**: Cannot duplicate refining records

#### Integration Points

**Upstream**:
- Receives freight shipment data
- Imports expected weights and fineness

**Downstream**:
- Creates inventory entry (gold_inventory table)
- Updates freight shipment status
- Feeds into Sales module (gold now available for sale)
- Updates analytics with refining efficiency metrics

---

### MODULE 7: GOLD & SILVER INVENTORY MANAGEMENT

#### Business Objective
Track refined gold and silver inventory in real-time, manage stock allocations for sales, maintain complete transaction history, and provide accurate available balance for sales operations.

#### Key Features

**7.1 Inventory Entry from Refining**

**Automatic Inventory Creation**
When refining process is complete (status: "refining_complete"), system automatically:
- Creates new gold inventory entry
- Populates from refining record:
  - Freight shipment reference
  - Mining company
  - Refinery
  - Weights (pre-melting, post-melting, final fine)
  - Fineness achieved
  - Metal retained percentage
  - Refining certificate number
  - Entry date (refining completion date)

**Inventory Record Fields**:
- **Entry ID**: Unique identifier
- **Source**: "Refining" (future: could also be "Purchase", "Transfer")
- **Mining Company**: Which mining company produced the gold
- **Refinery**: Where refining took place
- **Entry Date**: Date added to inventory
- **Weight Grams**: Final fine gold in grams
- **Weight Oz**: Final fine gold in troy ounces
- **Fineness**: Final purity percentage
- **Status**: `available`, `allocated`, `sold`
- **Current Balance Oz**: Available oz not yet sold or allocated

**7.2 Inventory Status Management**

**Three Inventory States**:

1. **Available**: Gold in stock, not allocated to any sale
   - Can be allocated to new sales
   - Shows in "Available Balance" dashboard
   - Active inventory

2. **Allocated**: Gold reserved for a specific sale (pending completion)
   - Sale created but not yet completed
   - Payment not yet received
   - Temporarily locked for that sale
   - If sale cancelled, returns to "available"

3. **Sold**: Gold sold and payment received
   - Sale completed
   - No longer available
   - Historical record

**Status Transitions**:
```
available → allocated → sold
    ↑           ↓
    └─── (if sale cancelled)
```

**7.3 Real-Time Balance Calculation**

**Database Function for Available Balance**:
```sql
CREATE FUNCTION get_available_inventory_balance(company_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(weight_oz), 0)
  FROM gold_inventory
  WHERE mining_company_id = company_id
    AND status = 'available';
$$ LANGUAGE sql;
```

**Balance Breakdown**:
- **Total Inventory**: All inventory entries (all statuses)
- **Available Oz**: Status = 'available' only
- **Allocated Oz**: Status = 'allocated' (reserved for pending sales)
- **Sold Oz**: Status = 'sold' (completed sales)

**Available Balance Display**:
```
Mining Company: Kobada Gold Mine (KGM)

Total Inventory: 1,250.75 oz
├─ Available:    850.50 oz  (68%)
├─ Allocated:    180.25 oz  (14%)
└─ Sold:         220.00 oz  (18%)
```

**7.4 Inventory Transactions & History**

**Transaction Types**:

1. **Entry**: Gold added to inventory (from refining)
   - Increases available balance
   - Source: Refining process

2. **Allocation**: Gold reserved for sale
   - Decreases available, increases allocated
   - Linked to specific sale record

3. **Deallocation**: Sale cancelled, gold returned to available
   - Decreases allocated, increases available
   - Reason recorded (sale cancelled, customer rejected, etc.)

4. **Exit**: Sale completed, gold removed from inventory
   - Decreases allocated or available
   - Increases sold
   - Linked to payment record

5. **Adjustment**: Manual inventory adjustment (rare)
   - Management approval required
   - Reason required (audit correction, physical count variance)
   - Can increase or decrease balance

**Transaction Record**:
```json
{
  "transaction_id": "uuid",
  "inventory_id": "uuid",
  "transaction_type": "allocation",
  "transaction_date": "2025-01-15T10:30:00Z",
  "quantity_oz": 180.25,
  "balance_before_oz": 1030.75,
  "balance_after_oz": 850.50,
  "related_sale_id": "uuid",
  "user_id": "uuid",
  "user_name": "John Doe",
  "notes": "Allocated for sale to ABC Refining Ltd."
}
```

**Complete Audit Trail**:
- Every balance change logged
- User who made change
- Timestamp
- Before/after balance
- Reason/notes

**7.5 Silver Inventory Tracking**

**Separate Silver Inventory Module**
Silver is tracked separately from gold due to different:
- Pricing mechanisms
- Sales channels
- Storage requirements
- Regulatory treatment

**Silver Inventory Features**:
- Entry from production (silver content recorded in daily production)
- Separate available balance calculation
- Silver-specific sales (if applicable)
- Silver pricing (spot price, forward contracts)

**Silver Inventory Fields**:
- Entry ID
- Source production batch
- Mining company
- Entry date
- Weight grams (silver only)
- Purity percentage
- Status (available, allocated, sold)
- Current balance grams

**7.6 Monthly Inventory Summary**

**End-of-Month Report**:
- Opening balance (start of month)
- Total entries (from refining)
- Total allocations (for sales)
- Total exits (sales completed)
- Adjustments (if any)
- Closing balance (end of month)

**Example Monthly Summary**:
```
Gold Inventory Summary - January 2025
Kobada Gold Mine (KGM)

Opening Balance (Jan 1):      850.50 oz
+ Entries (Refining):          +425.75 oz
- Allocations (Sales Created): -180.25 oz
- Exits (Sales Completed):     -220.00 oz
+ Adjustments:                 +0.00 oz
─────────────────────────────────────────
Closing Balance (Jan 31):     876.00 oz

Status Breakdown:
  Available:  650.00 oz (74%)
  Allocated:  226.00 oz (26%)
  Sold:       0.00 oz (completed sales removed)
```

**7.7 Inventory Valuation**

**Valuation Methods**:

1. **Current Market Value**: Based on today's LBMA price
   ```
   Current Value = Available Oz × LBMA AM Price
   Example: 850.50 oz × $2,050/oz = $1,743,525
   ```

2. **Historical Cost**: Based on refining cost
   - Original shipment value
   - Refining fees
   - Transportation costs
   - Insurance costs

3. **Average Cost**: Average of all inventory entries
   ```
   Average Cost per Oz = Total Cost / Total Oz
   ```

**Valuation Report**:
```
Inventory Valuation - February 15, 2025

Available Inventory: 850.50 oz

Market Valuation:
  LBMA AM Price: $2,050.00/oz
  Total Value:   $1,743,525.00

Historical Cost:
  Average Cost:  $1,875.00/oz
  Total Cost:    $1,594,687.50

Unrealized Gain:
  Gain per Oz:   $175.00
  Total Gain:    $148,837.50 (9.4%)
```

**7.8 Low Stock Alerts**

**Automatic Threshold Monitoring**:
- Set minimum stock levels per mining company
- Alert when available balance falls below threshold
- Color-coded warnings:
  - 🟢 Green: >30 days of average sales
  - 🟡 Yellow: 15-30 days of average sales
  - 🔴 Red: <15 days of average sales

**Alert Notifications**:
- Email to management
- Dashboard alert
- Suggested action: Expedite new production shipment

**Example Alert**:
```
⚠️ LOW INVENTORY ALERT

Mining Company: Kobada Gold Mine (KGM)
Current Available: 85.50 oz
Average Monthly Sales: 400 oz
Days of Inventory: 6 days

ACTION REQUIRED: Expedite freight shipment or reduce sales commitments
```

#### User Roles & Permissions

| Role | View | Create Entry | Allocate | Deallocate | Adjust | View Transactions |
|------|------|--------------|----------|------------|--------|-------------------|
| **Management** | All | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Sales** | All | ✗ | Auto (via sale) | ✗ | ✗ | ✓ |
| **Refinery** | Related | Auto (refining) | ✗ | ✗ | ✗ | ✓ |
| **Factory** | Own company | ✗ | ✗ | ✗ | ✗ | ✓ |

#### Business Rules

1. **No Negative Balance**: Cannot allocate or sell more than available
2. **Allocation Required**: Must allocate inventory before creating sale
3. **Deallocation on Sale Cancel**: Automatically return to available if sale cancelled
4. **Exit on Payment**: Automatically mark as sold when payment received
5. **Adjustment Approval**: All manual adjustments require management approval with reason
6. **Mining Company Isolation**: Can only allocate inventory for same mining company's sales
7. **FIFO Assumption**: First-in, first-out for inventory exits (oldest inventory sold first)
8. **Transaction Immutability**: Cannot delete transaction records (audit trail)

#### Integration Points

**Upstream**:
- Auto-creates from Refining Module
- Receives refining completion data

**Downstream**:
- Feeds Sales Module with available balance
- Updates on sale creation (allocation)
- Updates on payment (exit)
- Feeds Analytics for inventory metrics

---

*Continued in next section with Sales Module, Payment Processing, Customer Management, Analytics, User Management, and more...*
