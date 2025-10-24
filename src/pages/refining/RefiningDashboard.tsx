import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flame, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Column } from '@/components/ui/Table';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { BarChartWidget } from '@/components/charts/BarChartWidget';
import Button from '@/components/ui/Button';
import { formatWeight } from '@/utils/batchUtils';

interface BatchForProcessing {
  id: string;
  batch_number: string;
  received_at: string;
  weight_grams: number;
  origin_site: string;
  days_waiting: number;
}

interface ProcessingBatch {
  id: string;
  batch_number: string;
  processing_started: string;
  pre_melting_weight: number;
  processed_by: string;
  progress: number;
}

interface AwaitingApproval {
  id: string;
  batch_number: string;
  processed_at: string;
  final_fine_grams: number;
  final_fine_ounces: number;
  processed_by: string;
}

export function RefiningDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const metrics = [
    {
      title: 'Ready for Processing',
      value: '4',
      change: '1 priority batch',
      changeType: 'neutral' as const,
      icon: Clock,
      iconColor: 'text-orange-500',
    },
    {
      title: 'Processing Now',
      value: '2',
      change: 'On schedule',
      changeType: 'positive' as const,
      icon: Flame,
      iconColor: 'text-red-500',
    },
    {
      title: 'Awaiting Approval',
      value: '3',
      change: 'Supervisor review needed',
      changeType: 'neutral' as const,
      icon: CheckCircle,
      iconColor: 'text-accent-500',
    },
    {
      title: 'Monthly Output',
      value: '15,450 oz',
      change: '+12% from last month',
      changeType: 'positive' as const,
      icon: TrendingUp,
      iconColor: 'text-primary-500',
    },
  ];

  const readyForProcessing: BatchForProcessing[] = [
    {
      id: '1',
      batch_number: 'BT-202410-GN-0001',
      received_at: '2024-10-20 14:30',
      weight_grams: 1250.5,
      origin_site: 'Conakry Factory',
      days_waiting: 1,
    },
    {
      id: '2',
      batch_number: 'BT-202410-CI-0002',
      received_at: '2024-10-19 11:15',
      weight_grams: 980.75,
      origin_site: 'Abidjan Factory',
      days_waiting: 2,
    },
  ];

  const processing: ProcessingBatch[] = [
    {
      id: '1',
      batch_number: 'BT-202410-ML-0003',
      processing_started: '2024-10-20 09:00',
      pre_melting_weight: 1500.25,
      processed_by: 'Ahmed Traoré',
      progress: 65,
    },
  ];

  const awaitingApproval: AwaitingApproval[] = [
    {
      id: '1',
      batch_number: 'BT-202410-GN-0004',
      processed_at: '2024-10-20 16:45',
      final_fine_grams: 1050.25,
      final_fine_ounces: 37.05,
      processed_by: 'Mamadou Keita',
    },
    {
      id: '2',
      batch_number: 'BT-202410-CI-0005',
      processed_at: '2024-10-20 15:30',
      final_fine_grams: 890.5,
      final_fine_ounces: 31.42,
      processed_by: 'Fatou Diallo',
    },
  ];

  const readyColumns: Column<BatchForProcessing>[] = [
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
      label: 'Weight',
      sortable: true,
      render: (value) => formatWeight(value),
    },
    {
      key: 'days_waiting',
      label: 'Days Waiting',
      sortable: true,
      render: (value) => (
        <span className={value > 3 ? 'text-red-600 font-medium' : 'text-gray-900'}>
          {value} days
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Action',
      render: (value, row) => (
        <Button
          size="sm"
          variant="primary"
          onClick={() => navigate(`/refining/${row.id}/process`)}
        >
          Start Processing
        </Button>
      ),
    },
  ];

  const processingColumns: Column<ProcessingBatch>[] = [
    {
      key: 'batch_number',
      label: 'Batch Number',
      sortable: true,
    },
    {
      key: 'pre_melting_weight',
      label: 'Pre-Melting Weight',
      sortable: true,
      render: (value) => formatWeight(value),
    },
    {
      key: 'processed_by',
      label: 'Processed By',
      sortable: true,
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">{value}%</span>
        </div>
      ),
    },
  ];

  const approvalColumns: Column<AwaitingApproval>[] = [
    {
      key: 'batch_number',
      label: 'Batch Number',
      sortable: true,
    },
    {
      key: 'final_fine_grams',
      label: 'Final Fine',
      sortable: true,
      render: (value, row) => (
        <span>
          {value.toFixed(2)}g ({row.final_fine_ounces.toFixed(2)} oz)
        </span>
      ),
    },
    {
      key: 'processed_by',
      label: 'Processed By',
      sortable: true,
    },
    {
      key: 'processed_at',
      label: 'Processed At',
      sortable: true,
    },
    {
      key: 'id',
      label: 'Action',
      render: (value) => (
        <Button size="sm" variant="success">
          Review
        </Button>
      ),
    },
  ];

  const monthlyData = [
    { name: 'Week 1', output: 3200 },
    { name: 'Week 2', output: 3850 },
    { name: 'Week 3', output: 4100 },
    { name: 'Week 4', output: 4300 },
  ];

  return (
    <MainLayout userRole="refinery">
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">
            Refining Management
          </h1>
          <p className="text-gray-600 mt-1">
            Process and track refinery operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Output Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChartWidget
                data={monthlyData}
                bars={[{ dataKey: 'output', color: '#B8860B', name: 'Output (oz)' }]}
                height={250}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Processing Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Average Processing Time</p>
                    <p className="text-2xl font-bold text-primary-700">4.2 hrs</p>
                  </div>
                  <Flame className="h-10 w-10 text-primary-500" />
                </div>
                <div className="flex items-center justify-between p-4 bg-accent-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Average Recovery Rate</p>
                    <p className="text-2xl font-bold text-accent-700">94.5%</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-accent-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ready for Processing ({readyForProcessing.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table data={readyForProcessing} columns={readyColumns} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing in Progress ({processing.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table data={processing} columns={processingColumns} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Awaiting Approval ({awaitingApproval.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table data={awaitingApproval} columns={approvalColumns} />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
