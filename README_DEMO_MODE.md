# Mansa Resources Gold Sales Management Solution - Demo Mode

## Overview

This application includes a comprehensive demo mode with sample data for all pages. The demo data is designed to showcase the full functionality of the system without requiring a live database connection.

## Demo Mode Configuration

Demo mode is controlled by the `DEMO_MODE` constant in `/src/lib/demoSeed.ts`:

```typescript
export const DEMO_MODE = true;
```

### Switching to Live Data

To switch from demo data to live Supabase data:

1. Open `/src/lib/demoSeed.ts`
2. Change `DEMO_MODE` from `true` to `false`
3. Update each page component to fetch from Supabase instead of using demo arrays

Example transformation:

```typescript
// Demo mode
import { demoBatches } from '@/lib/demoSeed';
const batches = demoBatches;

// Live mode
import { supabase } from '@/lib/supabase';
const { data: batches } = await supabase.from('batches').select('*');
```

## Demo Data Included

### 1. Batches (`demoBatches`)
- 5 sample batches
- Various suppliers from Guinea, Côte d'Ivoire, and Mali
- Different statuses: Received, In Process, Shipped, Refined
- Realistic weight and purity data

### 2. Shipments (`demoShipments`)
- 5 sample shipments
- Multiple carriers: Securitas Transport, Brinks International, DHL Secure
- Various origins and destinations
- Statuses: Pending, In Transit, Delivered

### 3. Refining Records (`demoRefining`)
- 5 sample refining processes
- Multiple refineries: Dubai, Swiss, London
- Includes fine weight, assay percentage, and yield calculations
- Statuses: Queued, Processing, Completed

### 4. Customers (`demoCustomers`)
- 10 sample customers
- 4 segments: Jeweler, Trader, Bank, Industrial
- Global distribution across UAE, Switzerland, UK, India, China, etc.
- Complete contact information

### 5. Sales (`demoSales`)
- 10 sample sales transactions
- Multiple currencies: USD, EUR, AED, CHF, GBP, INR, HKD, CNY, SGD, ZAR
- Automatic calculations:
  - `amount_usd = fine_weight_oz * price_per_oz_usd`
  - `amount_fx = amount_usd / fx_rate_to_usd`
- Realistic pricing around $2,650/oz

### 6. Gold Prices (`demoGoldPrices`)
- 14 days of historical data
- Trending upward with realistic daily fluctuations
- Price range: $2,620-$2,670 per troy ounce

### 7. FX Rates (`demoFxRates`)
- 4 currencies: EUR, XOF, GHS, GNF
- 14 days of historical data per currency
- Realistic daily fluctuations (±1%)

### 8. Users (`demoUsers`)
- 4 sample users
- 3 roles: admin, analyst, viewer
- 2 statuses: active, disabled
- Complete user profiles

## New Features Implemented

### Sidebar Redesign

**Accordion Navigation:**
- Two top-level groups: "Batches Management" and "Sales Management"
- Only one group can be open at a time
- Active route automatically opens its parent group
- Persists last opened group in `localStorage` (key: `sidebar:lastGroup`)

**Color Scheme:**
- Sidebar background: `bg-slate-900`
- Group headers: `text-slate-200` (idle), `bg-slate-800 text-white` (active)
- Sub-items: `text-slate-300` (idle), `bg-amber-500/20 text-amber-300 border-l-4 border-amber-400` (active)
- Icons: `text-slate-400` (idle), `text-amber-300` (active)

**Keyboard Accessible:**
- Enter/Space toggles accordion groups
- Tab cycles through navigation items
- Focus indicators with amber rings

### Session Persistence Fix

The Supabase client is configured with:

```typescript
{
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'gold-shipper-auth',
    flowType: 'pkce',
  }
}
```

This ensures:
- Users stay logged in across page refreshes
- Automatic token refresh before expiration
- No unexpected logouts during navigation

### Full-Height Layout

All pages use:
```typescript
<main className="flex-1 p-6 overflow-auto">
  <div className="min-h-[calc(100vh-64px)]">
    {children}
  </div>
</main>
```

This ensures:
- Content fills the viewport minus the 64px header
- No letterboxing or unused whitespace
- Internal scrolling for tables and long content
- Responsive down to 1024px width

## Page Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/batches` | `BatchesPage` | View and search gold batches |
| `/shipping` | `ShippingPage` | Track shipments and logistics |
| `/refining` | `RefiningPage` | Monitor refining processes |
| `/customers` | `CustomersPage` | Manage customer relationships |
| `/sales` | `SalesPage` | Track sales and revenue |
| `/gold-prices` | `GoldPricesPage` | View gold price trends with chart |
| `/fx-rates` | `FxRatesPage` | Monitor FX rates with chart |
| `/users` | `UsersPage` | User management (admin) |

## Technical Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router DOM v7
- **Charts:** Recharts
- **Icons:** Lucide React
- **Backend:** Supabase (Auth + PostgreSQL)
- **i18n:** i18next (English/French)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Responsive Breakpoints

- Desktop: ≥ 1280px (optimal)
- Laptop: 1024px-1280px (fully supported)
- Tablet: < 1024px (limited support)

## Navigation Structure

### Batches Management Group
1. Batches - Main batch inventory page
2. Shipping - Shipment tracking
3. Refining - Refining process monitoring

### Sales Management Group
1. Customers - Customer relationship management
2. Sales - Sales transactions and revenue
3. Gold Price - Price trends and history
4. FX Rates - Exchange rate monitoring

### Standalone
- Users Management - User accounts and permissions (footer of sidebar)

## Demo Data Relationships

- **Shipments** reference **Batches** via `batch_id`
- **Refining** references **Batches** via `batch_id`
- **Sales** reference **Customers** via `customer_id`
- **Sales** reference **FX Rates** via `fx_code`

Helper functions in `demoSeed.ts`:
- `getCustomerById(id)` - Get customer details
- `getBatchById(id)` - Get batch details
- `getShipmentsByBatchId(batchId)` - Get all shipments for a batch
- `getRefiningByBatchId(batchId)` - Get refining record for a batch

## Future Enhancements

To convert pages to live data:

1. Create corresponding Supabase tables matching the TypeScript interfaces
2. Add appropriate RLS policies for security
3. Replace demo data imports with Supabase queries
4. Add loading states and error handling
5. Implement pagination for large datasets
6. Add real-time subscriptions for live updates

## Architecture Notes

- All pages follow a consistent layout pattern
- Demo data is centralized in one file for easy management
- Component structure supports easy swap to live data
- Full TypeScript typing for all data structures
- Accessible keyboard navigation throughout

## Support

For questions about demo mode or switching to live data, refer to the inline comments in `/src/lib/demoSeed.ts` and individual page components.
