/**
 * Validation Service
 *
 * Provides comprehensive client-side validation for all data types
 * to prevent invalid data entry and provide immediate user feedback.
 *
 * Features:
 * - Weight validation (positive, logical)
 * - Percentage validation (0-100 range)
 * - Date validation (not future, chronological order)
 * - Variance calculation and threshold checking
 * - Multilingual error messages
 */

import { BATCH_STATUSES } from '@/constants/batchStatuses';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WeightValidation {
  weight_grams: number;
  weight_after_melting?: number;
  metal_type?: 'gold' | 'silver';
}

export interface DateValidation {
  shipping_date?: Date | string;
  airport_received_at?: Date | string;
  refinery_received_at?: Date | string;
}

export interface VarianceConfig {
  original_weight: number;
  received_weight: number;
  metal_type: 'gold' | 'silver';
  location: 'airport' | 'refinery';
}

// Variance thresholds (matching database configuration)
const VARIANCE_THRESHOLDS = {
  airport: {
    gold: { max: 2.0, approval_required: 1.0 },
    silver: { max: 3.0, approval_required: 1.5 }
  },
  refinery: {
    gold: { max: 1.5, approval_required: 0.75 },
    silver: { max: 2.5, approval_required: 1.0 }
  }
};

/**
 * Validate weight values
 */
export function validateWeights(data: WeightValidation): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Weight must be positive
  if (data.weight_grams <= 0) {
    errors.push('Weight must be greater than zero');
  }

  // Weight must be reasonable (not too small or too large)
  if (data.weight_grams < 1) {
    warnings.push('Weight is very small (less than 1 gram). Please verify.');
  }

  if (data.weight_grams > 1000000) {
    warnings.push('Weight is very large (over 1,000 kg). Please verify.');
  }

  // Weight after melting must be less than or equal to weight before
  if (data.weight_after_melting !== undefined) {
    if (data.weight_after_melting <= 0) {
      errors.push('Weight after melting must be greater than zero');
    }

    if (data.weight_after_melting > data.weight_grams) {
      errors.push('Weight after melting cannot be greater than weight before melting');
    }

    // Check for unusual loss
    const loss_percentage = ((data.weight_grams - data.weight_after_melting) / data.weight_grams) * 100;
    if (loss_percentage > 10) {
      warnings.push(`Weight loss is ${loss_percentage.toFixed(2)}% which is unusually high. Please verify.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate percentage values (0-100 range)
 */
export function validatePercentage(value: number, fieldName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value < 0) {
    errors.push(`${fieldName} cannot be negative`);
  }

  if (value > 100) {
    errors.push(`${fieldName} cannot be greater than 100%`);
  }

  // Warnings for unusual values
  if (fieldName.toLowerCase().includes('fineness')) {
    if (value < 50) {
      warnings.push(`Fineness of ${value}% is unusually low. Please verify.`);
    }
    if (value > 99.99) {
      warnings.push(`Fineness of ${value}% is unusually high. Please verify.`);
    }
  }

  if (fieldName.toLowerCase().includes('retained')) {
    if (value < 80) {
      warnings.push(`Metal retained of ${value}% indicates high loss. Please verify.`);
    }
    if (value > 99) {
      warnings.push(`Metal retained of ${value}% is unusually high. Please verify.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate date values
 */
export function validateDates(data: DateValidation): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = new Date();

  // Convert string dates to Date objects
  const shipping = data.shipping_date ? new Date(data.shipping_date) : null;
  const airport = data.airport_received_at ? new Date(data.airport_received_at) : null;
  const refinery = data.refinery_received_at ? new Date(data.refinery_received_at) : null;

  // Check for future dates
  if (shipping && shipping > now) {
    errors.push('Shipping date cannot be in the future');
  }

  if (airport && airport > now) {
    errors.push('Airport receipt date cannot be in the future');
  }

  if (refinery && refinery > now) {
    errors.push('Refinery receipt date cannot be in the future');
  }

  // Check chronological order
  if (shipping && airport) {
    if (airport < shipping) {
      errors.push('Airport receipt date cannot be before shipping date');
    }

    // Warn if received too quickly
    const hoursDiff = (airport.getTime() - shipping.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 1) {
      warnings.push('Receipt at airport less than 1 hour after shipping. Please verify.');
    }
  }

  if (airport && refinery) {
    if (refinery < airport) {
      errors.push('Refinery receipt date cannot be before airport receipt date');
    }

    // Warn if received too quickly
    const hoursDiff = (refinery.getTime() - airport.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 1) {
      warnings.push('Receipt at refinery less than 1 hour after airport. Please verify.');
    }
  }

  // Warn about old dates
  if (shipping) {
    const daysSinceShipping = (now.getTime() - shipping.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceShipping > 90) {
      warnings.push(`Shipping date is ${Math.floor(daysSinceShipping)} days ago. Please verify.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate variance percentage
 */
export function calculateVariance(original: number, received: number): number {
  if (original === 0) return 0;
  return Math.abs((received - original) / original) * 100;
}

/**
 * Validate weight variance against thresholds
 */
export function validateVariance(config: VarianceConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const variance = calculateVariance(config.original_weight, config.received_weight);
  const threshold = VARIANCE_THRESHOLDS[config.location][config.metal_type];

  if (variance > threshold.max) {
    errors.push(
      `Weight variance of ${variance.toFixed(2)}% exceeds maximum allowed (${threshold.max}%) for ${config.metal_type} at ${config.location}`
    );
  } else if (variance > threshold.approval_required) {
    warnings.push(
      `Weight variance of ${variance.toFixed(2)}% requires manager approval (threshold: ${threshold.approval_required}%)`
    );
  }

  // Additional context
  const difference = Math.abs(config.received_weight - config.original_weight);
  if (variance > 0.1) {
    warnings.push(`Weight difference: ${difference.toFixed(2)} grams (${variance.toFixed(2)}%)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate batch status transition
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Define valid transitions (simplified - full validation is in database)
  const validTransitions: Record<string, string[]> = {
    [BATCH_STATUSES.PENDING_FACTORY_APPROVAL]: [BATCH_STATUSES.APPROVED_FOR_TRANSPORT, BATCH_STATUSES.CANCELLED],
    [BATCH_STATUSES.APPROVED_FOR_TRANSPORT]: [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT, BATCH_STATUSES.CANCELLED],
    [BATCH_STATUSES.WAITING_AIRPORT_RECEIPT]: [BATCH_STATUSES.RECEIVED_AT_AIRPORT, BATCH_STATUSES.CANCELLED],
    [BATCH_STATUSES.RECEIVED_AT_AIRPORT]: [BATCH_STATUSES.VALIDATED_FOR_REFINERY],
    [BATCH_STATUSES.VALIDATED_FOR_REFINERY]: [BATCH_STATUSES.WAITING_REFINERY_RECEIPT],
    [BATCH_STATUSES.WAITING_REFINERY_RECEIPT]: [BATCH_STATUSES.RECEIVED_AT_REFINERY, BATCH_STATUSES.CANCELLED],
    [BATCH_STATUSES.RECEIVED_AT_REFINERY]: [BATCH_STATUSES.VALIDATED_FOR_PROCESSING],
    [BATCH_STATUSES.VALIDATED_FOR_PROCESSING]: [BATCH_STATUSES.PROCESSING],
    [BATCH_STATUSES.PROCESSING]: [BATCH_STATUSES.IN_INVENTORY],
    [BATCH_STATUSES.IN_INVENTORY]: [BATCH_STATUSES.READY_FOR_SALE],
    [BATCH_STATUSES.READY_FOR_SALE]: [BATCH_STATUSES.ALLOCATED_TO_SALE, BATCH_STATUSES.IN_INVENTORY],
    [BATCH_STATUSES.ALLOCATED_TO_SALE]: [BATCH_STATUSES.SOLD, BATCH_STATUSES.READY_FOR_SALE],
  };

  const allowed = validTransitions[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    errors.push(
      `Cannot change status from "${currentStatus}" to "${newStatus}". This transition is not allowed.`
    );
  }

  // Special warning for processing to in_inventory (should use form)
  if (currentStatus === BATCH_STATUSES.PROCESSING && newStatus === BATCH_STATUSES.IN_INVENTORY) {
    warnings.push(
      'Status change to "in_inventory" should be done through the Add Inventory Entry form to ensure data integrity.'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate inventory entry data
 */
export interface InventoryEntryData {
  weight_before_melting_grams: number;
  weight_after_melting_grams: number;
  fineness_percentage: number;
  metal_retained_percentage: number;
}

export function validateInventoryEntry(data: InventoryEntryData): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate weights
  const weightValidation = validateWeights({
    weight_grams: data.weight_before_melting_grams,
    weight_after_melting: data.weight_after_melting_grams
  });
  allErrors.push(...weightValidation.errors);
  allWarnings.push(...weightValidation.warnings);

  // Validate fineness
  const finenessValidation = validatePercentage(data.fineness_percentage, 'Fineness');
  allErrors.push(...finenessValidation.errors);
  allWarnings.push(...finenessValidation.warnings);

  // Validate metal retained
  const retainedValidation = validatePercentage(data.metal_retained_percentage, 'Metal Retained');
  allErrors.push(...retainedValidation.errors);
  allWarnings.push(...retainedValidation.warnings);

  // Logical validation
  if (data.fineness_percentage > 0 && data.metal_retained_percentage > 0) {
    const final_fine = (data.weight_after_melting_grams * data.fineness_percentage * data.metal_retained_percentage) / 10000;

    if (final_fine <= 0) {
      allErrors.push('Calculated final fine is zero or negative. Please check all values.');
    }

    if (final_fine > data.weight_before_melting_grams) {
      allErrors.push('Calculated final fine exceeds weight before melting. This is not possible.');
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const messages: string[] = [];

  if (result.errors.length > 0) {
    messages.push('Errors:');
    result.errors.forEach(error => messages.push(`  • ${error}`));
  }

  if (result.warnings.length > 0) {
    if (messages.length > 0) messages.push('');
    messages.push('Warnings:');
    result.warnings.forEach(warning => messages.push(`  • ${warning}`));
  }

  return messages.join('\n');
}

/**
 * Check if user can perform action based on role
 */
export function canUserPerformAction(
  userRole: string,
  action: 'create' | 'update' | 'delete',
  resourceType: 'batch' | 'inventory' | 'sale' | 'customer' | 'payment'
): boolean {
  const permissions: Record<string, Record<string, string[]>> = {
    batch: {
      create: ['factory_staff', 'factory_manager', 'management'],
      update: ['factory_staff', 'factory_manager', 'airport_staff', 'airport_manager', 'refinery_staff', 'refinery_manager', 'management'],
      delete: ['management']
    },
    inventory: {
      create: ['refinery_staff', 'refinery_manager', 'management'],
      update: ['management'],
      delete: []
    },
    sale: {
      create: ['sales_staff', 'sales_manager', 'management'],
      update: ['sales_staff', 'sales_manager', 'management'],
      delete: ['management']
    },
    customer: {
      create: ['sales_staff', 'sales_manager', 'management'],
      update: ['sales_staff', 'sales_manager', 'management'],
      delete: ['management']
    },
    payment: {
      create: ['finance_staff', 'management'],
      update: ['management'],
      delete: ['management']
    }
  };

  const allowedRoles = permissions[resourceType]?.[action] || [];
  return allowedRoles.includes(userRole);
}
