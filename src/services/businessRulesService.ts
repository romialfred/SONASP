import { supabase } from '@/lib/supabase';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

export interface BusinessRule {
  id: string;
  rule_key: string;
  rule_name: string;
  rule_value: number;
  rule_category: string;
  rule_type?: string;
  description: string | null;
  unit: string | null;
  updated_at: string;
  updated_by: string | null;
}

// Cache for business rules to avoid repeated DB queries
let businessRulesCache: Map<string, { value: number; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get a business rule value by key
 */
export async function getBusinessRuleValue(ruleKey: string): Promise<number | null> {
  // Check cache first
  const cached = businessRulesCache.get(ruleKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.value;
  }

  try {
    const { data, error } = await supabase
      .from('business_rules')
      .select('rule_value')
      .eq('rule_key', ruleKey)
      .single();

    if (error) {
      console.error(`Error fetching business rule ${ruleKey}:`, error);
      return null;
    }

    if (data) {
      // Cache the value
      businessRulesCache.set(ruleKey, {
        value: data.rule_value,
        timestamp: Date.now(),
      });
      return data.rule_value;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching business rule ${ruleKey}:`, error);
    return null;
  }
}

/**
 * Get variance threshold for mine to airport
 * Default: 2.0%
 */
export async function getMineToAirportVarianceThreshold(): Promise<number> {
  const value = await getBusinessRuleValue('var_threshold_mine_airport');
  return value ?? 2.0; // Default fallback
}

/**
 * Get variance threshold for airport to refinery
 * Default: 1.5%
 */
export async function getAirportToRefineryVarianceThreshold(): Promise<number> {
  const value = await getBusinessRuleValue('var_threshold_airport_refinery');
  return value ?? 1.5; // Default fallback
}

/**
 * Get variance threshold for refining loss
 * Default: 5.0%
 */
export async function getRefiningLossVarianceThreshold(): Promise<number> {
  const value = await getBusinessRuleValue('var_threshold_refining_loss');
  return value ?? 5.0; // Default fallback
}

/**
 * Get all business rules by category
 */
export async function getBusinessRulesByCategory(category: string): Promise<BusinessRule[]> {
  try {
    const { data, error } = await supabase
      .from('business_rules')
      .select('*')
      .eq('rule_category', category)
      .order('rule_name');

    if (error) {
      console.error(`Error fetching business rules for category ${category}:`, error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error(`Error fetching business rules for category ${category}:`, error);
    return [];
  }
}

/**
 * Get all threshold rules
 */
export async function getThresholdRules(): Promise<BusinessRule[]> {
  return getBusinessRulesByCategory('threshold');
}

/**
 * Update a business rule value
 */
export async function updateBusinessRule(
  ruleKey: string,
  newValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('business_rules')
      .update({ rule_value: newValue })
      .eq('rule_key', ruleKey);

    if (error) {
      console.error(`Error updating business rule ${ruleKey}:`, error);
      return { success: false, error: error.message };
    }

    // Clear cache for this rule
    businessRulesCache.delete(ruleKey);

    return { success: true };
  } catch (error) {
    console.error(`Error updating business rule ${ruleKey}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Clear the business rules cache
 */
export function clearBusinessRulesCache(): void {
  businessRulesCache.clear();
}

/**
 * Get grams to ounces conversion rate
 */
export async function getGramsToOuncesRate(): Promise<number> {
  const value = await getBusinessRuleValue('grams_to_ounces');
  return value ?? TROY_OZ_GRAMS; // Repli sur la constante canonique (audit F1)
}
