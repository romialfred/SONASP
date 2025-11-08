import { supabase } from '@/lib/supabase';
import {
  License,
  LicenseFilters,
  LicenseValidationResult,
  LicenseEvaluation,
  LicenseSummary,
  QuotaReservation,
  QuotaConsumption,
  QuotaRelease,
  LicenseQuotaTransaction,
  LicenseEvent,
  TrafficLight,
  Country,
} from '@/types/license';

export interface CreateLicenseData {
  license_number: string;
  request_id?: string;
  applicant_mine_id: string;
  applicant_company_name: string;
  applicant_signatory: string;
  applicant_signatory_title?: string;
  issuer_organization?: string;
  issuer_signatory: string;
  issuer_signatory_title?: string;
  issuer_country: Country;
  request_date: string;
  issue_date: string;
  start_date?: string;
  expiry_date: string;
  authorized_qty_oz: number;
  authorized_qty_unit?: string;
  theoretical_price_usd_per_oz?: number;
  notes?: string;
}

export const licenseService = {
  async createLicense(data: CreateLicenseData): Promise<License> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const estimatedValue = data.theoretical_price_usd_per_oz
      ? data.authorized_qty_oz * data.theoretical_price_usd_per_oz
      : undefined;

    const { data: license, error } = await supabase
      .from('licenses')
      .insert({
        ...data,
        estimated_total_value_usd: estimatedValue,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return license;
  },

  async updateLicense(id: string, data: Partial<CreateLicenseData>): Promise<License> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: license, error } = await supabase
      .from('licenses')
      .update({
        ...data,
        updated_by: user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return license;
  },

  async getLicense(id: string): Promise<License> {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getLicenseByNumber(licenseNumber: string): Promise<License | null> {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_number', licenseNumber)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async listLicenses(filters?: LicenseFilters): Promise<License[]> {
    let query = supabase
      .from('licenses')
      .select('*')
      .order('expiry_date', { ascending: true });

    if (filters?.mine_id) {
      query = query.eq('applicant_mine_id', filters.mine_id);
    }

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.country) {
      query = query.eq('issuer_country', filters.country);
    }

    if (filters?.expiry_date_from) {
      query = query.gte('expiry_date', filters.expiry_date_from);
    }

    if (filters?.expiry_date_to) {
      query = query.lte('expiry_date', filters.expiry_date_to);
    }

    if (filters?.remaining_percentage_min !== undefined) {
      query = query.gte('remaining_percentage', filters.remaining_percentage_min);
    }

    if (filters?.remaining_percentage_max !== undefined) {
      query = query.lte('remaining_percentage', filters.remaining_percentage_max);
    }

    if (filters?.days_to_expiry_max !== undefined) {
      query = query.lte('days_to_expiry', filters.days_to_expiry_max);
    }

    if (filters?.search) {
      query = query.or(
        `license_number.ilike.%${filters.search}%,applicant_company_name.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getActiveLicensesForMine(mineId: string): Promise<License[]> {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('applicant_mine_id', mineId)
      .eq('is_active', true)
      .order('expiry_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async validateLicenseForExport(
    mineId: string,
    exportQuantityOz: number,
    exportDate: string
  ): Promise<LicenseValidationResult> {
    const licenses = await this.getActiveLicensesForMine(mineId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (licenses.length === 0) {
      return {
        valid: false,
        errors: ['No active licenses available for this mine'],
        warnings: [],
        canProceed: false,
        suggestedLicenses: [],
      };
    }

    const eligibleLicenses = licenses.filter(license => {
      const issueDate = license.start_date || license.issue_date;
      return (
        exportDate >= issueDate &&
        exportDate <= license.expiry_date &&
        license.remaining_qty_oz >= exportQuantityOz
      );
    });

    if (eligibleLicenses.length === 0) {
      const insufficientQuota = licenses.filter(l => l.remaining_qty_oz < exportQuantityOz);
      const expiredOrFuture = licenses.filter(l => {
        const issueDate = l.start_date || l.issue_date;
        return exportDate < issueDate || exportDate > l.expiry_date;
      });

      if (insufficientQuota.length > 0) {
        errors.push(`Insufficient quota. Available licenses have less than ${exportQuantityOz} oz remaining.`);
      }
      if (expiredOrFuture.length > 0) {
        errors.push('Export date is outside the validity period of available licenses.');
      }

      return {
        valid: false,
        errors,
        warnings,
        canProceed: false,
        suggestedLicenses: licenses.slice(0, 3),
      };
    }

    const bestLicense = eligibleLicenses[0];

    if (bestLicense.days_to_expiry <= 15) {
      warnings.push(`License ${bestLicense.license_number} expires in ${bestLicense.days_to_expiry} days`);
    }

    if (bestLicense.remaining_percentage <= 25) {
      warnings.push(`License ${bestLicense.license_number} has only ${bestLicense.remaining_percentage}% quota remaining`);
    }

    return {
      valid: true,
      license: bestLicense,
      errors: [],
      warnings,
      canProceed: true,
      suggestedLicenses: eligibleLicenses,
    };
  },

  async reserveQuota(reservation: QuotaReservation): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: license } = await this.getLicense(reservation.license_id);

    if (!license) {
      throw new Error('License not found');
    }

    if (!license.is_active) {
      throw new Error('License is not active');
    }

    if (license.remaining_qty_oz < reservation.quantity_oz) {
      throw new Error('Insufficient quota remaining');
    }

    const newReserved = license.reserved_qty_oz + reservation.quantity_oz;

    const { error: updateError } = await supabase
      .from('licenses')
      .update({
        reserved_qty_oz: newReserved,
        updated_by: user.id,
      })
      .eq('id', reservation.license_id)
      .eq('reserved_qty_oz', license.reserved_qty_oz);

    if (updateError) {
      throw new Error('Failed to reserve quota. Concurrent modification detected.');
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await supabase.from('license_quota_transactions').insert({
      license_id: reservation.license_id,
      transaction_type: 'RESERVE',
      quantity_oz: reservation.quantity_oz,
      reserved_qty_after: newReserved,
      consumed_qty_after: license.consumed_qty_oz,
      remaining_qty_after: license.authorized_qty_oz - newReserved - license.consumed_qty_oz,
      export_id: reservation.export_id,
      batch_id: reservation.batch_id,
      reason: reservation.reason,
      performed_by: user.id,
      performed_by_name: profile?.full_name,
    });
  },

  async consumeQuota(consumption: QuotaConsumption): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: license } = await this.getLicense(consumption.license_id);

    if (!license) {
      throw new Error('License not found');
    }

    const newConsumed = license.consumed_qty_oz + consumption.quantity_oz;
    const newReserved = Math.max(0, license.reserved_qty_oz - consumption.quantity_oz);

    const { error: updateError } = await supabase
      .from('licenses')
      .update({
        consumed_qty_oz: newConsumed,
        reserved_qty_oz: newReserved,
        updated_by: user.id,
      })
      .eq('id', consumption.license_id);

    if (updateError) throw updateError;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await supabase.from('license_quota_transactions').insert({
      license_id: consumption.license_id,
      transaction_type: 'CONSUME',
      quantity_oz: consumption.quantity_oz,
      reserved_qty_after: newReserved,
      consumed_qty_after: newConsumed,
      remaining_qty_after: license.authorized_qty_oz - newConsumed - newReserved,
      export_id: consumption.export_id,
      batch_id: consumption.batch_id,
      batch_number: consumption.batch_number,
      reason: 'Export confirmed',
      performed_by: user.id,
      performed_by_name: profile?.full_name,
    });
  },

  async releaseQuota(release: QuotaRelease): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: license } = await this.getLicense(release.license_id);

    if (!license) {
      throw new Error('License not found');
    }

    const newReserved = Math.max(0, license.reserved_qty_oz - release.quantity_oz);

    const { error: updateError } = await supabase
      .from('licenses')
      .update({
        reserved_qty_oz: newReserved,
        updated_by: user.id,
      })
      .eq('id', release.license_id);

    if (updateError) throw updateError;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await supabase.from('license_quota_transactions').insert({
      license_id: release.license_id,
      transaction_type: 'RELEASE',
      quantity_oz: release.quantity_oz,
      reserved_qty_after: newReserved,
      consumed_qty_after: license.consumed_qty_oz,
      remaining_qty_after: license.authorized_qty_oz - newReserved - license.consumed_qty_oz,
      export_id: release.export_id,
      reason: release.reason,
      performed_by: user.id,
      performed_by_name: profile?.full_name,
    });
  },

  async getQuotaTransactions(licenseId: string): Promise<LicenseQuotaTransaction[]> {
    const { data, error } = await supabase
      .from('license_quota_transactions')
      .select('*')
      .eq('license_id', licenseId)
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getLicenseEvents(licenseId: string): Promise<LicenseEvent[]> {
    const { data, error } = await supabase
      .from('license_events')
      .select('*')
      .eq('license_id', licenseId)
      .order('event_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async evaluateLicense(license: License): Promise<LicenseEvaluation> {
    const recommendations: string[] = [];
    let trafficLight: TrafficLight = 'GREEN';
    let status = 'Healthy';
    let reason = 'License is in good standing with adequate quota and validity period.';

    if (license.status === 'EXPIRED') {
      trafficLight = 'RED';
      status = 'Expired';
      reason = 'License has expired and cannot be used for new exports.';
      recommendations.push('Apply for a new license immediately');
    } else if (license.status === 'CLOSED') {
      trafficLight = 'GRAY';
      status = 'Closed';
      reason = 'License quota has been fully consumed.';
      recommendations.push('License is complete. No action needed.');
    } else if (license.status === 'SUSPENDED') {
      trafficLight = 'RED';
      status = 'Suspended';
      reason = `License is suspended: ${license.suspension_reason}`;
      recommendations.push('Contact ministry to resolve suspension');
    } else {
      if (license.days_to_expiry < 0) {
        trafficLight = 'RED';
        status = 'Expired';
        reason = 'License validity period has ended.';
        recommendations.push('License should be marked as expired');
      } else if (license.remaining_qty_oz <= 0) {
        trafficLight = 'RED';
        status = 'Depleted';
        reason = 'No quota remaining on this license.';
        recommendations.push('Apply for new license or license extension');
      } else if (license.days_to_expiry <= 7 || license.remaining_percentage <= 10) {
        trafficLight = 'RED';
        status = 'Critical';
        if (license.days_to_expiry <= 7) {
          reason = `License expires in ${license.days_to_expiry} days with ${license.remaining_percentage}% quota remaining.`;
          recommendations.push('Urgent: Apply for license renewal immediately');
        } else {
          reason = `Only ${license.remaining_percentage}% quota remaining (${license.remaining_qty_oz.toFixed(3)} oz).`;
          recommendations.push('Urgent: Apply for quota increase or new license');
        }
      } else if (license.days_to_expiry <= 15 || license.remaining_percentage <= 25) {
        trafficLight = 'YELLOW';
        status = 'Warning';
        const issues = [];
        if (license.days_to_expiry <= 15) {
          issues.push(`${license.days_to_expiry} days until expiry`);
        }
        if (license.remaining_percentage <= 25) {
          issues.push(`${license.remaining_percentage}% quota remaining`);
        }
        reason = issues.join('; ') + '.';
        recommendations.push('Plan for license renewal or extension');
        recommendations.push('Monitor export pace to ensure quota lasts until expiry');
      }
    }

    return {
      trafficLight,
      status,
      reason,
      recommendations,
    };
  },

  async getLicenseSummary(filters?: LicenseFilters): Promise<LicenseSummary> {
    const licenses = await this.listLicenses(filters);

    const summary: LicenseSummary = {
      totalLicenses: licenses.length,
      activeLicenses: 0,
      expiredLicenses: 0,
      closedLicenses: 0,
      totalAuthorizedOz: 0,
      totalConsumedOz: 0,
      totalRemainingOz: 0,
      licensesExpiringSoon: 0,
      licensesLowQuota: 0,
    };

    licenses.forEach(license => {
      summary.totalAuthorizedOz += license.authorized_qty_oz;
      summary.totalConsumedOz += license.consumed_qty_oz;
      summary.totalRemainingOz += license.remaining_qty_oz;

      if (license.status === 'ACTIVE') {
        summary.activeLicenses++;
      } else if (license.status === 'EXPIRED') {
        summary.expiredLicenses++;
      } else if (license.status === 'CLOSED') {
        summary.closedLicenses++;
      }

      if (license.days_to_expiry >= 0 && license.days_to_expiry <= 15) {
        summary.licensesExpiringSoon++;
      }

      if (license.remaining_percentage <= 25 && license.remaining_percentage > 0) {
        summary.licensesLowQuota++;
      }
    });

    return summary;
  },

  async uploadLicensePDF(licenseId: string, file: File): Promise<License> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const license = await this.getLicense(licenseId);

    const fileExt = file.name.split('.').pop();
    const fileName = `${license.license_number}_${Date.now()}.${fileExt}`;
    const filePath = `licenses/${licenseId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('license-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('license-documents')
      .getPublicUrl(uploadData.path);

    const fileHash = await this.calculateFileHash(file);

    const { data: updated, error: updateError } = await supabase
      .from('licenses')
      .update({
        pdf_url: urlData.publicUrl,
        pdf_hash: fileHash,
        updated_by: user.id,
      })
      .eq('id', licenseId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  },

  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
};
