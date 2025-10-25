import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Calendar, Mail, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'sales' | 'operations' | 'financial' | 'compliance';
  icon: typeof FileText;
}

interface ReportHistory {
  id: string;
  name: string;
  generatedDate: string;
  generatedBy: string;
  format: 'PDF' | 'Excel';
  size: string;
}

export function ReportGeneration() {
  const { t } = useTranslation();

  const [showCustomReportModal, setShowCustomReportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templates: ReportTemplate[] = [
    {
      id: 'monthly-sales',
      name: 'Monthly Sales Report',
      description: 'Comprehensive sales performance with revenue breakdown',
      category: 'sales',
      icon: FileText,
    },
    {
      id: 'customer-performance',
      name: 'Customer Performance Report',
      description: 'Detailed customer purchase history and metrics',
      category: 'sales',
      icon: FileText,
    },
    {
      id: 'batch-tracking',
      name: 'Batch Tracking Report',
      description: 'Complete batch status and location tracking',
      category: 'operations',
      icon: FileText,
    },
    {
      id: 'refining-summary',
      name: 'Refining Summary Report',
      description: 'Monthly refining operations and yield analysis',
      category: 'operations',
      icon: FileText,
    },
    {
      id: 'financial-summary',
      name: 'Financial Summary Report',
      description: 'Revenue, costs, and profitability analysis',
      category: 'financial',
      icon: FileText,
    },
    {
      id: 'payment-tracking',
      name: 'Payment Tracking Report',
      description: 'Customer payment status and reconciliation',
      category: 'financial',
      icon: FileText,
    },
    {
      id: 'audit-trail',
      name: 'Audit Trail Report',
      description: 'Complete system activity and user actions',
      category: 'compliance',
      icon: FileText,
    },
    {
      id: 'compliance-report',
      name: 'Compliance Report',
      description: 'Regulatory compliance and documentation status',
      category: 'compliance',
      icon: FileText,
    },
  ];

  const reportHistory: ReportHistory[] = [
    {
      id: '1',
      name: 'Monthly Sales Report - October 2024',
      generatedDate: '2024-10-31T10:30:00',
      generatedBy: 'John Doe',
      format: 'PDF',
      size: '2.4 MB',
    },
    {
      id: '2',
      name: 'Customer Performance Report - Q3 2024',
      generatedDate: '2024-10-01T14:15:00',
      generatedBy: 'Jane Smith',
      format: 'Excel',
      size: '1.8 MB',
    },
    {
      id: '3',
      name: 'Financial Summary Report - September 2024',
      generatedDate: '2024-09-30T16:45:00',
      generatedBy: 'John Doe',
      format: 'PDF',
      size: '3.1 MB',
    },
  ];

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ReportTemplate[]>);

  const categoryLabels = {
    sales: 'Sales Reports',
    operations: 'Operations Reports',
    financial: 'Financial Reports',
    compliance: 'Compliance Reports',
  };

  const handleGenerateReport = (templateId: string) => {
    setSelectedTemplate(templateId);
    console.log(`Generating report: ${templateId}`);
  };

  const handleDownload = (reportId: string) => {
    console.log(`Downloading report: ${reportId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.reports')}
            </h1>
            <p className="text-gray-600 mt-1">Generate and manage reports</p>
          </div>
          <Button
            onClick={() => setShowCustomReportModal(true)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Custom Report Builder
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
            <CardContent className="pt-6">
              <FileText className="h-8 w-8 text-primary-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
              <p className="text-sm text-gray-600 mt-1">Report Templates</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-accent-50 to-accent-100 border-accent-200">
            <CardContent className="pt-6">
              <Download className="h-8 w-8 text-accent-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">{reportHistory.length}</p>
              <p className="text-sm text-gray-600 mt-1">Generated This Month</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <Clock className="h-8 w-8 text-blue-600 mb-3" />
              <p className="text-2xl font-bold text-gray-900">3</p>
              <p className="text-sm text-gray-600 mt-1">Scheduled Reports</p>
            </CardContent>
          </Card>
        </div>

        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{categoryLabels[category as keyof typeof categoryLabels]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <template.icon className="h-5 w-5 text-primary-600" />
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleGenerateReport(template.id)}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-3 w-3" />
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          setShowScheduleModal(true);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Calendar className="h-3 w-3" />
                        Schedule
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Report History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reportHistory.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{report.name}</p>
                      <p className="text-sm text-gray-600">
                        Generated by {report.generatedBy} on{' '}
                        {new Date(report.generatedDate).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{report.format}</p>
                      <p className="text-xs text-gray-600">{report.size}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(report.id)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showCustomReportModal}
        onClose={() => setShowCustomReportModal(false)}
        title="Custom Report Builder"
      >
        <div className="space-y-4">
          <FormField label="Report Name" required>
            <Input placeholder="Enter report name" />
          </FormField>

          <FormField label="Report Type">
            <Select>
              <option value="sales">Sales Report</option>
              <option value="operations">Operations Report</option>
              <option value="financial">Financial Report</option>
              <option value="compliance">Compliance Report</option>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date">
              <DatePicker value="" onChange={() => {}} />
            </FormField>
            <FormField label="End Date">
              <DatePicker value="" onChange={() => {}} />
            </FormField>
          </div>

          <FormField label="Include Fields">
            <div className="space-y-2 p-3 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {['Revenue', 'Quantity', 'Customer Name', 'Batch Number', 'Status', 'Payment Info'].map((field) => (
                <label key={field} className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm text-gray-700">{field}</span>
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Format">
            <Select>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
            </Select>
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCustomReportModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCustomReportModal(false)}>
              Generate Report
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Report"
      >
        <div className="space-y-4">
          <FormField label="Frequency">
            <Select>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </Select>
          </FormField>

          <FormField label="Start Date">
            <DatePicker value="" onChange={() => {}} />
          </FormField>

          <FormField label="Email Recipients" hint="Comma-separated email addresses">
            <Input placeholder="email1@example.com, email2@example.com" />
          </FormField>

          <FormField label="Format">
            <Select>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </Select>
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowScheduleModal(false)}>
              <Mail className="h-4 w-4 mr-2" />
              Schedule Report
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
