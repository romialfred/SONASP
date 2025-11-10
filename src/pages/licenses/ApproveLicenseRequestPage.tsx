import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Calendar, Building2, CheckCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';

interface LicenseRequest {
  id: string;
  request_number: string;
  title: string;
  mine_id: string;
  mine_name: string;
  mine_code: string;
  mine_country: string;
  request_date: string;
  planned_quantity_oz: number;
  planned_start_date: string;
  planned_end_date: string;
  justification: string;
  status: string;
  has_license: boolean;
  license_id: string | null;
  license_number: string | null;
}

export default function ApproveLicenseRequestPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [request, setRequest] = useState<LicenseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [licenseNumber, setLicenseNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [issuerSignatory, setIssuerSignatory] = useState('Minister of Mines');

  useEffect(() => {
    if (id) {
      loadRequest();
    }
  }, [id]);

  useEffect(() => {
    if (request && !licenseNumber) {
      generateLicenseNumber();
    }
  }, [request]);

  useEffect(() => {
    // Auto-calculate expiry date (90 days from issue date)
    if (issueDate) {
      const issue = new Date(issueDate);
      const expiry = new Date(issue);
      expiry.setDate(expiry.getDate() + 90);
      setExpiryDate(expiry.toISOString().split('T')[0]);
    }
  }, [issueDate]);

  const loadRequest = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('v_approved_license_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!data) {
        alert('License request not found');
        navigate('/licenses/requests');
        return;
      }

      if (data.has_license) {
        alert('This request has already been converted to a license');
        navigate(`/licenses/${data.license_id}`);
        return;
      }

      setRequest(data);
    } catch (error: any) {
      console.error('Error loading request:', error);
      alert(`Error loading request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateLicenseNumber = async () => {
    if (!request) return;

    try {
      const { data, error } = await supabase
        .rpc('generate_license_number', {
          p_country: request.mine_country
        });

      if (error) throw error;
      setLicenseNumber(data || '');
    } catch (error: any) {
      console.error('Error generating license number:', error);
      // Fallback to manual generation
      const year = new Date().getFullYear();
      const country = request.mine_country || 'GN';
      setLicenseNumber(`LIC-${year}-${country}-0001`);
    }
  };

  const handleApprove = async () => {
    if (!request) return;

    if (!licenseNumber.trim()) {
      alert('Please enter a license number');
      return;
    }

    if (!issueDate) {
      alert('Please select an issue date');
      return;
    }

    if (!expiryDate) {
      alert('Please select an expiry date');
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .rpc('approve_license_request', {
          p_request_id: request.id,
          p_license_number: licenseNumber,
          p_issue_date: issueDate,
          p_expiry_date: expiryDate,
          p_issuer_signatory: issuerSignatory
        });

      if (error) throw error;

      alert('License created successfully!');
      navigate(`/licenses/${data}`);
    } catch (error: any) {
      console.error('Error creating license:', error);
      alert(`Error creating license: ${error.message}`);
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-500">Chargement...</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!request) {
    return (
      <MainLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-500">Demande non trouvée</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/licenses/requests')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Convertir en Licence Active
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Créer une licence d'exportation à partir d'une demande approuvée
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* License Request Info */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">
                  Demande Approuvée
                </h3>
                <p className="text-sm text-blue-700">
                  {request.request_number} - {request.title || 'Sans titre'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <span className="text-sm text-blue-700">Société Minière:</span>
                <p className="font-medium text-blue-900">
                  {request.mine_name} ({request.mine_code})
                </p>
              </div>
              <div>
                <span className="text-sm text-blue-700">Pays:</span>
                <p className="font-medium text-blue-900">{request.mine_country}</p>
              </div>
              <div>
                <span className="text-sm text-blue-700">Date de demande:</span>
                <p className="font-medium text-blue-900">
                  {formatDate(request.request_date)}
                </p>
              </div>
              <div>
                <span className="text-sm text-blue-700">Quantité demandée:</span>
                <p className="font-medium text-blue-900">
                  {formatNumber(request.planned_quantity_oz)} oz
                </p>
              </div>
            </div>
          </Card>

          {/* License Details Form */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Détails de la Licence
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de Licence <span className="text-red-500">*</span>
                </label>
                <Input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Ex: LIC-2025-GN-0001"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Format: LIC-ANNÉE-PAYS-SÉQUENCE
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'Émission <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date d'Expiration <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Par défaut: 90 jours après l'émission
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signataire Émetteur <span className="text-red-500">*</span>
                </label>
                <Input
                  value={issuerSignatory}
                  onChange={(e) => setIssuerSignatory(e.target.value)}
                  placeholder="Ex: Minister of Mines"
                  className="w-full"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Récapitulatif de la Licence
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Numéro:</span>
                    <span className="font-medium text-gray-900">{licenseNumber || 'Non défini'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantité Autorisée:</span>
                    <span className="font-medium text-gray-900">
                      {formatNumber(request.planned_quantity_oz)} oz
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Période de Validité:</span>
                    <span className="font-medium text-gray-900">
                      {issueDate && expiryDate
                        ? `${Math.ceil((new Date(expiryDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24))} jours`
                        : 'Non définie'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Statut Initial:</span>
                    <span className="font-medium text-green-600">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/licenses/requests')}
            >
              Annuler
            </Button>
            <Button
              onClick={handleApprove}
              disabled={saving || !licenseNumber || !issueDate || !expiryDate}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Création...' : 'Créer la Licence'}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
