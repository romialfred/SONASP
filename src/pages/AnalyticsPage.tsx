import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { TrendingUp, DollarSign, Package, Users } from 'lucide-react';

export function AnalyticsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Advanced analytics and insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">$0</p>
                  <p className="text-xs text-gray-500 mt-1">No data</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sales Trend</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
                  <p className="text-xs text-gray-500 mt-1">No data</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Batches</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
                  <p className="text-xs text-gray-500 mt-1">No data</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Customers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
                  <p className="text-xs text-gray-500 mt-1">No data</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-6">
            <div className="text-center py-12">
              <p className="text-gray-500">Analytics data will appear here once you have sales and batch data in the system.</p>
              <p className="text-sm text-gray-400 mt-2">Start by creating batches and processing sales to see detailed analytics.</p>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
