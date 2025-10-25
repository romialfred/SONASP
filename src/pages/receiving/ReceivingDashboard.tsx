import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Column } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { AlertBox } from '@/components/dashboard/AlertBox';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { formatWeight } from '@/utils/batchUtils';

interface PendingBatch {
  id: string;
  batch_number: string;
  origin_site: string;
  weight_grams: number;
  shipping_date: string;
  expected_arrival: string;
  transportation_company: string;
  days_in_transit: number;
}

interface RecentReceipt {
  id: string;
  batch_number: string;
  received_at: string;
  weight_grams: number;
  variance_percentage: number;
  received_by: string;
}

export function ReceivingDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [siteFilter, setSiteFilter] = useState('all');

  const metrics = [
    {
      title: 'Pending Receipts',
      value: '5',
      change: '2 expected today',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Received Today',
      value: '3',
      change: '+1 from yesterday',
      changeType: 'positive' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Variance Alerts',
      value: '1',
      change: 'Requires reconciliation',
      changeType: 'negative' as const,
      icon: AlertCircle,
      iconColor: 'text-red-500',
    },
    {
      title: 'Total Weight (This Week)',
      value: '4,825 oz',
      change: '+8% from last week',
      changeType: 'positive' as const,
      icon: Package,
      iconColor: 'text-primary-500',
    },
  ];

  const pendingBatches: PendingBatch[] = [
    {
      id: '1',
      batch_number: 'BT-202410-GN-0001',
      origin_site: 'Conakry Factory',
      weight_grams: 1250.5,
      shipping_date: '2024-10-20',
      expected_arrival: '2024-10-21',
      transportation_company: 'TransGold Logistics',
      days_in_transit: 1,
    },
    {
      id: '2',
      batch_number: 'BT-202410-CI-0002',
      origin_site: 'Abidjan Factory',
      weight_grams: 980.75,
      shipping_date: '2024-10-19',
      expected_arrival: '2024-10-20',
      transportation_company: 'Swift Transport',
      days_in_transit: 2,
    },
  ];

  const recentReceipts: RecentReceipt[] = [
    {
      id: '1',
      batch_number: 'BT-202410-ML-0003',
      received_at: '2024-10-20 14:30',
      weight_grams: 1500.25,
      variance_percentage: 0.5,
      received_by: 'Marie Koné',
    },
    {
      id: '2',
      batch_number: 'BT-202410-GN-0004',
      received_at: '2024-10-20 11:15',
      weight_grams: 1100.0,
      variance_percentage: -2.3,
      received_by: 'Ibrahim Diallo',
    },
  ];

  const pendingColumns: Column<PendingBatch>[] = [
    {
      key: 'batch_number',
      label: 'Batch Number',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-primary-600">{value}</span>
      ),
    },
    {
      key: 'origin_site',
      label: 'Origin',
      sortable: true,
    },
    {
      key: 'weight_grams',
      label: 'Expected Weight',
      sortable: true,
      render: (value) => formatWeight(value),
    },
    {
      key: 'days_in_transit',
      label: 'Days in Transit',
      sortable: true,
      render: (value) => (
        <span
          className={value > 2 ? 'text-red-600 font-medium' : 'text-gray-900'}
        >
          {value} days
        </span>
      ),
    },
    {
      key: 'transportation_company',
      label: 'Transporter',
      sortable: true,
    },
    {
      key: 'id',
      label: 'Action',
      render: (value, row) => (
        <Button
          size="sm"
          variant="primary"
          onClick={() => navigate(`/receiving/${row.id}/confirm`)}
        >
          Receive
        </Button>
      ),
    },
  ];

  const recentColumns: Column<RecentReceipt>[] = [
    {
      key: 'batch_number',
      label: 'Batch Number',
      sortable: true,
    },
    {
      key: 'received_at',
      label: 'Received At',
      sortable: true,
    },
    {
      key: 'weight_grams',
      label: 'Weight',
      sortable: true,
      render: (value) => formatWeight(value),
    },
    {
      key: 'variance_percentage',
      label: 'Variance',
      sortable: true,
      render: (value) => {
        const isSignificant = Math.abs(value) > 2;
        return (
          <span
            className={
              isSignificant
                ? 'text-red-600 font-medium'
                : 'text-accent-600 font-medium'
            }
          >
            {value > 0 ? '+' : ''}
            {value.toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: 'received_by',
      label: 'Received By',
      sortable: true,
    },
  ];

  const varianceAlerts = [
    {
      batch_number: 'BT-202410-GN-0004',
      variance: -2.3,
      message: 'Significant variance detected. Reconciliation required.',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Receiving Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Manage incoming batch receipts and confirmations
            </p>
          </div>

          <Select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="all">All Sites</option>
            <option value="conakry">Conakry Airport</option>
            <option value="abidjan">Abidjan Airport</option>
            <option value="bamako">Bamako Airport</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        {varianceAlerts.length > 0 && (
          <div className="space-y-3">
            {varianceAlerts.map((alert, index) => (
              <AlertBox
                key={index}
                variant="warning"
                title="Variance Alert"
                message={`${alert.batch_number}: ${alert.message}`}
                action={{
                  label: 'Review',
                  onClick: () => navigate(`/receiving/${alert.batch_number}/confirm`),
                }}
              />
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Receipts ({pendingBatches.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table data={pendingBatches} columns={pendingColumns} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Received ({recentReceipts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table data={recentReceipts} columns={recentColumns} />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
