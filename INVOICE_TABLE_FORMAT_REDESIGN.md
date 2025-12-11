# Invoice Preview Panel - Professional Table Format Redesign

## Overview

The invoice preview panel has been completely redesigned to match a professional, table-based format similar to standard commercial invoices. The new design features dynamic seller and customer information pulled directly from the database, comprehensive product details in a structured table, and professional gold accent colors.

## Key Changes

### 1. Complete Layout Restructure

**Previous Design:**
- Card-based layout with separate sections
- Vertical stacking of information
- Limited information display
- 480px wide panel

**New Professional Table Design:**
- Full-width table structure with borders
- Integrated header with seller and client side-by-side
- Comprehensive product details table
- 580px wide panel for better information display
- Matches standard invoice format from reference image

### 2. Dynamic Data Integration

#### Seller Information (Mining Company)
Now fetches and displays complete company details:
- Company name
- Full address (not just abbreviation)
- City
- Country
- Contact phone number
- Logo support (placeholder for future implementation)

**Database Fields Used:**
```typescript
{
  name: string
  abbreviation: string  // Used as address line
  city: string
  country: string
  contact_person_phone: string
}
```

#### Customer Information
Now fetches and displays complete customer details:
- Customer name
- Full address
- City
- Country
- Contact phone number
- Logo support (placeholder for future implementation)

**Database Fields Used:**
```typescript
{
  name: string
  address: string
  city: string
  country: string
  phone: string
}
```

### 3. Professional Table Structure

The invoice now features a comprehensive product details table matching the reference image:

#### Table Headers (Gold Background #D4AF37):
- **Lot #**: Auto-generated lot number
- **Description**: Product description (Fine Gold Au)
- **Metal**: Metal symbol (Au)
- **Unit Price $/Oz**: Price per troy ounce
- **Net Weight (kg)**: Weight in kilograms
- **Weight (Troy Oz)**: Weight in troy ounces
- **Metal Price (USD/kg)**: Price per kilogram
- **Estimated Value (USD)**: Total value

#### Product Row:
- Displays all calculated values
- Proper number formatting with locale support
- Right-aligned numbers for better readability
- Black borders (2px solid) throughout

#### Royalties Section:
- Shows royalty percentage (3%)
- Calculates and displays royalty amount
- Deducted from gross proceeds

#### Totals Section (Gold Rows #D4AF37):
- **Total prix CFA** (if applicable) or local currency
- **Total prix US$**: USD total
- **Net Proceed**: Final amount after royalties

### 4. New Interface Properties

Extended `InvoicePreviewData` interface with additional fields:

```typescript
export interface InvoicePreviewData {
  // Enhanced Seller Information
  sellerName: string;
  sellerAddress?: string;
  sellerCity?: string;  // NEW
  sellerCountry: string;
  sellerPhone?: string;  // NEW
  sellerLogo?: string;   // NEW

  // Enhanced Customer Information
  customerName: string;
  customerAddress?: string;
  customerCity?: string;      // NEW
  customerCountry?: string;
  customerPhone?: string;     // NEW
  customerLogo?: string;      // NEW

  // Invoice Details
  invoiceNumber?: string;     // NEW
  invoiceDate: string;        // NEW
  lotNumber?: string;         // NEW

  // Enhanced Sale Details
  quantityOz: number;
  quantityGrams: number;
  quantityKg: number;         // NEW - Weight in kilograms
  pricePerOz: number;
  pricePerKg: number;         // NEW - Price per kilogram
  currency: string;

  // Pricing Details
  grossProceeds: number;
  freightCost: number;
  otherCosts: number;
  netProceeds: number;
  royaltiesPercentage: number;
  royaltiesAmount: number;
  finalAmount: number;
  estimatedValue: number;     // NEW

  // Exchange Rate Information
  exchangeRate?: number;      // NEW
  localCurrency?: string;     // NEW
  localCurrencyTotal?: number; // NEW
  usdTotal?: number;          // NEW

  // Additional Info
  mechanismType?: string;
  mechanismDisplayName?: string;
  valueDate?: string;
  settlementDays?: number;
  paymentMethod?: string;     // NEW
}
```

### 5. Calculation Enhancements

New automatic calculations in `SaleCreate.tsx`:

```typescript
// Weight conversions
const quantityOz = parseFloat(formData.quantityOz);
const quantityGrams = quantityOz * 31.1035;
const quantityKg = quantityGrams / 1000;

// Price conversions
const pricePerOz = parseFloat(formData.londonAMRate);
const pricePerKg = pricePerOz * (1000 / 31.1035);  // Convert $/oz to $/kg
```

### 6. Section-by-Section Layout

#### Header Section
```
┌─────────────────────────────────────────────────────┐
│  Seller                    │  Client                │
│  Company Name              │  Customer Name         │
│  Address                   │  Address               │
│  City                      │  City                  │
│  Country                   │  Country               │
│  Tel: Phone                │  Tel: Phone            │
├─────────────────────────────────────────────────────┤
│  [Seller Logo]            │  [Customer Logo]       │
└─────────────────────────────────────────────────────┘
```

#### Invoice Details
```
┌─────────────────────────────────────────────────────┐
│  Facture N° : INV-2025-0056    Invoice Date Dec 11  │
└─────────────────────────────────────────────────────┘
```

#### Product Table (Gold Headers)
```
┌───┬──────────┬────┬──────┬──────┬──────┬────────┐
│Lot│Description│Metal│$/Oz│kg│Oz│USD/kg│Value  │
├───┼──────────┼────┼──────┼──────┼──────┼────────┤
│380│Fine Gold │ Au │40,200│22.871│684.69│68,713k│1,571k│
├───┴──────────┴────┴──────┴──────┴──────┴────────┤
│ Royalties                        3%    │ 47,146 │
├──────────────────────────────────────────────────┤
│ Total prix CFA                          │1,571k  │
├──────────────────────────────────────────────────┤
│ Total prix US$                          │2,801k  │
├──────────────────────────────────────────────────┤
│ Net Proceed                             │1,524k  │
└──────────────────────────────────────────────────┘
```

#### Footer Section
```
┌─────────────────────────────────────────────────────┐
│  Finalize the present invoice for the amount of...  │
├───────────────────────┬─────────────────────────────┤
│ Conversion Info       │  Payment Terms Table        │
│ 1 troy oz = 31.1035 g │ ┌─────────────────────┐    │
│ 1 kg = 32.1507 troy oz│ │Method│Spot Basis    │    │
│ Exchange Rate: 561    │ │Value Date│Dec 13    │    │
│                       │ │Settlement│2 days    │    │
│                       │ └─────────────────────┘    │
└───────────────────────┴─────────────────────────────┘
```

## Color Scheme

### Professional Gold Palette
- **Primary Gold**: `#D4AF37` - Used for table headers and total rows
- **Borders**: Black (`border-gray-900`) - 2px solid borders throughout
- **Background**: White for content areas
- **Text**: Black/Gray-900 for maximum readability
- **Accents**: Light gray (`bg-gray-100`) for secondary elements

### Usage Guidelines
- Gold backgrounds reserved for:
  - Table headers
  - Total amount rows
  - Important section headers
- Black borders for all table cells and sections
- White backgrounds for data cells
- No bright colors (removed blue, purple, green gradients)

## Responsive Design

### Panel Width
- **Previous**: 480px
- **New**: 580px
- Accommodates wider table structure
- Better information display

### Layout Adjustment
Updated `SaleCreate.tsx` to shift content when preview is visible:
```typescript
<div className={`transition-all duration-300 space-y-6 ${
  showInvoicePreview ? 'max-w-5xl mr-[600px] ml-auto' : 'max-w-5xl mx-auto'
}`}>
```

## Data Flow

### 1. Form Submission (SaleCreate.tsx)
```typescript
handleCalculate()
  → validateForm()
  → checkSaleAuthorization()
  → setShowCalculations(true)
  → updateInvoicePreviewData()  // Fetch full data
  → generateInvoicePreview()     // Generate PDF
```

### 2. Data Fetching (updateInvoicePreviewData)
```typescript
// Fetch complete seller information
const { data: miningCompanyData } = await supabase
  .from('mining_companies')
  .select('*')
  .eq('id', formData.miningCompanyId)
  .single();

// Fetch complete customer information
const { data: customerData } = await supabase
  .from('customers')
  .select('*')
  .eq('id', formData.customerId)
  .single();
```

### 3. Data Preparation
- Extract all relevant fields from database responses
- Calculate weight conversions (oz → g → kg)
- Calculate price conversions ($/oz → $/kg)
- Prepare complete `InvoicePreviewData` object
- Set preview visibility and trigger render

## Number Formatting

### Consistent Locale Formatting
All numbers use proper locale formatting for readability:

```typescript
// Prices with 2 decimals
pricePerOz.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

// Large amounts with no decimals
grossProceeds.toLocaleString('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

// Weights with appropriate precision
quantityKg.toFixed(3)  // kg with 3 decimals
quantityOz.toFixed(2)  // oz with 2 decimals
```

## Future Enhancements

### Logo Support
The interface includes placeholder support for company logos:
```typescript
sellerLogo?: string;   // URL to seller logo image
customerLogo?: string; // URL to customer logo image
```

**Implementation Plan:**
1. Add `logo_url` column to `mining_companies` table
2. Add `logo_url` column to `customers` table
3. Implement file upload in company/customer forms
4. Store logos in Supabase Storage
5. Fetch and display in invoice preview

### Multi-Currency Support
Interface includes fields for exchange rates:
```typescript
exchangeRate?: number;
localCurrency?: string;        // e.g., "CFA", "GNF"
localCurrencyTotal?: number;   // Total in local currency
usdTotal?: number;             // Total in USD
```

**Usage Example:**
```typescript
{
  exchangeRate: 561,
  localCurrency: 'CFA',
  localCurrencyTotal: 1571535023,
  usdTotal: 2801310
}
```

### Lot Number Management
Currently generates automatic lot numbers:
```typescript
lotNumber: `${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`
// Example: "2025/0056"
```

**Future Enhancement:**
- Implement database-backed lot number sequences
- Link to production batches
- Support custom lot number formats per mining company

## Testing Checklist

### Visual Testing
- [ ] Seller information displays correctly with all fields
- [ ] Customer information displays correctly with all fields
- [ ] Phone numbers format properly
- [ ] Table structure renders with proper borders
- [ ] Gold header colors display correctly (#D4AF37)
- [ ] All numbers format with proper locale settings
- [ ] Weights display in correct units (kg, oz)
- [ ] Prices display correctly ($/oz, $/kg)
- [ ] Totals section calculates accurately

### Data Integration Testing
- [ ] Mining company data fetches completely
- [ ] Customer data fetches completely
- [ ] Missing fields (phone, city) handle gracefully
- [ ] Calculations are accurate
- [ ] Weight conversions correct (oz ↔ g ↔ kg)
- [ ] Price conversions correct ($/oz ↔ $/kg)

### Responsive Testing
- [ ] Panel width (580px) displays properly
- [ ] Content shifts correctly when preview opens
- [ ] Table structure remains intact on scroll
- [ ] Sticky header works properly
- [ ] Footer note displays correctly

### Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## Files Modified

### 1. src/components/sales/InvoicePreviewPanel.tsx
- **Changes**: Complete redesign with table-based layout
- **Lines**: 300 (from ~240)
- **New Features**:
  - Professional table structure
  - Dynamic seller/customer information
  - Logo support placeholders
  - Enhanced number formatting
  - Payment terms table

### 2. src/pages/sales/SaleCreate.tsx
- **Changes**: Enhanced data fetching and preparation
- **Key Functions Modified**:
  - `updateInvoicePreviewData()` - Fetch complete company/customer data
  - Layout div - Adjusted width from 500px to 600px margin
- **New Calculations**:
  - `quantityKg` calculation
  - `pricePerKg` calculation
  - Complete address information fetching

## Summary

The invoice preview has been transformed from a simple card-based layout to a professional, table-structured invoice that matches standard commercial formats. All seller and customer information is now dynamically populated from the database, including names, addresses, cities, countries, and phone numbers. The new design features proper table structures with gold headers, black borders, and comprehensive product details including weights in multiple units and prices per kilogram.

The redesign provides a much more professional appearance suitable for actual business transactions, with support for future enhancements including company logos and multi-currency displays.
