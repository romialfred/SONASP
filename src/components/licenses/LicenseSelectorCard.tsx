import { useState, useEffect } from 'react';
import { AlertCircle, Calendar, TrendingDown, CheckCircle, FileText, Building2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { supabase } from '@/lib/supabase';

interface License {
  id: string;
  license_number: string;
  license_type: string;
  applicant_mine_id: string;
  applicant_company_name: string;
  mining_company_name: string;
  mining_company_code: string;
  issue_date: string;
  start_date: string | null;
  expiry_date: string;
  authorized_qty_oz: number;
  reserved_qty_oz: number;
  consumed_qty_oz: number;
  remaining_qty_oz: number;
  remaining_percentage: number;
  status: string;
  issuer_country: string;
  theoretical_price_usd_per_oz: number | null;
  days_until_expiry: number;
  is_expiring_soon: boolean;
  is_low_quantity: boolean;
}

interface LicenseSelectorCardProps {
  selectedLicenseId: string;
  onLicenseChange: (licenseId: string, license: License | null) => void;
  miningCompanyId: string | null;
  disabled?: boolean;
  requiredQuantityOz?: number;
}

export function LicenseSelectorCard({
  selectedLicenseId,
  onLicenseChange,
  miningCompanyId,
  disabled = false,
  requiredQuantityOz = 0
}: LicenseSelectorCardProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

  useEffect(() => {
    if (miningCompanyId) {
      loadLicenses();
    } else {
      setLicenses([]);
      setSelectedLicense(null);
    }
  }, [miningCompanyId]);

  useEffect(() => {
    if (selectedLicenseId && licenses.length > 0) {
      const license = licenses.find(l => l.id === selectedLicenseId);
      setSelectedLicense(license || null);
    } else {
      setSelectedLicense(null);
    }
  }, [selectedLicenseId, licenses]);

  const loadLicenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_active_licenses')
        .select('*')
        .eq('applicant_mine_id', miningCompanyId)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Error loading licenses:', error);
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLicenseChange = (licenseId: string) => {
    const license = licenses.find(l => l.id === licenseId);
    setSelectedLicense(license || null);
    onLicenseChange(licenseId, license || null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(num);
  };

  const getStatusColor = (license: License) => {
    if (license.is_expiring_soon) return 'text-orange-600';
    if (license.is_low_quantity) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusBadgeColor = (license: License) => {
    if (license.is_expiring_soon) return 'bg-orange-100 text-orange-800';
    if (license.is_low_quantity) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const hasInsufficientQuantity = selectedLicense && requiredQuantityOz > selectedLicense.remaining_qty_oz;

  if (!miningCompanyId) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <Building2 className="w-5 h-5" />
          <p className="text-sm">Veuillez d'abord sélectionner une société minière</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-gray-900">Licence d'Exportation</h3>
          </div>
          {selectedLicense && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(selectedLicense)}`}>
              {selectedLicense.status}
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner une Licence <span className="text-red-500">*</span>
          </label>
          <Select
            value={selectedLicenseId}
            onChange={(e) => handleLicenseChange(e.target.value)}
            disabled={disabled || loading || licenses.length === 0}
            className="w-full"
          >
            <option value="">-- Choisir une licence --</option>
            {licenses.map((license) => (
              <option key={license.id} value={license.id}>
                {license.license_number} - {formatNumber(license.remaining_qty_oz)} oz disponibles
                {license.is_expiring_soon && ' (⚠️ Expire bientôt)'}
                {license.is_low_quantity && ' (⚠️ Quantité faible)'}
              </option>
            ))}
          </Select>

          {licenses.length === 0 && !loading && (
            <p className="mt-2 text-sm text-amber-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Aucune licence active disponible pour cette société minière
            </p>
          )}
        </div>

        {selectedLicense && (
          <div className="mt-6 space-y-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Date d'Expiration
                  </span>
                </div>
                <p className={`text-lg font-semibold ${selectedLicense.is_expiring_soon ? 'text-orange-600' : 'text-gray-900'}`}>
                  {formatDate(selectedLicense.expiry_date)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dans {selectedLicense.days_until_expiry} jour{selectedLicense.days_until_expiry > 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Numéro de Licence
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedLicense.license_number}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Émise le {formatDate(selectedLicense.issue_date)}
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700">Quantités Autorisées</h4>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Quantité Initiale</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatNumber(selectedLicense.authorized_qty_oz)} oz
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Quantité Consommée</span>
                  <span className="text-sm font-medium text-gray-700">
                    {formatNumber(selectedLicense.consumed_qty_oz)} oz
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Quantité Réservée</span>
                  <span className="text-sm font-medium text-gray-700">
                    {formatNumber(selectedLicense.reserved_qty_oz)} oz
                  </span>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">Quantité Restante</span>
                    <span className={`text-base font-bold ${getStatusColor(selectedLicense)}`}>
                      {formatNumber(selectedLicense.remaining_qty_oz)} oz
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        selectedLicense.remaining_percentage < 20
                          ? 'bg-red-500'
                          : selectedLicense.remaining_percentage < 50
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${selectedLicense.remaining_percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {selectedLicense.remaining_percentage.toFixed(1)}% disponible
                  </p>
                </div>

                {requiredQuantityOz > 0 && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    hasInsufficientQuantity
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      {hasInsufficientQuantity ? (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          hasInsufficientQuantity ? 'text-red-900' : 'text-blue-900'
                        }`}>
                          Quantité Requise: {formatNumber(requiredQuantityOz)} oz
                        </p>
                        {hasInsufficientQuantity ? (
                          <p className="text-xs text-red-700 mt-1">
                            ⚠️ Quantité insuffisante. Il manque {formatNumber(requiredQuantityOz - selectedLicense.remaining_qty_oz)} oz.
                          </p>
                        ) : (
                          <p className="text-xs text-blue-700 mt-1">
                            ✓ Quantité suffisante disponible
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedLicense.is_expiring_soon && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">
                      Attention: Licence expire bientôt
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      Cette licence expirera dans {selectedLicense.days_until_expiry} jours. Assurez-vous de compléter l'expédition avant la date d'expiration.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedLicense.is_low_quantity && !hasInsufficientQuantity && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <TrendingDown className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">
                      Quantité faible
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Il ne reste que {selectedLicense.remaining_percentage.toFixed(1)}% de la quantité initiale ({formatNumber(selectedLicense.remaining_qty_oz)} oz).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
