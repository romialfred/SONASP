import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Package, Plane, DollarSign, Settings, Eye } from 'lucide-react';
import { PRODUCTION_STATUSES, ProductionStatus } from '@/constants/productionStatuses';
import { SHIPPING_STATUSES, ShippingStatus } from '@/constants/shippingStatuses';
import { SALES_STATUSES, STATUS_LABELS, STATUS_COLORS, SalesStatus } from '@/constants/salesStatuses';

interface StatusInfo {
  value: string;
  label: string;
  description: string;
  color: string;
  canTransitionTo: string[];
}

export default function StatusManagerPage() {
  const [activeTab, setActiveTab] = useState('production');

  const getProductionStatuses = (): StatusInfo[] => {
    return Object.entries(PRODUCTION_STATUSES).map(([key, value]) => ({
      value: key,
      label: value.label,
      description: value.description,
      color: value.bgColor + ' ' + value.color,
      canTransitionTo: key === 'prepared' ? ['ready_for_customs'] : []
    }));
  };

  const getShippingStatuses = (): StatusInfo[] => {
    return Object.entries(SHIPPING_STATUSES).map(([key, value]) => ({
      value: key,
      label: value.label,
      description: value.description,
      color: value.bgColor + ' ' + value.textColor,
      canTransitionTo: value.canTransitionTo
    }));
  };

  const getSalesStatuses = (): StatusInfo[] => {
    return Object.entries(SALES_STATUSES).map(([key, value]) => ({
      value: value,
      label: STATUS_LABELS[value as SalesStatus],
      description: `Statut de vente: ${STATUS_LABELS[value as SalesStatus]}`,
      color: STATUS_COLORS[value as SalesStatus],
      canTransitionTo: []
    }));
  };

  const renderStatusCard = (status: StatusInfo) => {
    return (
      <Card key={status.value} className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {status.description}
            </p>
          </div>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Voir les détails"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {status.canTransitionTo.length > 0 && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            <p className="text-xs text-gray-500 font-medium mb-2">Transitions possibles:</p>
            <div className="flex flex-wrap gap-2">
              {status.canTransitionTo.map(nextStatus => {
                const nextStatusLabel = activeTab === 'production'
                  ? PRODUCTION_STATUSES[nextStatus as ProductionStatus]?.label
                  : activeTab === 'shipping'
                  ? SHIPPING_STATUSES[nextStatus as ShippingStatus]?.label
                  : nextStatus;

                return (
                  <span
                    key={nextStatus}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                  >
                    → {nextStatusLabel}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const tabs = [
    {
      id: 'production',
      label: 'Production',
      icon: Package
    },
    {
      id: 'shipping',
      label: 'Expédition',
      icon: Plane
    },
    {
      id: 'sales',
      label: 'Ventes',
      icon: DollarSign
    }
  ];

  const getStatusesForTab = () => {
    switch (activeTab) {
      case 'production':
        return getProductionStatuses();
      case 'shipping':
        return getShippingStatuses();
      case 'sales':
        return getSalesStatuses();
      default:
        return [];
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-8 h-8 text-amber-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                Gestionnaire de Statuts
              </h1>
            </div>
            <p className="text-gray-600">
              Visualisez et gérez les statuts des différents modules de l'application
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Card className="p-1">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </Card>

        {/* Status Cards Grid */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {tabs.find(t => t.id === activeTab)?.label} - Statuts Disponibles
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {getStatusesForTab().length} statut(s) configuré(s)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getStatusesForTab().map(status => renderStatusCard(status))}
          </div>
        </div>

        {/* Info Box */}
        <Card className="bg-amber-50 border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Settings className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 mb-2">
                Statuts du Système
              </h3>
              <p className="text-sm text-amber-800">
                Les statuts affichés ici sont définis dans le code de l'application et utilisés
                pour suivre la progression des différents processus (production, expédition, ventes).
                Chaque statut a des règles de transition spécifiques pour assurer l'intégrité des workflows.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
