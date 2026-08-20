import { useState, useEffect } from 'react';
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
import { reportSchedulingService, type ScheduledReport, type ReportHistory } from '@/services/reportSchedulingService';
import { useDialog } from '@/contexts/DialogContext';

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
  const { showError } = useDialog();
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [, setReportHistory] = useState<ReportHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scheduled, history] = await Promise.all([
        reportSchedulingService.getActiveScheduledReports(),
        reportSchedulingService.getReportHistory(10)
      ]);
      setScheduledReports(scheduled);
      setReportHistory(history);
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  /**
   * Les six rapports produisaient un classeur et un PDF entièrement inventés :
   * 9 945 000 $ de recettes, 337 lots traités, 18 clients, des usines au Mali et
   * en Guinée, assortis de « recommandations stratégiques ». Rien de tout cela
   * ne venait de la base. Un rapport signé de la SONASP ne peut pas être un
   * échantillon : tant que le moteur n'est pas branché sur les sources réelles,
   * l'export refuse et le dit.
   */
  const refuserExport = (format: 'PDF' | 'Excel') => {
    showError(
      `Export ${format} indisponible`,
      "Le moteur de rapports n'est pas encore raccordé aux données de la plateforme. " +
        'Les chiffres des ventes, des achats et de la production se consultent sur leurs écrans respectifs.'
    );
  };

  const handleExportExcel = () => refuserExport('Excel');

  const handleSchedule = (reportId: string, reportTitle: string) => {
    setSelectedReportId(reportId);
    setSelectedReport(reportTitle);
    setSchedulerOpen(true);
  };

  const handleGeneratePDF = async () => refuserExport('PDF');

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

        {/* Les rapports produisaient des documents entièrement inventés. Le dire
            vaut mieux que de laisser signer un faux. */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 mb-1">
                Moteur de rapports non raccordé
              </p>
              <p className="text-xs text-amber-800">
                Les rapports de cette page ne sont pas encore alimentés par les données de la
                plateforme. Ils restent donc indisponibles au téléchargement : un document signé de
                la SONASP ne peut pas reposer sur des chiffres d’exemple. Les ventes, les achats aux
                mines, la production et les stocks se consultent sur leurs écrans respectifs, où les
                chiffres sont réels.
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
                      onClick={() => void handleGeneratePDF()}
                      className="w-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Rapport PDF
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleExportExcel()}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export Excel
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
            <CardTitle>Scheduled Reports ({scheduledReports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading scheduled reports...</div>
            ) : scheduledReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No scheduled reports yet. Click "Schedule Report" on any report type to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledReports.map((schedule) => {
                  const reportType = reportTypes.find(r => r.id === schedule.report_type);
                  const Icon = reportType?.icon || FileText;
                  const frequencyText = schedule.frequency === 'weekly'
                    ? `Weekly - ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedule.schedule_weekday || 1]} at ${schedule.schedule_time}`
                    : schedule.frequency === 'monthly'
                    ? `Monthly - Day ${schedule.schedule_day} at ${schedule.schedule_time}`
                    : `${schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} at ${schedule.schedule_time}`;

                  return (
                    <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${reportType?.color || 'text-gray-600'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{reportType?.title || schedule.report_type}</p>
                          <p className="text-xs text-gray-600">{frequencyText}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium ${schedule.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        {schedule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ScheduleReportPanel
        isOpen={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        reportType={selectedReport}
        reportId={selectedReportId}
        onScheduled={loadData}
      />
    </MainLayout>
  );
}
