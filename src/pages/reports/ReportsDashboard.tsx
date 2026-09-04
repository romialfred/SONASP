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
      title: 'Synthèse exécutive',
      description: 'Vue d’ensemble destinée à la Direction générale, avec les indicateurs clés, les tendances et les recommandations stratégiques',
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200'
    },
    {
      id: 'sales',
      title: 'Performance commerciale',
      description: 'Analyse détaillée des ventes, de la répartition des recettes, du portefeuille d’opérations et de la relation client',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200'
    },
    {
      id: 'batch',
      title: 'Opérations sur les lots',
      description: 'Efficacité du traitement, indicateurs de qualité et performance opérationnelle de l’ensemble des sites',
      icon: Package,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-200'
    },
    {
      id: 'customer',
      title: 'Analyse de la clientèle',
      description: 'Comportement des clients, fidélisation, habitudes de paiement et qualité de la relation commerciale',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-200'
    },
    {
      id: 'financial',
      title: 'Analyse financière',
      description: 'Compte de résultat, analyse des flux de trésorerie, répartition des coûts et incidence du change',
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200'
    },
    {
      id: 'operations',
      title: 'Rapport opérationnel',
      description: 'Indicateurs opérationnels, efficacité des processus, utilisation des ressources et axes d’amélioration',
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
            <h1 className="text-3xl font-bold text-gray-900">Rapports professionnels</h1>
            <p className="text-gray-600 mt-1">
              Produisez des rapports complets à l’attention de la Direction générale.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Dernière génération : aujourd’hui</span>
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
                      Planifier le rapport
                    </Button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Dernière génération</span>
                      <span className="font-medium">Aujourd’hui</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Caractéristiques des rapports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Présentation professionnelle</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Page de garde avec logo et période</li>
                  <li>• Synthèse exécutive sur une page</li>
                  <li>• Analyse détaillée sur deux à trois pages</li>
                  <li>• Recommandations et plan d’action</li>
                  <li>• Graphiques et tableaux professionnels</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Enseignements clés</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Indicateurs de vigilance tricolores</li>
                  <li>• Indicateurs clés de performance</li>
                  <li>• Analyse graphique des tendances</li>
                  <li>• Évaluation des risques et des opportunités</li>
                  <li>• Recommandations stratégiques</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Diffusion</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Export PDF pour le partage</li>
                  <li>• Export Excel pour l’analyse</li>
                  <li>• Planification automatisée</li>
                  <li>• Envoi par courriel</li>
                  <li>• Archivage et historique</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rapports planifiés ({scheduledReports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement des rapports planifiés…</div>
            ) : scheduledReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun rapport n’est encore planifié. Utilisez « Planifier le rapport » pour créer une programmation.
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledReports.map((schedule) => {
                  const reportType = reportTypes.find(r => r.id === schedule.report_type);
                  const Icon = reportType?.icon || FileText;
                  const frequencyText = schedule.frequency === 'weekly'
                    ? `Chaque ${['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][schedule.schedule_weekday || 1]} à ${schedule.schedule_time}`
                    : schedule.frequency === 'monthly'
                    ? `Chaque mois, le ${schedule.schedule_day} à ${schedule.schedule_time}`
                    : `${schedule.frequency} à ${schedule.schedule_time}`;

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
                        {schedule.is_active ? 'Actif' : 'Inactif'}
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
