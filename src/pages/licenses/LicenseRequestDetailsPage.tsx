import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  Package,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  Download,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/TextArea';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { licenseRequestService } from '@/services/licenseRequestService';
import type { LicenseRequest, LicenseRequestStatus } from '@/types/license';

interface LicenseRequestDetailed extends LicenseRequest {
  mine_code?: string;
  mine_country?: string;
  has_license?: boolean;
  license_id?: string;
  license_number?: string;
  license_status?: string;
  document_count?: number;
}

export default function LicenseRequestDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [request, setRequest] = useState<LicenseRequestDetailed | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Form data
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [certificationText, setCertificationText] = useState(
    'I certify that the information provided in this license request is accurate and complete.'
  );
  const [reviewComments, setReviewComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (id) {
      loadRequest();
      loadUserRole();
    }
  }, [id]);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('v_license_requests_detailed')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setRequest(data);
    } catch (error: any) {
      console.error('Error loading request:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const handleSubmit = async () => {
    if (!request || !signatoryName.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setActionLoading(true);
      await licenseRequestService.submitRequest(request.id, {
        applicant_signatory_name: signatoryName,
        applicant_signatory_title: signatoryTitle || undefined,
        applicant_certification_text: certificationText,
      });

      alert('License request submitted successfully!');
      setShowSubmitModal(false);
      await loadRequest();
    } catch (error: any) {
      console.error('Error submitting request:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartReview = async () => {
    if (!request) return;

    try {
      setActionLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('license_requests')
        .update({
          status: 'IN_REVIEW',
          reviewer_id: user.id,
          reviewer_name: profile?.full_name || 'Reviewer',
          review_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .eq('status', 'SUBMITTED');

      if (error) throw error;

      alert('Review started successfully!');
      await loadRequest();
    } catch (error: any) {
      console.error('Error starting review:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;

    try {
      setActionLoading(true);
      await licenseRequestService.reviewRequest(request.id, {
        approved: true,
        review_comments: reviewComments || undefined,
      });

      alert('License request approved!');
      setShowReviewModal(false);
      await loadRequest();
    } catch (error: any) {
      console.error('Error approving request:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setActionLoading(true);
      await licenseRequestService.reviewRequest(request.id, {
        approved: false,
        rejection_reason: rejectionReason,
      });

      alert('License request rejected');
      setShowRejectModal(false);
      await loadRequest();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!request) return;

    if (!confirm('Are you sure you want to delete this license request?')) {
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('license_requests')
        .delete()
        .eq('id', request.id)
        .eq('status', 'DRAFT');

      if (error) throw error;

      alert('License request deleted');
      navigate('/licenses/requests');
    } catch (error: any) {
      console.error('Error deleting request:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '0.000';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(num);
  };

  const getStatusColor = (status: LicenseRequestStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'SUBMITTED':
        return 'info';
      case 'IN_REVIEW':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return 'default';
    }
  };

  const canSubmit = request?.status === 'DRAFT';
  const canStartReview = request?.status === 'SUBMITTED' && userRole === 'management';
  const canReview = request?.status === 'IN_REVIEW' && userRole === 'management';
  const canConvert = request?.status === 'APPROVED' && !request?.has_license;
  const canEdit = request?.status === 'DRAFT';
  const canDelete = request?.status === 'DRAFT';

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!request) {
    return (
      <MainLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-500">License request not found</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
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
                Demande de Licence d'Exportation
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {request.request_number} - {request.title || 'Sans titre'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge
              status={request.status}
              variant={getStatusColor(request.status)}
            />
          </div>
        </div>

        {/* Alerts */}
        {request.has_license && (
          <Card className="mb-6 p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Convertie en Licence Active</p>
                <p className="text-sm text-green-700">
                  Licence #{request.license_number} - Status: {request.license_status}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/licenses/${request.license_id}`)}
                  className="mt-2"
                >
                  Voir la Licence
                </Button>
              </div>
            </div>
          </Card>
        )}

        {request.status === 'REJECTED' && request.rejection_reason && (
          <Card className="mb-6 p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Demande Rejetée</p>
                <p className="text-sm text-red-700">{request.rejection_reason}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Détails de la Demande
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Numéro de Demande</label>
                  <p className="font-mono text-blue-600 font-medium">
                    {request.request_number || 'En attente'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Date de Demande</label>
                  <p className="font-medium text-gray-900">{formatDate(request.request_date)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Titre</label>
                  <p className="font-medium text-gray-900">{request.title || 'Sans titre'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Priorité</label>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      request.priority === 'URGENT'
                        ? 'bg-red-100 text-red-800'
                        : request.priority === 'HIGH'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {request.priority}
                  </span>
                </div>
              </div>
            </Card>

            {/* Mining Company */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-gray-900">Société Minière</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Nom</label>
                  <p className="font-medium text-gray-900">{request.mine_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Code</label>
                  <p className="font-mono text-gray-900">{request.mine_code || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-gray-600">Pays</label>
                  <p className="font-medium text-gray-900">{request.mine_country || 'N/A'}</p>
                </div>
              </div>
            </Card>

            {/* Planned Export */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-gray-900">Exportation Planifiée</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Quantité Demandée</label>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatNumber(request.planned_quantity_oz)} oz
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Période</label>
                  <p className="font-medium text-gray-900">
                    {formatDate(request.planned_start_date)} <br />
                    au {formatDate(request.planned_end_date)}
                  </p>
                </div>
              </div>

              {request.comments && (
                <div className="mt-4">
                  <label className="text-sm text-gray-600">Commentaires</label>
                  <p className="text-gray-700 mt-1">{request.comments}</p>
                </div>
              )}
            </Card>

            {/* Signature & Review Info */}
            {(request.applicant_signatory_name || request.reviewer_name) && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Informations de Signature et Revue
                </h2>

                {request.applicant_signatory_name && (
                  <div className="mb-4 pb-4 border-b">
                    <h3 className="font-medium text-gray-700 mb-2">Signataire Demandeur</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Nom</label>
                        <p className="font-medium text-gray-900">
                          {request.applicant_signatory_name}
                        </p>
                      </div>
                      {request.applicant_signatory_title && (
                        <div>
                          <label className="text-sm text-gray-600">Titre</label>
                          <p className="font-medium text-gray-900">
                            {request.applicant_signatory_title}
                          </p>
                        </div>
                      )}
                      {request.applicant_signature_date && (
                        <div>
                          <label className="text-sm text-gray-600">Date de Signature</label>
                          <p className="font-medium text-gray-900">
                            {formatDate(request.applicant_signature_date)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {request.reviewer_name && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Réviseur</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Nom</label>
                        <p className="font-medium text-gray-900">{request.reviewer_name}</p>
                      </div>
                      {request.review_date && (
                        <div>
                          <label className="text-sm text-gray-600">Date de Revue</label>
                          <p className="font-medium text-gray-900">
                            {formatDate(request.review_date)}
                          </p>
                        </div>
                      )}
                    </div>
                    {request.review_comments && (
                      <div className="mt-3">
                        <label className="text-sm text-gray-600">Commentaires de Revue</label>
                        <p className="text-gray-700 mt-1">{request.review_comments}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-2">
                {canEdit && (
                  <Button
                    className="w-full flex items-center justify-center gap-2"
                    variant="secondary"
                    onClick={() => navigate(`/licenses/requests/${request.id}/edit`)}
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </Button>
                )}

                {canSubmit && (
                  <Button
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    <Send className="w-4 h-4" />
                    Soumettre pour Revue
                  </Button>
                )}

                {canStartReview && (
                  <Button
                    className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700"
                    onClick={handleStartReview}
                    disabled={actionLoading}
                  >
                    <Eye className="w-4 h-4" />
                    Commencer la Revue
                  </Button>
                )}

                {canReview && (
                  <>
                    <Button
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() => setShowReviewModal(true)}
                      disabled={actionLoading}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approuver
                    </Button>
                    <Button
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700"
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeter
                    </Button>
                  </>
                )}

                {canConvert && (
                  <Button
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => navigate(`/licenses/requests/${request.id}/approve`)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Convertir en Licence
                  </Button>
                )}

                {canDelete && (
                  <Button
                    className="w-full flex items-center justify-center gap-2"
                    variant="secondary"
                    onClick={handleDelete}
                    disabled={actionLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </Button>
                )}
              </div>
            </Card>

            {/* Status Info */}
            <Card className="p-6 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Informations Système</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Créé le:</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(request.created_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Modifié le:</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(request.updated_at)}
                  </span>
                </div>
                {request.document_count !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Documents:</span>
                    <span className="font-medium text-gray-900">{request.document_count}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Submit Modal */}
        <Modal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Soumettre la Demande"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Avant de soumettre cette demande, veuillez fournir les informations de signature.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom du Signataire <span className="text-red-500">*</span>
              </label>
              <Input
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre du Signataire
              </label>
              <Input
                value={signatoryTitle}
                onChange={(e) => setSignatoryTitle(e.target.value)}
                placeholder="Directeur Général"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texte de Certification
              </label>
              <TextArea
                value={certificationText}
                onChange={(e) => setCertificationText(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={actionLoading || !signatoryName.trim()}>
                {actionLoading ? 'Envoi...' : 'Soumettre'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Approve Modal */}
        <Modal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title="Approuver la Demande"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Approuver cette demande permettra de la convertir en licence d'exportation active.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commentaires (optionnel)
              </label>
              <TextArea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                rows={3}
                placeholder="Notes ou commentaires sur l'approbation..."
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading ? 'Approbation...' : 'Approuver'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Reject Modal */}
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Rejeter la Demande"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Veuillez fournir une raison détaillée pour le rejet de cette demande.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Raison du Rejet <span className="text-red-500">*</span>
              </label>
              <TextArea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Expliquer pourquoi cette demande est rejetée..."
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? 'Rejet...' : 'Rejeter'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
