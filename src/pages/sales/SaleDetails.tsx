import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle, XCircle, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Timeline } from '@/components/batch/Timeline';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatWeight } from '@/utils/salesUtils';

interface EmailLog {
  id: string;
  type: 'sent' | 'received';
  subject: string;
  timestamp: string;
  status: 'delivered' | 'opened' | 'clicked';
}

export function SaleDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

  const sale = {
    id: id || '1',
    saleNumber: 'SL-2024-042',
    status: 'approved',
    customer: {
      name: 'Premium Gold Ltd.',
      email: 'contact@premiumgold.com',
      country: 'Switzerland',
      phone: '+41 44 123 4567',
    },
    batch: {
      number: 'BT-2024-016',
      weight: 1320.5,
    },
    quantity: 42.5,
    londonAMRate: 2450.0,
    freightCost: 250.0,
    otherCosts: 100.0,
    grossProceeds: 104125.0,
    totalCosts: 350.0,
    netProceeds: 103775.0,
    royalties: 3113.25,
    finalProceeds: 100661.75,
    createdBy: 'John Doe',
    createdDate: '2024-10-20T10:30:00',
    approvedBy: 'Management Team',
    approvedDate: '2024-10-21T14:15:00',
  };

  const statusHistory = [
    {
      id: '1',
      status: 'created',
      title: 'Sale Created',
      description: `Created by ${sale.createdBy}`,
      timestamp: sale.createdDate,
      icon: Clock,
      iconColor: 'bg-blue-500',
    },
    {
      id: '2',
      status: 'approved',
      title: 'Management Approved',
      description: `Approved by ${sale.approvedBy}`,
      timestamp: sale.approvedDate,
      icon: CheckCircle,
      iconColor: 'bg-accent-500',
    },
    {
      id: '3',
      status: 'customer_notified',
      title: 'Customer Notified',
      description: 'Email sent to customer for approval',
      timestamp: '2024-10-21T14:20:00',
      icon: Mail,
      iconColor: 'bg-primary-500',
    },
  ];

  const emailLogs: EmailLog[] = [
    {
      id: '1',
      type: 'sent',
      subject: 'Sale Approval Required - SL-2024-042',
      timestamp: '2024-10-21T14:20:00',
      status: 'opened',
    },
    {
      id: '2',
      type: 'sent',
      subject: 'Reminder: Sale Approval Pending',
      timestamp: '2024-10-22T10:00:00',
      status: 'delivered',
    },
  ];

  const handleApproval = (action: 'approve' | 'reject') => {
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const confirmApproval = () => {
    setShowApprovalModal(false);
    navigate('/sales');
  };

  const statusConfig = {
    pending: { label: 'Pending Approval', variant: 'warning' as const },
    approved: { label: 'Management Approved', variant: 'info' as const },
    customer_approved: { label: 'Customer Approved', variant: 'success' as const },
    payment_received: { label: 'Payment Received', variant: 'success' as const },
    completed: { label: 'Completed', variant: 'success' as const },
  };

  const currentStatus = statusConfig[sale.status as keyof typeof statusConfig];

  return (
    <MainLayout userRole="management">
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/sales')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Sale {sale.saleNumber}
            </h1>
            <p className="text-gray-600 mt-1">View complete sale details and status</p>
          </div>
          <StatusBadge label={currentStatus.label} variant={currentStatus.variant} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Sale Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Sale Number</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">{sale.saleNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Batch Number</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">{sale.batch.number}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Quantity</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {sale.quantity.toFixed(3)} oz ({formatWeight(sale.batch.weight, 'g')})
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Created Date</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {new Date(sale.createdDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">London AM Rate</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(sale.londonAMRate)} per oz
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Gross Proceeds</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(sale.grossProceeds)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Freight Cost</span>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(sale.freightCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Other Costs</span>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(sale.otherCosts)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Net Proceeds</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(sale.netProceeds)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Net Smelted Royalties (3%)</span>
                    <span className="text-sm font-semibold text-red-600">
                      -{formatCurrency(sale.royalties)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-primary-50 rounded-lg px-3 mt-2">
                    <span className="text-base font-bold text-gray-900">Final Proceeds</span>
                    <span className="text-base font-bold text-primary-700">
                      {formatCurrency(sale.finalProceeds)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Communication Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{log.subject}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge
                        label={log.status}
                        variant={log.status === 'opened' ? 'success' : 'info'}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Company Name</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">{sale.customer.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-sm text-gray-900 mt-1">{sale.customer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Phone</p>
                    <p className="text-sm text-gray-900 mt-1">{sale.customer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Country</p>
                    <p className="text-sm text-gray-900 mt-1">{sale.customer.country}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/customers/${sale.id}`)}
                    className="w-full mt-2"
                  >
                    View Customer Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline items={statusHistory} />
              </CardContent>
            </Card>

            {sale.status === 'pending' && (
              <Card>
                <CardHeader>
                  <CardTitle>Management Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button
                      onClick={() => handleApproval('approve')}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve Sale
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApproval('reject')}
                      className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Sale
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={approvalAction === 'approve' ? 'Approve Sale' : 'Reject Sale'}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {approvalAction === 'approve'
              ? 'Are you sure you want to approve this sale? An email will be sent to the customer for their approval.'
              : 'Are you sure you want to reject this sale? This action cannot be undone.'}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApproval}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
