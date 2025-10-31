/*
  # Create Sales Validation Business Rules

  1. Business Rules Enforced
    - Mining companies can ONLY sell to Mansa Ressources S.A
    - Mansa Ressources can ONLY sell to Auramet or StoneX
    - Mansa Ressources cannot sell to mining companies
    - Mining companies cannot sell directly to external customers

  2. Validation Function
    - Validates seller-customer relationship before insert/update
    - Returns detailed error messages
    - Enforces strict business logic

  3. Security
    - Runs with SECURITY DEFINER for RLS bypass
    - Comprehensive audit logging
*/

-- Create function to validate sales business rules
CREATE OR REPLACE FUNCTION validate_sales_business_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_name text;
  v_customer_name text;
  v_is_mansa_customer boolean;
  v_is_auramet_customer boolean;
  v_is_stonex_customer boolean;
  v_customer_is_mining boolean;
  v_error_message text;
BEGIN
  -- Skip validation if seller fields are not set yet (will be set later)
  IF NEW.seller_id IS NULL OR NEW.seller_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer name
  SELECT name INTO v_customer_name
  FROM customers
  WHERE id = NEW.customer_id;

  -- Check if customer is Mansa Ressources
  v_is_mansa_customer := (LOWER(v_customer_name) LIKE '%mansa%ressources%' OR LOWER(v_customer_name) LIKE '%mansa%resources%');

  -- Check if customer is Auramet
  v_is_auramet_customer := (LOWER(v_customer_name) LIKE '%auramet%');

  -- Check if customer is StoneX
  v_is_stonex_customer := (LOWER(v_customer_name) LIKE '%stonex%' OR LOWER(v_customer_name) LIKE '%stone%x%');

  -- Check if customer is a mining company
  SELECT EXISTS (
    SELECT 1 FROM mining_companies
    WHERE id = NEW.customer_id
  ) INTO v_customer_is_mining;

  -- RULE 1: If seller is a mining company
  IF NEW.seller_type = 'mining_company' THEN
    -- Get mining company name
    SELECT name INTO v_seller_name
    FROM mining_companies
    WHERE id = NEW.seller_id;

    -- Mining companies can ONLY sell to Mansa Ressources
    IF NOT v_is_mansa_customer THEN
      v_error_message := format(
        'BUSINESS RULE VIOLATION: Mining company "%s" can only sell to Mansa Ressources S.A. ' ||
        'Attempted to sell to: "%s". ' ||
        'Please create an internal sale to Mansa Ressources first.',
        v_seller_name, v_customer_name
      );
      RAISE EXCEPTION '%', v_error_message
        USING HINT = 'Mining companies must sell to Mansa Ressources, who then sells to external customers';
    END IF;

    -- Mark as internal sale
    NEW.is_internal_sale := true;

  -- RULE 2: If seller is Mansa Ressources
  ELSIF NEW.seller_type = 'mansa_ressources' THEN
    v_seller_name := 'Mansa Ressources S.A';

    -- Mansa CANNOT sell to mining companies
    IF v_customer_is_mining THEN
      v_error_message := format(
        'BUSINESS RULE VIOLATION: Mansa Ressources cannot sell to mining companies. ' ||
        'Attempted to sell to: "%s". ' ||
        'Mansa Ressources can only sell to external customers (Auramet, StoneX).',
        v_customer_name
      );
      RAISE EXCEPTION '%', v_error_message
        USING HINT = 'Mansa Ressources sells to external customers only (Auramet, StoneX)';
    END IF;

    -- Mansa can ONLY sell to Auramet or StoneX
    IF NOT (v_is_auramet_customer OR v_is_stonex_customer) THEN
      v_error_message := format(
        'BUSINESS RULE VIOLATION: Mansa Ressources can only sell to approved external customers: Auramet or StoneX. ' ||
        'Attempted to sell to: "%s". ' ||
        'This customer is not in the approved list.',
        v_customer_name
      );
      RAISE EXCEPTION '%', v_error_message
        USING HINT = 'Only Auramet and StoneX are approved external customers';
    END IF;

    -- Mark as external sale
    NEW.is_internal_sale := false;

  ELSE
    RAISE EXCEPTION 'Invalid seller_type: %. Must be mining_company or mansa_ressources', NEW.seller_type;
  END IF;

  -- Log validation success in audit trail
  INSERT INTO audit_logs (
    user_id,
    user_email,
    action,
    module,
    details,
    status,
    created_at
  )
  SELECT
    NEW.created_by,
    COALESCE(u.email, 'system'),
    'VALIDATE_SALES_RULES',
    'Sales',
    format(
      'Sales validation passed: %s selling to %s (Internal: %s)',
      v_seller_name, v_customer_name, NEW.is_internal_sale
    ),
    'success',
    now()
  FROM auth.users u
  WHERE u.id = NEW.created_by;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log validation failure
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      module,
      details,
      status,
      created_at
    )
    VALUES (
      NEW.created_by,
      'system',
      'VALIDATE_SALES_RULES_FAILED',
      'Sales',
      format('Sales validation failed: %s', SQLERRM),
      'failed',
      now()
    );

    -- Re-raise the exception
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on sales table to validate before insert/update
DROP TRIGGER IF EXISTS trigger_validate_sales_business_rules ON sales;
CREATE TRIGGER trigger_validate_sales_business_rules
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION validate_sales_business_rules();

-- Create helper function to check if a customer is approved for seller
CREATE OR REPLACE FUNCTION is_valid_customer_for_seller(
  p_seller_id uuid,
  p_seller_type text,
  p_customer_id uuid
)
RETURNS TABLE (
  is_valid boolean,
  error_message text
) AS $$
DECLARE
  v_customer_name text;
  v_is_mansa boolean;
  v_is_auramet boolean;
  v_is_stonex boolean;
BEGIN
  SELECT name INTO v_customer_name
  FROM customers
  WHERE id = p_customer_id;

  v_is_mansa := (LOWER(v_customer_name) LIKE '%mansa%ressources%');
  v_is_auramet := (LOWER(v_customer_name) LIKE '%auramet%');
  v_is_stonex := (LOWER(v_customer_name) LIKE '%stonex%');

  -- Mining company seller
  IF p_seller_type = 'mining_company' THEN
    IF v_is_mansa THEN
      RETURN QUERY SELECT true, NULL::text;
    ELSE
      RETURN QUERY SELECT false, 'Mining companies can only sell to Mansa Ressources S.A'::text;
    END IF;

  -- Mansa Ressources seller
  ELSIF p_seller_type = 'mansa_ressources' THEN
    IF v_is_auramet OR v_is_stonex THEN
      RETURN QUERY SELECT true, NULL::text;
    ELSE
      RETURN QUERY SELECT false, 'Mansa Ressources can only sell to Auramet or StoneX'::text;
    END IF;

  ELSE
    RETURN QUERY SELECT false, 'Invalid seller type'::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get allowed customers for a seller
CREATE OR REPLACE FUNCTION get_allowed_customers_for_seller(
  p_seller_id uuid,
  p_seller_type text
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_country text
) AS $$
BEGIN
  -- If seller is mining company, return only Mansa Ressources
  IF p_seller_type = 'mining_company' THEN
    RETURN QUERY
    SELECT c.id, c.name, c.email, c.country
    FROM customers c
    WHERE LOWER(c.name) LIKE '%mansa%ressources%'
       OR LOWER(c.name) LIKE '%mansa%resources%';

  -- If seller is Mansa Ressources, return only Auramet and StoneX
  ELSIF p_seller_type = 'mansa_ressources' THEN
    RETURN QUERY
    SELECT c.id, c.name, c.email, c.country
    FROM customers c
    WHERE LOWER(c.name) LIKE '%auramet%'
       OR LOWER(c.name) LIKE '%stonex%'
       OR LOWER(c.name) LIKE '%stone%x%';

  ELSE
    -- Return empty result for invalid seller type
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_valid_customer_for_seller TO authenticated;
GRANT EXECUTE ON FUNCTION get_allowed_customers_for_seller TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION validate_sales_business_rules IS 'Enforces business rules: mining companies sell only to Mansa, Mansa sells only to Auramet/StoneX';
COMMENT ON FUNCTION is_valid_customer_for_seller IS 'Checks if a customer is valid for a given seller according to business rules';
COMMENT ON FUNCTION get_allowed_customers_for_seller IS 'Returns list of customers allowed for a given seller';
COMMENT ON TRIGGER trigger_validate_sales_business_rules ON sales IS 'Validates sales follow business rules before insert/update';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sales validation business rules created - enforcing seller-customer relationships';
END $$;
