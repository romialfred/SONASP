import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Table } from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { licenseService } from '@/services/licenseService';
import {
  FileText,
  Calendar,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Upload,
  Download,
  Activity,
  Package,
} from 'lucide-react';
import type { License, LicenseQuotaTransaction, LicenseEvent, LicenseEvaluation } from '@/types/license';

export function LicenseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [license, setLicense] = useState<License | null>(null);
  const [evaluation, setEvaluation] = useState<LicenseEvaluation | null>(null);
  const [transactions, setTransactions] = useState<LicenseQuotaTransaction[]>([]);
  const [events, setEvents] = useState<LicenseEvent[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      loadLicenseData();
    }
  }, [id]);

  const loadLicenseData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [licenseData, transactionsData, eventsData, batchesData] = await Promise.all([
        licenseService.getLicense(id),
        licenseService.getQuotaTransactions(id),
        licenseService.getLicenseEvents(id),
        loadAssociatedBatches(id),
      ]);

      setLicense(licenseData);
      setTransactions(transactionsData);
      setEvents(eventsData);
      setBatches(batchesData);

      const evaluationResult = await licenseService.evaluateLicense(licenseData);
      setEvaluation(evaluationResult);
    } catch (error) {
      console.error('Error loading license:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssociatedBatches = async (licenseId: string) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('batches')
        .select(`
          id,
          batch_number,
          created_at,
          status,
          weight_grams,
          weight_oz,
          origin_site,
          mining_companies (name)
        `)
        .eq('license_id', licenseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading batches:', error);
      return [];
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="text-center text-gray-500">Loading license details...</div>
        </div>
      </MainLayout>
    );
  }

  if (!license) {
    return (
      <MainLayout>
        <div className="p-8">
          <Card className="p-12 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">License Not Found</h3>
            <p className="text-gray-600 mb-6">The requested license could not be found.</p>
            <Button onClick={() => navigate('/licenses')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Licenses
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const getTrafficLightColor = (light: string) => {
    switch (light) {
      case 'GREEN':
        return 'bg-green-500';
      case 'YELLOW':
        return 'bg-yellow-500';
      case 'RED':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const transactionColumns: Column<LicenseQuotaTransaction>[] = [
    {
      key: 'transaction_date',
      label: 'Date',
      render: (_, tx) => (
        <div className="text-sm text-gray-600">
          {new Date(tx.transaction_date).toLocaleDateString()} {new Date(tx.transaction_date).toLocaleTimeString()}
        </div>
      ),
    },
    {
      key: 'transaction_type',
      label: 'Type',
      render: (type, tx) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
            type === 'CONSUME'
              ? 'bg-green-100 text-green-800'
              : type === 'RESERVE'
              ? 'bg-blue-100 text-blue-800'
              : type === 'RELEASE'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {tx.transaction_type}
        </span>
      ),
    },
    {
      key: 'quantity_oz',
      label: 'Quantity (oz)',
      render: (_, tx) => (
        <div className="text-right font-mono">
          {tx.transaction_type === 'CONSUME' || tx.transaction_type === 'RESERVE' ? '-' : '+'}
          {tx.quantity_oz.toFixed(3)}
        </div>
      ),
    },
    {
      key: 'remaining_qty_after',
      label: 'Remaining After',
      render: (_, tx) => (
        <div className="text-right font-mono font-semibold">{tx.remaining_qty_after.toFixed(3)}</div>
      ),
    },
    {
      key: 'batch_number',
      label: 'Batch',
      render: (_, tx) => <div className="text-sm text-gray-600">{tx.batch_number || '-'}</div>,
    },
    {
      key: 'performed_by_name',
      label: 'Performed By',
      render: (_, tx) => (
        <div className="text-sm text-gray-600">{tx.performed_by_name || 'System'}</div>
      ),
    },
  ];

  const eventColumns: Column<LicenseEvent>[] = [
    {
      key: 'event_at',
      label: 'Time',
      render: (_, event) => (
        <div className="text-sm text-gray-600">
          {new Date(event.event_at).toLocaleDateString()} {new Date(event.event_at).toLocaleTimeString()}
        </div>
      ),
    },
    {
      key: 'event_type',
      label: 'Event',
      render: (_, event) => (
        <div>
          <div className="font-medium text-gray-900">{event.event_type}</div>
          <div className="text-sm text-gray-600">{event.event_description}</div>
        </div>
      ),
    },
    {
      key: 'user_name',
      label: 'User',
      render: (_, event) => (
        <div className="text-sm text-gray-600">{event.user_name || 'System'}</div>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6">
          <Button variant="secondary" onClick={() => navigate('/licenses')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Licenses
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <Card className="col-span-2 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{license.license_number}</h1>
                <p className="text-gray-600">{license.applicant_company_name}</p>
              </div>
              <StatusBadge
                status={license.status}
                variant={
                  license.status === 'ACTIVE'
                    ? 'success'
                    : license.status === 'EXPIRED'
                    ? 'error'
                    : 'default'
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Applicant Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600">Signatory:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">
                      {license.applicant_signatory}
                    </span>
                  </div>
                  {license.applicant_signatory_title && (
                    <div>
                      <span className="text-sm text-gray-600">Title:</span>
                      <span className="ml-2 text-sm text-gray-900">
                        {license.applicant_signatory_title}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Issuer Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600">Organization:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">
                      {license.issuer_organization}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Signatory:</span>
                    <span className="ml-2 text-sm text-gray-900">{license.issuer_signatory}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Country:</span>
                    <span className="ml-2 text-sm text-gray-900">{license.issuer_country}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Important Dates</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Requested:</span>
                    <span className="ml-2 text-sm text-gray-900">{license.request_date}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Issued:</span>
                    <span className="ml-2 text-sm text-gray-900">{license.issue_date}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Expires:</span>
                    <span className="ml-2 text-sm font-semibold text-gray-900">
                      {license.expiry_date}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Quota Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600">Authorized:</span>
                    <span className="ml-2 text-sm font-mono font-semibold text-gray-900">
                      {license.authorized_qty_oz.toFixed(3)} oz
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Consumed:</span>
                    <span className="ml-2 text-sm font-mono text-gray-900">
                      {license.consumed_qty_oz.toFixed(3)} oz
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Remaining:</span>
                    <span className="ml-2 text-sm font-mono font-bold text-green-600">
                      {license.remaining_qty_oz.toFixed(3)} oz
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {license.pdf_url && (
              <div className="mt-6 pt-6 border-t">
                <Button variant="secondary" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download License PDF
                </Button>
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600">Evaluation</h3>
                <div className={`w-6 h-6 rounded-full ${getTrafficLightColor(evaluation?.trafficLight || 'GRAY')}`} />
              </div>

              {evaluation && (
                <div>
                  <div className="mb-4">
                    <span className="text-lg font-bold text-gray-900">{evaluation.status}</span>
                    <p className="text-sm text-gray-600 mt-2">{evaluation.reason}</p>
                  </div>

                  {evaluation.recommendations.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Recommendations</h4>
                      <ul className="space-y-1">
                        {evaluation.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-blue-800 flex items-start">
                            <span className="mr-2">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Quota Utilization</div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        license.remaining_percentage <= 10
                          ? 'bg-red-500'
                          : license.remaining_percentage <= 25
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${100 - license.remaining_percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-600">
                      {license.consumed_qty_oz.toFixed(3)} oz used
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      {license.remaining_percentage.toFixed(1)}% remaining
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 mb-1">Validity Period</div>
                  <div className="flex items-center space-x-2">
                    {license.days_to_expiry < 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : license.days_to_expiry <= 7 ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : license.days_to_expiry <= 15 ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    <span className="text-lg font-bold text-gray-900">
                      {license.days_to_expiry < 0 ? 'Expired' : `${license.days_to_expiry} days`}
                    </span>
                  </div>
                  {license.days_to_expiry >= 0 && (
                    <p className="text-xs text-gray-600 mt-1">until {license.expiry_date}</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <Tabs
            tabs={[
              { id: 'batches', label: `Associated Batches (${batches.length})`, icon: Package },
              { id: 'transactions', label: 'Quota Transactions', icon: Activity },
              { id: 'events', label: 'Audit Trail', icon: FileText },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          <div className="p-6">
            {activeTab === 'batches' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Batches Using This License
                </h3>
                {batches.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No batches associated with this license yet
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Batch Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date Created
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Weight (oz)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mining Company
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Origin
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {batches.map((batch) => (
                          <tr key={batch.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Package className="w-4 h-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-900">
                                  {batch.batch_number}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(batch.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <StatusBadge status={batch.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                              {batch.weight_oz?.toFixed(3) || '0.000'} oz
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {batch.mining_companies?.name || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {batch.origin_site || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => navigate(`/batches/${batch.id}`)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Quota Transaction History
                </h3>
                {transactions.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No quota transactions recorded yet
                  </div>
                ) : (
                  <Table columns={transactionColumns} data={transactions} />
                )}
              </div>
            )}

            {activeTab === 'events' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">License Audit Trail</h3>
                {events.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No events recorded yet</div>
                ) : (
                  <Table columns={eventColumns} data={events} />
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
