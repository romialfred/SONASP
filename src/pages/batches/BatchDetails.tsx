import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Edit,
  Package,
  MapPin,
  Calendar,
  Weight,
  Building2,
  FileText,
  Truck,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { StatusFlow, BatchStatus } from '@/components/batch/StatusFlow';
import { Timeline, TimelineEvent } from '@/components/batch/Timeline';
import { formatWeight } from '@/utils/batchUtils';

export function BatchDetails() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const batch = {
    id: id,
    batch_number: 'BT-202410-GN-0001',
    status: 'shipped' as BatchStatus,
    weight_grams: 1250.5,
    weight_ounces: 44.09,
    shipping_date: '2024-10-20',
    origin_site: 'Conakry Factory',
    current_site: 'In Transit to Airport',
    transportation_company: 'TransGold Logistics',
    comments: 'High-grade gold from northern mine. Handle with priority.',
    created_by: 'John Doe',
    created_at: '2024-10-20T08:30:00Z',
  };

  const timelineEvents: TimelineEvent[] = [
    {
      id: '1',
      title: 'Batch Created',
      description: 'Initial batch registration at factory',
      timestamp: '2024-10-20 08:30 AM',
      user: 'John Doe',
      icon: Package,
      iconColor: 'bg-primary-500',
    },
    {
      id: '2',
      title: 'Quality Check Passed',
      description: 'Batch passed initial quality inspection',
      timestamp: '2024-10-20 09:15 AM',
      user: 'Jane Smith',
      icon: FileText,
      iconColor: 'bg-accent-500',
    },
    {
      id: '3',
      title: 'Shipment Initiated',
      description: 'Batch handed over to TransGold Logistics',
      timestamp: '2024-10-20 10:00 AM',
      user: 'John Doe',
      icon: Truck,
      iconColor: 'bg-blue-500',
    },
  ];

  const documents = [
    {
      id: '1',
      name: 'Initial Quality Report.pdf',
      type: 'Quality Report',
      size: '245 KB',
      uploaded_at: '2024-10-20 09:15 AM',
    },
    {
      id: '2',
      name: 'Shipping Manifest.pdf',
      type: 'Shipping Document',
      size: '180 KB',
      uploaded_at: '2024-10-20 10:00 AM',
    },
  ];

  return (
    <MainLayout userRole="factory">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/batches')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {batch.batch_number}
              </h1>
              <p className="text-gray-600 mt-1">Batch Details and Tracking</p>
            </div>
          </div>

          <Button variant="outline" className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Batch
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Batch Status Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusFlow currentStatus={batch.status} completedSteps={['created']} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Package className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Batch Number</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.batch_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Weight className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Weight</p>
                      <p className="text-base font-semibold text-gray-900">
                        {formatWeight(batch.weight_grams)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-accent-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Shipping Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {new Date(batch.shipping_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Status</p>
                      <StatusBadge status="shipped" />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Origin Site</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.origin_site}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Location</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.current_site}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Truck className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Transportation</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.transportation_company}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileText className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created By</p>
                      <p className="text-base font-semibold text-gray-900">
                        {batch.created_by}
                      </p>
                    </div>
                  </div>
                </div>

                {batch.comments && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Comments</p>
                    <p className="text-base text-gray-900">{batch.comments}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline events={timelineEvents} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <FileText className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.name}
                        </p>
                        <p className="text-xs text-gray-500">{doc.type}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {doc.size} • {doc.uploaded_at}
                        </p>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" className="w-full">
                    Upload Document
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full">
                  Print Details
                </Button>
                <Button variant="outline" className="w-full">
                  Export Report
                </Button>
                <Button variant="outline" className="w-full">
                  Share with Team
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
