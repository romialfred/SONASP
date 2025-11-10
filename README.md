# Gold Shipper - Precious Metals Supply Chain Management

A comprehensive web platform for tracking gold and silver shipments across West African operations.

## Project Structure

```
project/
├── src/                      # React application source
│   ├── components/          # Reusable UI components
│   ├── pages/               # Application pages
│   ├── services/            # API and business logic
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript definitions
│   └── lib/                 # Utilities and helpers
├── supabase/
│   ├── migrations/          # Database migrations (22 files)
│   └── functions/           # Supabase Edge Functions
├── public/                  # Static assets
├── docs/                    # Project documentation
└── dist/                    # Production build

```

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Charts:** Recharts
- **Icons:** Lucide React
- **i18n:** i18next (French/English)

## Quick Start

### Development
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Testing
```bash
npm run test
npm run test:coverage
```

## Database

The application uses Supabase with:
- 22 production-ready migrations
- Row Level Security (RLS) policies
- Security definer functions for permissions
- Edge functions for server-side operations

### Current Migrations
All migrations are in `supabase/migrations/` with timestamps from 2025-11-01 onwards.

## Features Implemented

### Core Modules
- ✅ User Management & Authentication (with 2FA)
- ✅ Batch Management & Tracking
- ✅ Shipping & Receiving Workflows
- ✅ Refining Management
- ✅ Sales Management
- ✅ Customer Management
- ✅ Payment Processing
- ✅ License Request System
- ✅ Analytics & Reporting
- ✅ Pre-Sales Module
- ✅ Assay Certificate Management
- ✅ Document Management

### Additional Features
- Real-time updates via Supabase Realtime
- Live gold price integration
- FX rate tracking and comparison
- Multi-language support (FR/EN)
- Role-based access control
- Complete audit trail
- Progressive Web App (PWA)

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Documentation

- **CHANGELOG.md** - Version history and changes
- **analysis.md** - Technical analysis and architecture notes

## License System

The application includes a comprehensive export license management system:
- License request creation and tracking
- Document upload and management
- Approval workflows
- Quota management
- Compliance tracking

## Recent Updates

- Cleaned up 214+ old migration files
- Removed 3.4MB of deprecated migrations
- Streamlined to 22 production migrations
- Added enhanced logging for debugging
- Fixed RLS policies for license requests

## Support

For issues or questions, check the console logs for detailed debugging information.
