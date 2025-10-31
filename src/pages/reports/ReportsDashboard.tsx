import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ScheduleReportPanel } from '@/components/reports/ScheduleReportPanel';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  BarChart3,
  Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { generatePDF } from '@/services/pdfGenerationService';

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function ReportsDashboard() {
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState('');

  const reportTypes: ReportType[] = [
    {
      id: 'executive',
      title: 'Executive Summary',
      description: 'High-level overview for Direction Générale with key metrics, trends, and strategic recommendations',
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200'
    },
    {
      id: 'sales',
      title: 'Sales Performance',
      description: 'Detailed sales analysis with revenue breakdown, pipeline status, and customer insights',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200'
    },
    {
      id: 'batch',
      title: 'Batch Operations',
      description: 'Processing efficiency, quality metrics, and operational performance across all sites',
      icon: Package,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-200'
    },
    {
      id: 'customer',
      title: 'Customer Analysis',
      description: 'Customer behavior, retention rates, payment patterns, and relationship health',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-200'
    },
    {
      id: 'financial',
      title: 'Financial Analysis',
      description: 'P&L statement, cash flow analysis, cost breakdown, and FX impact assessment',
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200'
    },
    {
      id: 'operations',
      title: 'Operations Report',
      description: 'Operational KPIs, process efficiency, resource utilization, and improvement opportunities',
      icon: Settings,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      borderColor: 'border-indigo-200'
    }
  ];

  const handleExportExcel = (reportId: string) => {
    const sampleData = [
      ['Mansa Resources - ' + reportTypes.find(r => r.id === reportId)?.title],
      ['Generated:', new Date().toLocaleDateString()],
      [''],
      ['Metric', 'Value', 'Change', 'Status'],
      ['Total Revenue', '$9,945,000', '+24%', 'Good'],
      ['Active Customers', '18', '+20%', 'Good'],
      ['Batches Processed', '337', '+18%', 'Good'],
      ['Avg Processing Time', '4.3 days', '-12%', 'Good'],
      ['Customer Retention', '94%', '+2%', 'Excellent'],
      ['Profit Margin', '18.5%', '+2.3%', 'Good'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 }
    ];

    XLSX.writeFile(wb, `${reportId}_report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSchedule = (reportId: string, reportTitle: string) => {
    setSelectedReport(reportTitle);
    setSchedulerOpen(true);
  };

  const handleGeneratePDF = (reportId: string) => {
    try {
      generatePDF(reportId);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating the PDF. Please try again.');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Professional Reports</h1>
            <p className="text-gray-600 mt-1">
              Generate comprehensive reports for Direction Générale
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Last generated: Today</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">
                Professional Report Generation
              </p>
              <p className="text-xs text-blue-700">
                Each report includes: Executive summary, detailed analytics with charts,
                traffic light indicators, insights, and strategic recommendations.
                Reports are 3-5 pages in professional format, ready for Direction Générale.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <Card key={report.id} className={`border-2 ${report.borderColor} hover:shadow-lg transition-shadow`}>
                <CardHeader className={report.bgColor}>
                  <div className="flex items-center gap-3">
                    <div className={`${report.bgColor} p-3 rounded-lg`}>
                      <Icon className={`h-6 w-6 ${report.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-gray-900">{report.title}</CardTitle>
                      <p className="text-xs text-gray-600 mt-1">{report.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Button
                      onClick={() => handleGeneratePDF(report.id)}
                      className="w-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Generate PDF Report
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExportExcel(report.id)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export to Excel
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleSchedule(report.id, report.title)}
                      className="w-full flex items-center justify-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Calendar className="h-4 w-4" />
                      Schedule Report
                    </Button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Last generated</span>
                      <span className="font-medium">Today</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Professional Format</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Cover page with logo and period</li>
                  <li>• Executive summary (1 page)</li>
                  <li>• Detailed analysis (2-3 pages)</li>
                  <li>• Recommendations & action items</li>
                  <li>• Professional charts and tables</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Key Insights</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Traffic light indicators</li>
                  <li>• KPI performance metrics</li>
                  <li>• Trend analysis with charts</li>
                  <li>• Risk and opportunity assessment</li>
                  <li>• Strategic recommendations</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Distribution</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• PDF export for sharing</li>
                  <li>• Excel export for analysis</li>
                  <li>• Automated scheduling</li>
                  <li>• Email delivery</li>
                  <li>• Archive and history</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Executive Summary</p>
                    <p className="text-xs text-gray-600">Weekly - Every Monday at 09:00</p>
                  </div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Active</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Sales Performance</p>
                    <p className="text-xs text-gray-600">Monthly - 1st day at 10:00</p>
                  </div>
                </div>
                <span className="text-xs text-green-600 font-medium">Active</span>
              </div>

              <div className="text-center py-4 text-sm text-gray-500">
                + Add new scheduled report
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ScheduleReportPanel
        isOpen={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        reportType={selectedReport}
      />
    </MainLayout>
  );
}
