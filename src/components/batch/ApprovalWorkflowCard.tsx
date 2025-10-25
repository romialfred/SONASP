import { Clock, CheckCircle, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface Approval {
  id: string;
  approval_type: string;
  approval_level: number;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  request_description: string;
  requested_at: string;
  requested_by_user?: {
    full_name: string;
  };
  approved_by_user?: {
    full_name: string;
  };
  approved_at?: string;
  comments?: string;
  rejection_reason?: string;
}

interface ApprovalWorkflowCardProps {
  approvals: Approval[];
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
  canApprove?: boolean;
}

export function ApprovalWorkflowCard({
  approvals,
  onApprove,
  onReject,
  canApprove = false,
}: ApprovalWorkflowCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'escalated':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'border-green-300 bg-green-50';
      case 'rejected':
        return 'border-red-300 bg-red-50';
      case 'escalated':
        return 'border-orange-300 bg-orange-50';
      default:
        return 'border-yellow-300 bg-yellow-50';
    }
  };

  const getApprovalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      status_change: 'Status Change',
      variance: 'Variance Resolution',
      quality: 'Quality Override',
      sale: 'Sale Authorization',
      split: 'Batch Split',
      merge: 'Batch Merge',
      hold_release: 'Hold Release',
      custom: 'Custom',
    };
    return labels[type] || type;
  };

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const completedApprovals = approvals.filter(a => a.status !== 'pending');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-600" />
          Approval Workflow
          {pendingApprovals.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
              {pendingApprovals.length} Pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p>No approvals required</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApprovals.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pending Approvals
                </p>
                {pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className={`border-l-4 p-4 rounded-r-lg ${getStatusColor(approval.status)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(approval.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {getApprovalTypeLabel(approval.approval_type)}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-600 text-white">
                              Level {approval.approval_level}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 mb-2">
                            {approval.request_description}
                          </p>
                          <div className="text-xs text-gray-600 space-y-1">
                            <p>
                              Requested by {approval.requested_by_user?.full_name || 'Unknown'}
                            </p>
                            <p>
                              {new Date(approval.requested_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      {canApprove && onApprove && onReject && (
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onApprove(approval.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onReject(approval.id)}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedApprovals.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Approval History</p>
                {completedApprovals.map((approval, index) => (
                  <div
                    key={approval.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex flex-col items-center">
                      <div className="p-2 bg-white rounded-full shadow-sm">
                        {getStatusIcon(approval.status)}
                      </div>
                      {index < completedApprovals.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-300 my-1" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {getApprovalTypeLabel(approval.approval_type)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          approval.status === 'approved' ? 'bg-green-600 text-white' :
                          approval.status === 'rejected' ? 'bg-red-600 text-white' :
                          'bg-orange-600 text-white'
                        }`}>
                          {approval.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        {approval.request_description}
                      </p>
                      <div className="text-xs text-gray-600 space-y-1">
                        {approval.approved_by_user && (
                          <p>
                            {approval.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                            {approval.approved_by_user.full_name}
                          </p>
                        )}
                        {approval.approved_at && (
                          <p>{new Date(approval.approved_at).toLocaleString()}</p>
                        )}
                        {approval.comments && (
                          <p className="text-gray-700 italic mt-1">"{approval.comments}"</p>
                        )}
                        {approval.rejection_reason && (
                          <p className="text-red-600 mt-1">
                            Reason: {approval.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
