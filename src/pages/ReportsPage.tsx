import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { FileText, Download } from 'lucide-react';

export function ReportsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">Generate and download reports</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Batch Reports</h3>
                  <p className="text-sm text-gray-500">All batch activity</p>
                </div>
              </div>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Sales Reports</h3>
                  <p className="text-sm text-gray-500">Revenue and sales</p>
                </div>
              </div>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Customer Reports</h3>
                  <p className="text-sm text-gray-500">Customer activity</p>
                </div>
              </div>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Refining Reports</h3>
                  <p className="text-sm text-gray-500">Processing data</p>
                </div>
              </div>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Payment Reports</h3>
                  <p className="text-sm text-gray-500">Financial transactions</p>
                </div>
              </div>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Audit Reports</h3>
                  <p className="text-sm text-gray-500">System activity</p>
                </div>
              </div>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-6">
            <div className="text-center py-8">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Report generation will be available once you have data in the system.</p>
              <p className="text-sm text-gray-400 mt-2">Create batches, process sales, and manage customers to generate reports.</p>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
