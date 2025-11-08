import { supabase } from '@/lib/supabase';
import { licenseService } from './licenseService';
import { License, LicenseValidationResult } from '@/types/license';

export interface ExportLicenseValidation {
  batchId?: string;
  batchNumber?: string;
  mineId: string;
  exportQuantityOz: number;
  exportDate: string;
  requestedLicenseId?: string;
}

export interface BatchCreationValidation {
  mineId: string;
  grossWeightGrams: number;
  shippingDate: string;
}

export const licenseValidationService = {
  async validateExportCreation(validation: ExportLicenseValidation): Promise<LicenseValidationResult> {
    if (validation.requestedLicenseId) {
      return this.validateSpecificLicense(
        validation.requestedLicenseId,
        validation.exportQuantityOz,
        validation.exportDate
      );
    }

    return licenseService.validateLicenseForExport(
      validation.mineId,
      validation.exportQuantityOz,
      validation.exportDate
    );
  },

  async validateSpecificLicense(
    licenseId: string,
    exportQuantityOz: number,
    exportDate: string
  ): Promise<LicenseValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    let license: License;
    try {
      license = await licenseService.getLicense(licenseId);
    } catch (error) {
      return {
        valid: false,
        errors: ['Selected license not found'],
        warnings: [],
        canProceed: false,
      };
    }

    if (!license.is_active) {
      errors.push(`License ${license.license_number} is not active (status: ${license.status})`);
    }

    const issueDate = license.start_date || license.issue_date;
    if (exportDate < issueDate) {
      errors.push(`Export date is before license validity start date (${issueDate})`);
    }

    if (exportDate > license.expiry_date) {
      errors.push(`Export date is after license expiry date (${license.expiry_date})`);
    }

    if (license.remaining_qty_oz < exportQuantityOz) {
      errors.push(
        `Insufficient quota: ${license.remaining_qty_oz.toFixed(3)} oz remaining, ${exportQuantityOz.toFixed(3)} oz requested`
      );
    }

    if (license.days_to_expiry >= 0 && license.days_to_expiry <= 7) {
      warnings.push(`License expires in ${license.days_to_expiry} days`);
    }

    if (license.remaining_percentage <= 25) {
      warnings.push(`License has only ${license.remaining_percentage}% quota remaining`);
    }

    const afterConsumption = license.remaining_qty_oz - exportQuantityOz;
    if (afterConsumption > 0 && afterConsumption < (license.authorized_qty_oz * 0.05)) {
      warnings.push(
        `After this export, only ${afterConsumption.toFixed(3)} oz will remain (${((afterConsumption / license.authorized_qty_oz) * 100).toFixed(1)}%)`
      );
    }

    const valid = errors.length === 0;

    return {
      valid,
      license: valid ? license : undefined,
      errors,
      warnings,
      canProceed: valid,
    };
  },

  async validateBatchCreation(validation: BatchCreationValidation): Promise<LicenseValidationResult> {
    const exportQuantityOz = validation.grossWeightGrams / 31.1035;

    return licenseService.validateLicenseForExport(
      validation.mineId,
      exportQuantityOz,
      validation.shippingDate
    );
  },

  async checkBatchLicenseRequirement(batchId: string): Promise<{
    required: boolean;
    hasLicense: boolean;
    license?: License;
    canExport: boolean;
    message: string;
  }> {
    const { data: batch } = await supabase
      .from('batches')
      .select('license_id, status, mining_company_id')
      .eq('id', batchId)
      .single();

    if (!batch) {
      return {
        required: true,
        hasLicense: false,
        canExport: false,
        message: 'Batch not found',
      };
    }

    if (!batch.license_id) {
      return {
        required: true,
        hasLicense: false,
        canExport: false,
        message: 'This batch requires a valid export license before it can proceed',
      };
    }

    try {
      const license = await licenseService.getLicense(batch.license_id);

      if (!license.is_active) {
        return {
          required: true,
          hasLicense: true,
          license,
          canExport: false,
          message: `Assigned license ${license.license_number} is no longer active (${license.status})`,
        };
      }

      return {
        required: true,
        hasLicense: true,
        license,
        canExport: true,
        message: `Valid license ${license.license_number} assigned`,
      };
    } catch (error) {
      return {
        required: true,
        hasLicense: false,
        canExport: false,
        message: 'Assigned license is invalid or inaccessible',
      };
    }
  },

  async assignLicenseToBatch(batchId: string, licenseId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: batch } = await supabase
      .from('batches')
      .select('gross_weight_grams, shipping_date, mining_company_id')
      .eq('id', batchId)
      .single();

    if (!batch) {
      throw new Error('Batch not found');
    }

    const exportQuantityOz = batch.gross_weight_grams / 31.1035;

    const validation = await this.validateSpecificLicense(
      licenseId,
      exportQuantityOz,
      batch.shipping_date
    );

    if (!validation.valid) {
      throw new Error(`License validation failed: ${validation.errors.join(', ')}`);
    }

    const { error } = await supabase
      .from('batches')
      .update({ license_id: licenseId })
      .eq('id', batchId);

    if (error) throw error;

    await licenseService.reserveQuota({
      license_id: licenseId,
      quantity_oz: exportQuantityOz,
      batch_id: batchId,
      reason: 'License assigned to batch',
    });
  },

  async removeLicenseFromBatch(batchId: string): Promise<void> {
    const { data: batch } = await supabase
      .from('batches')
      .select('license_id, gross_weight_grams')
      .eq('id', batchId)
      .single();

    if (!batch || !batch.license_id) {
      return;
    }

    const exportQuantityOz = batch.gross_weight_grams / 31.1035;

    await licenseService.releaseQuota({
      license_id: batch.license_id,
      quantity_oz: exportQuantityOz,
      reason: 'License removed from batch',
    });

    const { error } = await supabase
      .from('batches')
      .update({ license_id: null })
      .eq('id', batchId);

    if (error) throw error;
  },

  async getBlockingReasons(mineId: string, exportQuantityOz: number, exportDate: string): Promise<string[]> {
    const validation = await licenseService.validateLicenseForExport(
      mineId,
      exportQuantityOz,
      exportDate
    );

    if (validation.valid) {
      return [];
    }

    const reasons = [...validation.errors];

    if (!validation.suggestedLicenses || validation.suggestedLicenses.length === 0) {
      reasons.push('No licenses available for this mine. Please apply for an export license.');
    } else {
      reasons.push(
        `Available licenses: ${validation.suggestedLicenses.map(l => `${l.license_number} (${l.remaining_qty_oz.toFixed(3)} oz remaining, expires ${l.expiry_date})`).join(', ')}`
      );
    }

    return reasons;
  },

  async canProceedWithExport(batchId: string): Promise<{
    canProceed: boolean;
    reason?: string;
    requiredActions: string[];
  }> {
    const licenseCheck = await this.checkBatchLicenseRequirement(batchId);

    if (!licenseCheck.hasLicense) {
      return {
        canProceed: false,
        reason: 'No export license assigned to this batch',
        requiredActions: [
          'Apply for an export license from the Ministry of Mines',
          'Once approved, assign the license to this batch',
          'Ensure the license has sufficient quota for this export',
        ],
      };
    }

    if (!licenseCheck.canExport) {
      return {
        canProceed: false,
        reason: licenseCheck.message,
        requiredActions: [
          'Review the license status and validity',
          'If expired, apply for a new license',
          'If quota exhausted, request a quota increase or new license',
          'Assign a valid license to this batch',
        ],
      };
    }

    return {
      canProceed: true,
      requiredActions: [],
    };
  },
};
