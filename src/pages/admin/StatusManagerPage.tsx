import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Package, Plane, DollarSign, Settings, Eye, Edit2, Workflow, CreditCard, ArrowRight } from 'lucide-react';
import { PRODUCTION_STATUSES, ProductionStatus } from '@/constants/productionStatuses';
import { SHIPPING_STATUSES, ShippingStatus } from '@/constants/shippingStatuses';
import { SALES_STATUSES, STATUS_LABELS, STATUS_COLORS, SalesStatus } from '@/constants/salesStatuses';
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_DESCRIPTIONS, PAYMENT_STATUS_TRANSITIONS, PaymentStatus } from '@/constants/paymentStatuses';
import { StatusFormPanel } from '@/components/admin/StatusFormPanel';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';

interface StatusInfo {
  value: string;
  label: string;
  description: string;
  color: string;
  canTransitionTo: string[];
}

export default function StatusManagerPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [editingStatus, setEditingStatus] = useState<StatusInfo | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const { alertState, showSuccess, closeAlert } = useCustomAlert();

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

  const getPaymentStatuses = (): StatusInfo[] => {
    return Object.entries(PAYMENT_STATUSES).map(([key, value]) => ({
      value: value,
      label: PAYMENT_STATUS_LABELS[value as PaymentStatus],
      description: PAYMENT_STATUS_DESCRIPTIONS[value as PaymentStatus],
      color: PAYMENT_STATUS_COLORS[value as PaymentStatus],
      canTransitionTo: PAYMENT_STATUS_TRANSITIONS[value as PaymentStatus] || []
    }));
  };

  const handleEditStatus = (status: StatusInfo) => {
    setEditingStatus(status);
    setIsEditorOpen(true);
  };

  const handleSaveStatus = (updatedStatus: StatusInfo) => {
    console.log('Statut mis à jour:', updatedStatus);
    showSuccess('Les modifications seront appliquées dans une prochaine version');
    setIsEditorOpen(false);
    setEditingStatus(null);
  };

  const renderStatusCard = (status: StatusInfo, showActions = true) => {
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
          {showActions && (
            <div className="flex gap-1">
              <button
                onClick={() => handleEditStatus(status)}
                className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                title="Éditer le statut"
              >
                <Edit2 className="w-4 h-4 text-amber-600" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Voir les détails"
              >
                <Eye className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
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
                  : activeTab === 'payment'
                  ? PAYMENT_STATUS_LABELS[nextStatus as PaymentStatus]
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

  const renderOverview = () => {
    const allWorkflows = [
      {
        name: 'Production',
        icon: Package,
        color: 'bg-blue-50 border-blue-200',
        iconColor: 'text-blue-600',
        statuses: getProductionStatuses()
      },
      {
        name: 'Expédition',
        icon: Plane,
        color: 'bg-amber-50 border-amber-200',
        iconColor: 'text-amber-600',
        statuses: getShippingStatuses()
      },
      {
        name: 'Ventes',
        icon: DollarSign,
        color: 'bg-emerald-50 border-emerald-200',
        iconColor: 'text-emerald-600',
        statuses: getSalesStatuses()
      },
      {
        name: 'Paiements',
        icon: CreditCard,
        color: 'bg-slate-50 border-slate-200',
        iconColor: 'text-slate-600',
        statuses: getPaymentStatuses()
      }
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {allWorkflows.map(workflow => {
            const Icon = workflow.icon;
            return (
              <Card key={workflow.name} className={`p-5 border-2 ${workflow.color}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 bg-white rounded-lg`}>
                    <Icon className={`w-5 h-5 ${workflow.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                    <p className="text-xs text-gray-600">{workflow.statuses.length} statuts</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {workflow.statuses.map((status, idx) => (
                    <div key={status.value} className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </span>
                      {idx < workflow.statuses.length - 1 && status.canTransitionTo.length > 0 && (
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Vue Globale',
      icon: Workflow
    },
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
    },
    {
      id: 'payment',
      label: 'Paiements',
      icon: CreditCard
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
      case 'payment':
        return getPaymentStatuses();
      default:
        return [];
    }
  };

  const getAvailableStatusesForEditor = () => {
    const statuses = getStatusesForTab();
    return statuses.map(s => ({ value: s.value, label: s.label }));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header - Titre réduit */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-6 h-6 text-amber-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Gestion des Statuts
              </h1>
            </div>
            <p className="text-sm text-gray-600">
              Visualisez et gérez les workflows de l'application
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

        {/* Content */}
        {activeTab === 'overview' ? (
          renderOverview()
        ) : (
          <>
            {/* Status Cards Grid */}
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {tabs.find(t => t.id === activeTab)?.label}
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
            <Card className="bg-amber-50 border-amber-200 p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Settings className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1 text-sm">
                    Statuts du Système
                  </h3>
                  <p className="text-xs text-amber-800">
                    Les statuts affichés sont définis dans le code et utilisés pour suivre
                    la progression des processus. Les modifications seront disponibles dans une prochaine version.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Editor Form Panel */}
      {isEditorOpen && editingStatus && (
        <StatusFormPanel
          status={editingStatus}
          availableStatuses={getAvailableStatusesForEditor()}
          onSave={handleSaveStatus}
          onCancel={() => {
            setIsEditorOpen(false);
            setEditingStatus(null);
          }}
          module={tabs.find(t => t.id === activeTab)?.label || ''}
        />
      )}

      {/* Alert */}
      {alertState.isOpen && (
        <CustomAlert
          isOpen={alertState.isOpen}
          onClose={closeAlert}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
        />
      )}
    </MainLayout>
  );
}
