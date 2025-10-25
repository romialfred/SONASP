import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { FileText, Download, Calendar, Filter } from 'lucide-react';

export function ReportsPage() {
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState('last-30-days');

  const reportTypes = [
    { id: 'sales', name: 'Sales Report', description: 'Complete sales transactions and revenue' },
    { id: 'batches', name: 'Batch Report', description: 'Batch processing and status overview' },
    { id: 'customers', name: 'Customer Report', description: 'Customer performance and activity' },
    { id: 'financial', name: 'Financial Report', description: 'Revenue, expenses, and profitability' },
    { id: 'inventory', name: 'Inventory Report', description: 'Current gold inventory and movements' },
    { id: 'compliance', name: 'Compliance Report', description: 'Regulatory compliance documentation' },
  ];

  const recentReports = [
    { id: 1, name: 'Monthly Sales Report - October 2025', type: 'Sales', date: '2025-10-25', size: '2.4 MB' },
    { id: 2, name: 'Q3 Financial Summary', type: 'Financial', date: '2025-10-20', size: '1.8 MB' },
    { id: 3, name: 'Customer Performance Analysis', type: 'Customer', date: '2025-10-15', size: '3.1 MB' },
    { id: 4, name: 'Batch Processing Report - Week 42', type: 'Batches', date: '2025-10-18', size: '1.2 MB' },
    { id: 5, name: 'Compliance Audit Report', type: 'Compliance', date: '2025-10-10', size: '4.5 MB' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">Generate and download business reports</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export All
          </button>
        </div>

        {/* Report Generator */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Generate New Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  {reportTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="last-7-days">Last 7 Days</option>
                  <option value="last-30-days">Last 30 Days</option>
                  <option value="last-quarter">Last Quarter</option>
                  <option value="last-year">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              <div className="flex items-end">
                <button className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  Generate Report
                </button>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected:</strong> {reportTypes.find(t => t.id === reportType)?.name}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {reportTypes.find(t => t.id === reportType)?.description}
              </p>
            </div>
          </div>
        </Card>

        {/* Report Templates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reportTypes.map(type => (
            <Card key={type.id}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{type.name}</h4>
                    <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                    <button className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium">
                      Generate →
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Reports */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Reports</h3>
            <div className="space-y-3">
              {recentReports.map(report => (
                <div key={report.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{report.name}</p>
                      <p className="text-sm text-gray-500">
                        {report.type} • {new Date(report.date).toLocaleDateString()} • {report.size}
                      </p>
                    </div>
                  </div>
                  <button className="text-amber-600 hover:text-amber-700 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Download</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Scheduled Reports */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Scheduled Reports</h3>
              <button className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                + Add Schedule
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Monthly Sales Report</p>
                    <p className="text-sm text-gray-500">Every 1st of the month at 9:00 AM</p>
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Weekly Batch Summary</p>
                    <p className="text-sm text-gray-500">Every Monday at 8:00 AM</p>
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
