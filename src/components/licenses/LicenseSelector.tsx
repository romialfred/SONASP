import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { licenseService } from '@/services/licenseService';
import { licenseValidationService } from '@/services/licenseValidationService';
import { AlertTriangle, CheckCircle, FileText, ExternalLink } from 'lucide-react';
import type { License, LicenseValidationResult } from '@/types/license';

interface LicenseSelectorProps {
  mineId: string;
  exportQuantityOz: number;
  exportDate: string;
  selectedLicenseId?: string;
  onChange: (licenseId: string | null) => void;
  onValidationChange?: (validation: LicenseValidationResult) => void;
  disabled?: boolean;
}

export function LicenseSelector({
  mineId,
  exportQuantityOz,
  exportDate,
  selectedLicenseId,
  onChange,
  onValidationChange,
  disabled = false,
}: LicenseSelectorProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [validation, setValidation] = useState<LicenseValidationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mineId) {
      loadLicenses();
    }
  }, [mineId]);

  useEffect(() => {
    if (mineId && exportQuantityOz > 0 && exportDate) {
      validateSelection();
    }
  }, [mineId, exportQuantityOz, exportDate, selectedLicenseId]);

  const loadLicenses = async () => {
    setLoading(true);
    try {
      const data = await licenseService.getActiveLicensesForMine(mineId);
      setLicenses(data);

      if (data.length > 0 && !selectedLicenseId) {
        onChange(data[0].id);
      }
    } catch (error) {
      console.error('Error loading licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateSelection = async () => {
    if (!mineId || exportQuantityOz <= 0 || !exportDate) return;

    try {
      const result = await licenseValidationService.validateExportCreation({
        mineId,
        exportQuantityOz,
        exportDate,
        requestedLicenseId: selectedLicenseId,
      });

      setValidation(result);
      onValidationChange?.(result);
    } catch (error) {
      console.error('Error validating license:', error);
    }
  };

  const getLicenseDisplay = (license: License) => {
    const remaining = license.remaining_qty_oz.toFixed(3);
    const percentage = license.remaining_percentage.toFixed(1);
    const daysLeft = license.days_to_expiry;

    return `${license.license_number} - ${remaining} oz (${percentage}%) - ${daysLeft} days`;
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        Loading available licenses...
      </div>
    );
  }

  if (!mineId) {
    return (
      <Alert variant="info">
        <AlertTriangle className="w-5 h-5" />
        <span>Please select a mining company first to see available licenses</span>
      </Alert>
    );
  }

  if (licenses.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="error">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <div className="font-semibold">No Active Licenses Available</div>
            <div className="text-sm mt-1">
              This mining company has no active export licenses. You must obtain a license before creating exports.
            </div>
          </div>
        </Alert>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.open('/licenses/requests/new', '_blank')}
        >
          <FileText className="w-4 h-4 mr-2" />
          Apply for License
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export License <span className="text-red-600">*</span>
        </label>
        <Select
          value={selectedLicenseId || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          required
        >
          <option value="">Select a license</option>
          {licenses.map((license) => (
            <option key={license.id} value={license.id}>
              {getLicenseDisplay(license)}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            {licenses.length} active {licenses.length === 1 ? 'license' : 'licenses'} available
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open('/licenses', '_blank')}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View All
          </Button>
        </div>
      </div>

      {validation && (
        <div className="space-y-3">
          {validation.valid ? (
            <Alert variant="success">
              <CheckCircle className="w-5 h-5" />
              <div>
                <div className="font-semibold">License Valid</div>
                {validation.license && (
                  <div className="text-sm mt-1">
                    After this export: {(validation.license.remaining_qty_oz - exportQuantityOz).toFixed(3)} oz remaining
                    ({((validation.license.remaining_qty_oz - exportQuantityOz) / validation.license.authorized_qty_oz * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
            </Alert>
          ) : (
            <Alert variant="error">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <div className="font-semibold">Cannot Proceed with Export</div>
                <ul className="text-sm mt-2 space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {validation.warnings && validation.warnings.length > 0 && (
            <Alert variant="warning">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <div className="font-semibold">Warnings</div>
                <ul className="text-sm mt-2 space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}

          {validation.suggestedLicenses && validation.suggestedLicenses.length > 0 && !validation.valid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-blue-900 mb-2">
                Suggested Alternative Licenses
              </div>
              <div className="space-y-2">
                {validation.suggestedLicenses.slice(0, 3).map((license) => (
                  <div key={license.id} className="text-sm text-blue-800">
                    <span className="font-mono">{license.license_number}</span>
                    {' - '}
                    <span>{license.remaining_qty_oz.toFixed(3)} oz available</span>
                    {' - '}
                    <span>Expires {license.expiry_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
