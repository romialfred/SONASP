/*
  # Update All Stakeholders Status to Active

  1. Updates
    - Set is_active = true for all mining_companies
    - Set is_active = true for all transport_companies
    - Set is_active = true for all refineries
    - Set status = 'active' for all customers

  2. Purpose
    - Ensure all existing stakeholders are active by default
    - Prepare for edit functionality with proper status management
*/

-- Update mining companies to active
UPDATE mining_companies
SET is_active = true
WHERE is_active IS NULL OR is_active = false;

-- Update transport companies (freight) to active
UPDATE transport_companies
SET is_active = true
WHERE is_active IS NULL OR is_active = false;

-- Update refineries to active
UPDATE refineries
SET is_active = true
WHERE is_active IS NULL OR is_active = false;

-- Update customers to active status
UPDATE customers
SET status = 'active'
WHERE status IS NULL OR status != 'active';

-- Add comment for documentation
COMMENT ON COLUMN mining_companies.is_active IS 'Active status - only active companies shown in dropdowns';
COMMENT ON COLUMN transport_companies.is_active IS 'Active status - only active companies shown in dropdowns';
COMMENT ON COLUMN refineries.is_active IS 'Active status - only active refineries shown in dropdowns';
COMMENT ON COLUMN customers.status IS 'Customer status - only active customers shown in dropdowns (active/inactive/pending)';
