import type { ExportLicense } from '@/services/exportLicenseService';
import { isExportLicenseSelectable } from '@/services/exportLicenseService';

interface ShippingLicenseSelectProps {
  companyId: string;
  licenses: ExportLicense[];
  value: string;
  loading?: boolean;
  onChange: (licenseId: string) => void;
}

export function ShippingLicenseSelect({
  companyId,
  licenses,
  value,
  loading = false,
  onChange,
}: ShippingLicenseSelectProps) {
  const selectableLicenses = licenses.filter((license) =>
    isExportLicenseSelectable(license, companyId));

  return (
    <div>
      <label htmlFor="shipping-export-license" className="mb-2 block text-xs font-semibold text-green-900">
        Export licence *
      </label>
      <select
        id="shipping-export-license"
        value={selectableLicenses.some((license) => license.id === value) ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-green-500"
        disabled={loading || !companyId || selectableLicenses.length === 0}
      >
        <option value="">
          {!companyId
            ? 'Select a company first'
            : selectableLicenses.length === 0
              ? 'No active licence with available quota'
              : 'Select an export licence'}
        </option>
        {selectableLicenses.map((license) => (
          <option key={license.id} value={license.id}>
            {license.license_number} — Available: {license.remaining_quantity_grams.toLocaleString('en-GB')} g
            {' '}(Expires: {new Date(license.end_date).toLocaleDateString('en-GB')})
          </option>
        ))}
      </select>
      {companyId && selectableLicenses.length === 0 && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800" role="status">
          No active licence with available quota was found for this company.
        </div>
      )}
    </div>
  );
}
