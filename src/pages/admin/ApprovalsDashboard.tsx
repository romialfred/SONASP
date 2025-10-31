import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertBox } from '@/components/dashboard/AlertBox';
import { ApprovalRequestCard } from '@/components/approval/ApprovalRequestCard';
import { SalesApprovalCard } from '@/components/approval/SalesApprovalCard';
import { SalesApprovalWorkflowPanel } from '@/components/sales/SalesApprovalWorkflowPanel';
import { supabase } from '@/lib/supabase';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

export function ApprovalsDashboard() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedSale, setSelectedSale] = useState<any>(null);

  useEffect(() => {
    loadApprovals();
  }, [filter]);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('approval_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setApprovals(data || []);

      // Auto-select first pending sale for workflow display
      const firstPendingSale = data?.find(a => a.status === 'pending' && a.approval_type === 'sale');
      if (firstPendingSale && !selectedSale) {
        const { data: saleData } = await supabase
          .from('sales')
          .select('status')
          .eq('id', firstPendingSale.entity_id)
          .maybeSingle();

        if (saleData) {
          setSelectedSale(saleData);
        }
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            Approval Requests
          </h1>
          <p className="text-gray-600 mt-1">
            Review and approve pending requests
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {pendingCount > 0 && filter === 'pending' && (
          <AlertBox
            type="warning"
            title="Pending Approvals"
            message={`You have ${pendingCount} pending approval${pendingCount !== 1 ? 's' : ''} requiring your attention.`}
          />
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Approval Requests</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Rejected
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="text-gray-600">Loading approvals...</div>
              </div>
            ) : approvals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No {filter !== 'all' ? filter : ''} approval requests found</p>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Left Column: Approval Cards */}
                <div className="flex-1 space-y-4 min-w-0">
                  {approvals.map((approval) => (
                    approval.approval_type === 'sale' ? (
                      <SalesApprovalCard
                        key={approval.id}
                        approval={approval}
                        onApproved={loadApprovals}
                        onRejected={loadApprovals}
                      />
                    ) : (
                      <ApprovalRequestCard
                        key={approval.id}
                        approval={approval}
                        onApproved={loadApprovals}
                        onRejected={loadApprovals}
                      />
                    )
                  ))}
                </div>

                {/* Right Panel: Workflow Visualizer (only for sales) */}
                {selectedSale && filter === 'pending' && (
                  <div className="hidden xl:block w-96 flex-shrink-0">
                    <div className="sticky top-6">
                      <SalesApprovalWorkflowPanel
                        currentStatus={selectedSale.status}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
