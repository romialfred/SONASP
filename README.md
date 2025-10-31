# GoldShipper

A comprehensive web platform for Mansa Resources to digitize and track gold and silver shipments and sales across West African operations.

## Quick Start

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Configuration

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
/
├── src/                    # Application source code
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── services/          # Business logic and API calls
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── supabase/
│   ├── functions/         # Edge Functions
│   ├── migrations/        # Active database migrations (new migrations go here)
│   └── OLD_MIGRATIONS/    # Archived migrations and docs (335 files)
├── public/                # Static assets
├── scripts/               # Build and deployment scripts
└── docs/                  # Active documentation

```

## Quality Checks

```bash
# Run all checks
npm run lint          # ESLint with type-aware rules
npm run typecheck     # TypeScript type checking
npm run test          # Run tests with Vitest

# Build for production
npm run build
```

## Database Setup

### Initial Setup Required

Before using the application, you need to set up two things in Supabase:

#### 1. Create Storage Bucket for Documents

Execute this SQL in Supabase SQL Editor:

```bash
# See: supabase/OLD_MIGRATIONS/docs/CREATE_DOCUMENTS_BUCKET.sql
```

This creates the "documents" bucket needed for batch document uploads.

#### 2. Create Customer Records

Execute this SQL in Supabase SQL Editor:

```bash
# See: supabase/OLD_MIGRATIONS/docs/APPLY_CUSTOMERS_MIGRATION.sql
```

This creates the required customers:
- Mansa Resources S.A. (internal)
- Auramet Trading LLC (external)
- StoneX Financial Inc. (external)

### Migration History

All historical migrations (128 files) have been archived in `/supabase/OLD_MIGRATIONS/migrations/`.

The `/supabase/migrations/` directory is now empty and ready for new migrations.

## Key Features

- Batch management and tracking
- Real-time gold price monitoring
- Sales workflow with approval processes
- Customer management with business rules
- FX rate tracking and analysis
- Document upload and management
- Role-based access control
- Multi-language support (English/French)

## Troubleshooting

### Common Issues

#### Batch Creation Fails with Storage Error
**Problem**: "Storage bucket could not be created"

**Solution**: Execute `CREATE_DOCUMENTS_BUCKET.sql` in Supabase SQL Editor

**Details**: See `supabase/OLD_MIGRATIONS/docs/BATCH_CREATION_TROUBLESHOOTING.md`

#### Sales Form Shows Limited Customers
**Problem**: Only seeing "Select customer..." option

**Solution**: Execute `APPLY_CUSTOMERS_MIGRATION.sql` in Supabase SQL Editor

**Details**: Customers Mansa, Auramet, and StoneX must exist in the database

#### Protected Routes Redirect Unexpectedly
**Problem**: Getting redirected to login when authenticated

**Solution**:
1. Verify Supabase session is active
2. Check `.env` file has correct credentials
3. Clear browser cache and local storage

#### Sales or Admin Pages Show Errors
**Problem**: Pages crash or show fallback messages

**Solution**:
1. Open browser console for detailed errors
2. Check Supabase logs in dashboard
3. Verify user has correct role/permissions
4. See `docs/analysis.md` for detailed troubleshooting

## Documentation

### Active Documentation
- `README.md` - This file (getting started)
- `docs/analysis.md` - Architecture overview and runbook
- `docs/CHANGELOG.md` - Change history

### Archived Documentation (335 files)
All historical documentation, migrations, and helper scripts are archived in:
```
/supabase/OLD_MIGRATIONS/
```

See `/supabase/OLD_MIGRATIONS/README.md` for archive contents and organization.

## Business Rules

### Sales Workflow
1. **Mining Company** → sells to → **Mansa Resources** ONLY
2. **Mansa Resources** → sells to → **Auramet** or **StoneX** ONLY

### Batch Status Flow
```
Created → Approved → Shipped →
Airport Received → Airport Validated →
Refinery Received → Processing → Processed →
Available for Sale
```

## Technology Stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Charts**: Recharts
- **Icons**: Lucide React
- **i18n**: i18next

## Build and Deploy

```bash
# Production build
npm run build

# Preview production build
npm run preview

# Deploy (with cleanup)
npm run deploy:full
```

Build output will be in the `dist/` directory.

## Support and Contributing

For questions or issues:
1. Check troubleshooting section above
2. Review archived documentation in `/supabase/OLD_MIGRATIONS/`
3. Check Supabase dashboard for database/API issues
4. Review browser console for frontend errors

## Project Status

- ✅ Core functionality complete
- ✅ Database schema implemented
- ✅ Authentication and authorization working
- ✅ Business rules enforced
- ✅ Clean project structure
- ✅ Production ready

Last major cleanup: October 31, 2025
