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
        Licence d’exportation *
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
            ? 'Sélectionnez d’abord une société'
            : selectableLicenses.length === 0
              ? 'Aucune licence active avec un quota disponible'
              : 'Sélectionnez une licence d’exportation'}
        </option>
        {selectableLicenses.map((license) => (
          <option key={license.id} value={license.id}>
            {license.license_number} — Disponible : {license.remaining_quantity_grams.toLocaleString('fr-FR')} g
            {' '}(expire le {new Date(license.end_date).toLocaleDateString('fr-FR')})
          </option>
        ))}
      </select>
      {companyId && selectableLicenses.length === 0 && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800" role="status">
          Aucune licence active disposant d’un quota n’a été trouvée pour cette société.
        </div>
      )}
    </div>
  );
}
