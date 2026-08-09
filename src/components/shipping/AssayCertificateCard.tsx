import { FileText, Eye, Calendar, Scale, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AssayCertificateCardProps {
  certificate: {
    id: string;
    file_name?: string;
    certificate_date?: string | null;
    approval_status?: 'pending' | 'approved' | 'rejected';
    parsed_data?: {
      laboratory_name?: string;
      sample_weight_g?: number;
      gold_purity_percentage?: number;
    } | null;
  };
  onView?: (certificateId: string) => void;
  showActions?: boolean;
}

export function AssayCertificateCard({
  certificate,
  onView,
  showActions = true,
}: AssayCertificateCardProps) {
  const getStatusBadge = () => {
    switch (certificate.approval_status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
            Waiting for approval
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg">
            <FileText className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <p className="font-medium text-gray-900">
                {certificate.parsed_data?.laboratory_name
                  ? certificate.parsed_data.laboratory_name.substring(0, 100) + (certificate.parsed_data.laboratory_name.length > 100 ? '...' : '')
                  : 'Laboratory N/A'}
              </p>
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {certificate.parsed_data?.sample_weight_g && (
                <span className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5" />
                  {certificate.parsed_data.sample_weight_g.toFixed(2)}g
                </span>
              )}
              {certificate.parsed_data?.gold_purity_percentage && (
                <span className="flex items-center gap-1">
                  Au: {certificate.parsed_data.gold_purity_percentage.toFixed(2)}%
                </span>
              )}
              {certificate.certificate_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(certificate.certificate_date).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showActions && onView && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(certificate.id)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Voir
          </Button>
        </div>
      )}
    </div>
  );
}
