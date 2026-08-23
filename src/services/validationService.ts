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

import { SALES_STATUSES } from '@/constants/salesStatuses';

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
 * Validate sales status transition
 */
export function validateSalesStatusTransition(
  currentStatus: string,
  newStatus: string,
  context?: {
    hasPayment?: boolean;
    paymentConfirmed?: boolean;
    isCustomerApproval?: boolean;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Define valid sales transitions based on the 11-step workflow
  const validTransitions: Record<string, string[]> = {
    [SALES_STATUSES.CREATE_SALES]: [SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL],
    [SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL]: [
      SALES_STATUSES.MANAGEMENT_APPROVED,
      SALES_STATUSES.MANAGEMENT_REJECTED
    ],
    [SALES_STATUSES.MANAGEMENT_APPROVED]: [
      SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL
    ],
    [SALES_STATUSES.MANAGEMENT_REJECTED]: [SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL],
    [SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL]: [
      SALES_STATUSES.CUSTOMER_APPROVED,
      SALES_STATUSES.CUSTOMER_REJECTED
    ],
    [SALES_STATUSES.CUSTOMER_APPROVED]: [
      SALES_STATUSES.WAITING_FOR_PAYMENT,
      SALES_STATUSES.VIRTUAL_PAYMENT
    ],
    [SALES_STATUSES.CUSTOMER_REJECTED]: [SALES_STATUSES.PENDING_MANAGEMENT_APPROVAL],
    [SALES_STATUSES.WAITING_FOR_PAYMENT]: [
      SALES_STATUSES.VIRTUAL_PAYMENT,
      SALES_STATUSES.PAYMENT_RECEIVED
    ],
    [SALES_STATUSES.VIRTUAL_PAYMENT]: [
      SALES_STATUSES.PAYMENT_RECEIVED
    ],
    [SALES_STATUSES.PAYMENT_RECEIVED]: [SALES_STATUSES.COMPLETED],
    [SALES_STATUSES.COMPLETED]: []
  };

  const allowed = validTransitions[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    errors.push(
      `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.join(', ') || 'none'}`
    );
  }

  // Context-specific validations
  if (context?.isCustomerApproval) {
    if (currentStatus !== SALES_STATUSES.PENDING_FOR_CUSTOMER_APPROVAL) {
      errors.push('Customer approval can only be performed on sales with status "pending_for_customer_approval"');
    }
  }

  if (newStatus === SALES_STATUSES.PAYMENT_RECEIVED) {
    if (!context?.hasPayment) {
      errors.push('Cannot mark as payment received without a payment record');
    }
    if (context?.hasPayment && !context?.paymentConfirmed) {
      warnings.push('Payment exists but has not been confirmed by management');
    }
  }

  if (newStatus === SALES_STATUSES.COMPLETED) {
    if (currentStatus !== SALES_STATUSES.PAYMENT_RECEIVED) {
      errors.push('Sale can only be completed after payment is received');
    }
  }

  // Warn about rejected sales
  if (newStatus === SALES_STATUSES.CUSTOMER_REJECTED) {
    warnings.push('Sale will be marked as rejected. This action should be accompanied by a reason.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate sale creation data
 */
export interface SaleCreationData {
  customer_id: string;
  seller_id: string;
  seller_type: 'mining_company' | 'sonasp';
  quantity_oz: number;
  london_am_rate: number;
  available_inventory_oz: number;
}

export function validateSaleCreation(data: SaleCreationData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate customer
  if (!data.customer_id) {
    errors.push('Customer is required');
  }

  // Validate seller
  if (!data.seller_id) {
    errors.push('Seller is required');
  }

  if (!data.seller_type) {
    errors.push('Seller type is required');
  }

  // Validate quantity
  if (data.quantity_oz <= 0) {
    errors.push('Quantity must be greater than zero');
  }

  if (data.quantity_oz > data.available_inventory_oz) {
    errors.push(
      `Quantity (${data.quantity_oz} oz) exceeds available inventory (${data.available_inventory_oz} oz)`
    );
  }

  if (data.quantity_oz > data.available_inventory_oz * 0.9) {
    warnings.push(
      `Sale quantity is more than 90% of available inventory. Ensure this is intentional.`
    );
  }

  // Validate price
  if (data.london_am_rate <= 0) {
    errors.push('London AM rate must be greater than zero');
  }

  if (data.london_am_rate < 1000) {
    warnings.push(
      `London AM rate of $${data.london_am_rate} is unusually low. Current typical range is $2000-$2500 per oz.`
    );
  }

  if (data.london_am_rate > 5000) {
    warnings.push(
      `London AM rate of $${data.london_am_rate} is unusually high. Please verify this is correct.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
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
