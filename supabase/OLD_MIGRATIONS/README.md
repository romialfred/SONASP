# OLD_MIGRATIONS - Archived Documentation and Migrations

This directory contains all the historical migration files and documentation that were used during development and testing phases. These files have been archived to keep the root directory clean and organized.

## Directory Structure

```
OLD_MIGRATIONS/
├── README.md (this file)
├── migrations/         # All historical SQL migration files (128 files)
└── docs/              # All documentation and helper files (206 files)
```

## Contents

### `/migrations` Directory
Contains 128 SQL migration files from the initial database setup through all iterations:
- Initial schema creation (batch management, sales, customers)
- Auth and roles schema
- Enhanced functions and views
- Security and performance fixes
- Seed data migrations
- Gold prices and FX rates setup
- Stakeholder management schema
- Workflow transitions
- Status normalization
- And many more incremental changes

**Note:** These migrations have already been applied to the database during development.

### `/docs` Directory
Contains 206 documentation files including:
- **Markdown files (.md)**: Implementation guides, fix summaries, analysis documents
- **SQL scripts (.sql)**: Database queries, cleanup scripts, verification scripts
- **Text files (.txt)**: Quick guides, summaries, checklists
- **Shell scripts (.sh)**: Automation scripts
- **HTML files (.html)**: Admin tools and demos
- **JavaScript files (.cjs)**: Seed data scripts, test utilities

## Why Were These Files Archived?

1. **Clean Root Directory**: The project root was cluttered with 205+ files
2. **Better Organization**: Separating active code from historical documentation
3. **Easier Navigation**: Developers can focus on current code without distractions
4. **Preserve History**: All work is retained for reference and audit purposes
5. **Professional Structure**: Standard practice for mature projects

## When to Use These Files

### Reference Purposes
- Understanding historical decisions
- Reviewing how issues were resolved
- Learning from past implementation approaches
- Auditing database changes

### Development Needs
- Looking up specific migration details
- Finding examples of similar implementations
- Understanding the evolution of the schema
- Troubleshooting legacy issues

### Migration Recovery
- If you need to rebuild the database from scratch
- To understand the complete migration history
- To verify applied changes
- To create new migrations based on old patterns

## Important Notes

### ⚠️ Do Not Delete
These files represent the complete history of the project's database evolution. While they're archived, they should be preserved for:
- Audit trails
- Historical reference
- Compliance requirements
- Future database rebuilds

### ⚠️ Do Not Modify
These files are historical records. Any modifications needed should be done through new migrations in the active `supabase/migrations/` directory.

### ⚠️ Not for Active Use
The migrations in this directory have already been applied. New database changes should be made through new migration files in the main migrations directory.

## Current Active Directories

For active development, use:
- **Migrations**: `/supabase/migrations/` (currently empty, ready for new migrations)
- **Functions**: `/supabase/functions/` (for Edge Functions)
- **Documentation**: Project root has only essential files (README.md, package.json, etc.)

## File Categories in `/docs`

### Implementation Guides
- `BATCH_CREATION_TROUBLESHOOTING.md`
- `COMPLETE_BATCH_WORKFLOW_FIXED.md`
- `SALES_WORKFLOW_IMPROVEMENTS.md`
- And many more...

### Fix Summaries
- `ALERTBOX_PROP_FIX.md`
- `BATCH_STATUS_WORKFLOW_FIX.md`
- `CUSTOMER_PROFILE_FIX.md`
- Dozens of other fix documentation

### Database Scripts
- `CLEAN_DATABASE.sql`
- `CREATE_STORAGE_BUCKET.sql`
- `VERIFY_BATCH_STATUSES.sql`
- Many verification and cleanup scripts

### Seed Data
- `seed-data.cjs`
- `seed-authenticated.cjs`
- `test-data-check.cjs`

### Quick References
- `QUICK_START_GUIDE.md`
- `START_HERE.md`
- `VERIFICATION_CHECKLIST.md`

## Migration Naming Convention

Historical migrations follow the pattern:
```
YYYYMMDD[HHMMSS]_descriptive_name.sql

Examples:
20251024195330_create_batch_management_tables.sql
20251031000000_fix_sales_approval_workflow.sql
```

## Archive Date

This archive was created on: **October 31, 2025**

All files dated before this represent historical work completed during the initial development phases.

## Questions or Need Access?

If you need to reference specific files or understand historical implementations:
1. Check this README for general organization
2. Browse the `/migrations` directory for database schema evolution
3. Search the `/docs` directory for specific topics
4. Consult the main project README.md for current documentation

## Statistics

- **Total Migration Files**: 128
- **Total Documentation Files**: 206
- **Combined Archive Size**: ~5-10 MB
- **Date Range**: October 24 - October 31, 2025
- **Purpose**: Development, Testing, Refinement

---

**Note**: This archive preserves the complete development history while keeping the active project structure clean and professional.
