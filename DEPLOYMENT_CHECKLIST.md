# Deployment Checklist - Gold Shipper

## Pre-Deployment

### 1. Environment Configuration
- [ ] Set up production Supabase project
- [ ] Configure environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- [ ] Verify Supabase project settings
- [ ] Configure custom domain (if applicable)

### 2. Database Setup
- [ ] Apply all migrations in order:
  ```bash
  # Migrations are in supabase/migrations/
  20251101120000_create_reports_system.sql
  20251101130000_create_storage_buckets.sql
  20251102140000_clean_sales_status_transitions.sql
  20251102140001_insert_new_sales_status_transitions.sql
  20251102140002_update_sales_table_schema.sql
  20251102140003_update_payments_table_schema.sql
  20251102140004_ensure_fx_rate_analysis_table.sql
  20251102140005_create_virtual_payment_triggers.sql
  20251102140006_create_status_transition_triggers.sql
  20251102140007_add_reception_tracking_columns.sql
  20251102150000_fix_management_approved_transition.sql
  20251102160000_create_customer_banks_table.sql
  20251103000000_add_physical_payment_trigger.sql
  20251103000000_create_presales_module.sql
  ```
- [ ] Verify all tables created successfully
- [ ] Verify all RLS policies applied
- [ ] Test database triggers and functions

### 3. Storage Configuration
- [ ] Create storage buckets:
  - `documents`
  - `payment-proofs`
  - `batch-documents`
- [ ] Configure storage policies
- [ ] Test file upload/download
- [ ] Set up storage size limits

### 4. Authentication Setup
- [ ] Configure email templates
- [ ] Set up 2FA settings
- [ ] Configure password policies
- [ ] Set session timeout
- [ ] Configure allowed domains (if needed)

### 5. Build Verification
- [ ] Run `npm install` to ensure dependencies
- [ ] Run `npm run build` to create production build
- [ ] Verify build completes successfully
- [ ] Check dist/ directory has all assets
- [ ] Test built application locally with `npm run preview`

## Deployment

### 1. Choose Deployment Platform
Choose one of the following platforms:

#### Option A: Netlify
- [ ] Create new site from Git
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Publish directory: `dist`
- [ ] Add environment variables
- [ ] Deploy site
- [ ] Configure custom domain (if applicable)

#### Option B: Vercel
- [ ] Import project from Git
- [ ] Configure build settings:
  - Framework: Vite
  - Build command: `npm run build`
  - Output directory: `dist`
- [ ] Add environment variables
- [ ] Deploy project
- [ ] Configure custom domain (if applicable)

#### Option C: AWS Amplify
- [ ] Create new app from Git
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Output directory: `dist`
- [ ] Add environment variables
- [ ] Deploy app
- [ ] Configure custom domain (if applicable)

### 2. Configure Hosting
- [ ] Set up custom domain
- [ ] Configure SSL certificate
- [ ] Set up CDN (if not included)
- [ ] Configure redirects for SPA routing
- [ ] Set up CORS if needed

### 3. Deploy Application
- [ ] Push code to production branch
- [ ] Monitor deployment process
- [ ] Verify deployment successful
- [ ] Check deployment logs for errors

## Post-Deployment

### 1. Verification
- [ ] Access deployed application URL
- [ ] Test login functionality
- [ ] Test 2FA setup
- [ ] Verify all pages load correctly
- [ ] Test mobile responsiveness
- [ ] Verify PWA installation works
- [ ] Test offline functionality
- [ ] Verify all API calls work
- [ ] Test file uploads
- [ ] Check real-time updates

### 2. Functionality Testing
- [ ] Create a test batch
- [ ] Test receiving workflow
- [ ] Test refining workflow
- [ ] Create a test sale
- [ ] Test payment processing
- [ ] Create a test pre-sale
- [ ] Test customer approval flow
- [ ] Verify calculations are correct
- [ ] Test report generation
- [ ] Verify email notifications

### 3. Security Verification
- [ ] Test RLS policies work correctly
- [ ] Verify role-based access control
- [ ] Test 2FA authentication
- [ ] Verify session management
- [ ] Check audit trail logging
- [ ] Test permission restrictions
- [ ] Verify data isolation between sites

### 4. Performance Check
- [ ] Run Lighthouse audit
- [ ] Check page load times
- [ ] Verify bundle sizes
- [ ] Test on slow connections
- [ ] Monitor database query performance
- [ ] Check real-time update latency

### 5. User Setup
- [ ] Create initial admin user
- [ ] Set up user roles
- [ ] Configure permissions
- [ ] Create test users for each role
- [ ] Verify user access levels
- [ ] Set up mining companies
- [ ] Configure transport companies
- [ ] Set up refinery plants

### 6. Monitoring Setup
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure application monitoring
- [ ] Set up uptime monitoring
- [ ] Configure alerts for errors
- [ ] Set up database monitoring
- [ ] Configure performance monitoring
- [ ] Set up log aggregation

### 7. Backup Configuration
- [ ] Configure automated database backups
- [ ] Test backup restoration
- [ ] Set up backup retention policy
- [ ] Document backup procedures
- [ ] Configure disaster recovery plan

## Documentation

### 1. User Documentation
- [ ] Create user manual
- [ ] Document workflows
- [ ] Create video tutorials (if needed)
- [ ] Prepare training materials
- [ ] Update help center content

### 2. Technical Documentation
- [ ] Document deployment process
- [ ] Create troubleshooting guide
- [ ] Document API endpoints
- [ ] Create maintenance procedures
- [ ] Document backup/recovery process

### 3. Training
- [ ] Schedule user training sessions
- [ ] Prepare training environment
- [ ] Create training data
- [ ] Conduct admin training
- [ ] Conduct end-user training

## Maintenance

### Daily
- [ ] Monitor application health
- [ ] Check error logs
- [ ] Review database performance
- [ ] Monitor user activity

### Weekly
- [ ] Review audit trail
- [ ] Check storage usage
- [ ] Review performance metrics
- [ ] Update documentation as needed

### Monthly
- [ ] Review security policies
- [ ] Update dependencies
- [ ] Review user feedback
- [ ] Plan improvements
- [ ] Backup verification test

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| System Admin | TBD | TBD |
| Database Admin | TBD | TBD |
| Support Lead | TBD | TBD |
| Developer | TBD | TBD |

## Rollback Procedure

### If Issues Occur:
1. Identify the issue severity
2. Check deployment logs
3. Review error tracking
4. If critical:
   - Revert to previous deployment
   - Restore database backup if needed
   - Notify users of downtime
5. Debug issue in staging
6. Redeploy with fixes

## Success Criteria

- [ ] All core features working
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] Users can log in and perform tasks
- [ ] Data is being saved correctly
- [ ] Real-time updates functioning
- [ ] Email notifications working
- [ ] Audit trail recording actions
- [ ] Reports generating correctly
- [ ] Mobile experience acceptable

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Version:** 1.0.0
**Status:** _____________
