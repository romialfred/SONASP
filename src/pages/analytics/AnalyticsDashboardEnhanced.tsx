import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs } from '@/components/ui/Tabs';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  PieChart,
  Target
} from 'lucide-react';
import { OverviewAnalytics } from './tabs/OverviewAnalytics';
import { SalesAnalytics } from './tabs/SalesAnalytics';
import { CustomerAnalytics } from './tabs/CustomerAnalytics';
import { FinancialAnalytics } from './tabs/FinancialAnalytics';
import { PerformanceAnalytics } from './tabs/PerformanceAnalytics';
import { TrendsAnalytics } from './tabs/TrendsAnalytics';

export function AnalyticsDashboardEnhanced() {
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: BarChart3
    },
    {
      id: 'sales',
      label: 'Sales',
      icon: DollarSign
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users
    },
    {
      id: 'financial',
      label: 'Financial',
      icon: PieChart
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: Target
    },
    {
      id: 'trends',
      label: 'Trends',
      icon: TrendingUp
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: Activity
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord analytique</h1>
          <p className="text-gray-600 mt-1">
            Vues transverses sur les ventes, les clients, les finances et la performance.
          </p>
        </div>

        {/* Les six onglets reposent sur 157 lignes de données écrites en dur —
            recettes mensuelles, parts par pays, rétention, marges — dont aucune
            ne vient de la base. Tant que le module n'est pas raccordé, l'écran
            l'annonce : un chiffre inventé qui se présente comme national est
            plus nuisible qu'un écran vide. */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 mb-1">
                Chiffres non raccordés aux données de la plateforme
              </p>
              <p className="text-xs text-amber-800">
                Les graphiques de cette page sont des exemples de mise en page : ils ne
                proviennent pas de la base et ne doivent pas être cités. Les chiffres réels se
                consultent sur les écrans qui les tiennent — ventes à l’export, achats aux mines,
                marché d’or artisanal, production journalière et suivi des stocks.
              </p>
            </div>
          </div>
        </div>

        <Tabs tabs={tabs} defaultTab="overview">
          {(activeTab) => {
            switch (activeTab) {
              case 'overview':
                return <OverviewAnalytics />;
              case 'sales':
                return <SalesAnalytics />;
              case 'customers':
                return <CustomerAnalytics />;
              case 'financial':
                return <FinancialAnalytics />;
              case 'performance':
                return <PerformanceAnalytics />;
              case 'trends':
                return <TrendsAnalytics />;
              case 'operations':
                return (
                  <div className="text-center py-12">
                    <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Operations analytics coming soon</p>
                  </div>
                );
              default:
                return <OverviewAnalytics />;
            }
          }}
        </Tabs>
      </div>
    </MainLayout>
  );
}
