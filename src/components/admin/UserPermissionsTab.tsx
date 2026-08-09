import { Lock, CheckCircle, XCircle, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface UserPermissionsTabProps {
  userId: string;
  userRole: string;
}

interface Module {
  id: string;
  name: string;
  description: string;
  permissions: {
    id: string;
    label: string;
    description: string;
  }[];
}

const MODULES: Module[] = [
  {
    id: 'dashboard',
    name: 'Tableau de Bord',
    description: 'Tableaux de bord et vues d\'ensemble',
    permissions: [
      { id: 'dashboard_view', label: 'Consulter', description: 'Voir tableau de bord' },
      { id: 'dashboard_manage', label: 'Gérer', description: 'Gérer les dashboards' }
    ]
  },
  {
    id: 'production',
    name: 'Production',
    description: 'Gestion de la production quotidienne et des lots',
    permissions: [
      { id: 'production_view', label: 'Consulter', description: 'Voir les données de production' },
      { id: 'production_create', label: 'Créer', description: 'Enregistrer nouvelle production' },
      { id: 'production_update', label: 'Modifier', description: 'Modifier les enregistrements' },
      { id: 'production_delete', label: 'Supprimer', description: 'Supprimer des enregistrements' },
      { id: 'production_approve', label: 'Approuver', description: 'Approuver pour expédition' }
    ]
  },
  {
    id: 'shipping',
    name: 'Expédition',
    description: 'Préparation et gestion des expéditions',
    permissions: [
      { id: 'shipping_view', label: 'Consulter', description: 'Voir les expéditions' },
      { id: 'shipping_create', label: 'Créer', description: 'Préparer expédition' },
      { id: 'shipping_update', label: 'Modifier', description: 'Modifier expéditions' },
      { id: 'shipping_delete', label: 'Supprimer', description: 'Supprimer expéditions' },
      { id: 'shipping_status', label: 'Statut', description: 'Changer statut expédition' }
    ]
  },
  {
    id: 'freight',
    name: 'Fret & Transport',
    description: 'Gestion des expéditions de fret',
    permissions: [
      { id: 'freight_view', label: 'Consulter', description: 'Voir expéditions fret' },
      { id: 'freight_create', label: 'Créer', description: 'Créer expédition fret' },
      { id: 'freight_update', label: 'Modifier', description: 'Modifier expéditions' },
      { id: 'freight_approve', label: 'Approuver', description: 'Approuver expéditions' }
    ]
  },
  {
    id: 'freight_customs',
    name: 'Douanes & Documents',
    description: 'Factures et documents douaniers',
    permissions: [
      { id: 'customs_view', label: 'Consulter', description: 'Voir documents douanes' },
      { id: 'customs_create', label: 'Créer', description: 'Créer documents' },
      { id: 'customs_update', label: 'Modifier', description: 'Modifier documents' },
      { id: 'customs_approve', label: 'Approuver', description: 'Approuver documents' }
    ]
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Certificats d\'essai et autres documents',
    permissions: [
      { id: 'documents_view', label: 'Consulter', description: 'Voir documents' },
      { id: 'documents_upload', label: 'Télécharger', description: 'Télécharger documents' },
      { id: 'documents_delete', label: 'Supprimer', description: 'Supprimer documents' },
      { id: 'documents_approve', label: 'Approuver', description: 'Approuver certificats' }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventaire',
    description: 'Gestion du stock or et argent',
    permissions: [
      { id: 'inventory_view', label: 'Consulter', description: 'Voir l\'inventaire' },
      { id: 'inventory_add', label: 'Ajouter', description: 'Ajouter au stock' },
      { id: 'inventory_adjust', label: 'Ajuster', description: 'Ajustements inventaire' },
      { id: 'inventory_transfer', label: 'Transférer', description: 'Transférer entre sites' }
    ]
  },
  {
    id: 'receiving',
    name: 'Réception',
    description: 'Réception et confirmation des lots',
    permissions: [
      { id: 'receiving_view', label: 'Consulter', description: 'Voir réceptions' },
      { id: 'receiving_confirm', label: 'Confirmer', description: 'Confirmer réception' },
      { id: 'receiving_reconcile', label: 'Réconcilier', description: 'Réconcilier écarts' }
    ]
  },
  {
    id: 'refining',
    name: 'Raffinage',
    description: 'Processus de raffinage et résultats',
    permissions: [
      { id: 'refining_view', label: 'Consulter', description: 'Voir le raffinage' },
      { id: 'refining_record', label: 'Enregistrer', description: 'Enregistrer résultats' },
      { id: 'refining_approve', label: 'Approuver', description: 'Approuver résultats' }
    ]
  },
  {
    id: 'sales',
    name: 'Ventes',
    description: 'Gestion des ventes d\'or',
    permissions: [
      { id: 'sales_view', label: 'Consulter', description: 'Voir les ventes' },
      { id: 'sales_create', label: 'Créer', description: 'Créer nouvelle vente' },
      { id: 'sales_update', label: 'Modifier', description: 'Modifier les ventes' },
      { id: 'sales_delete', label: 'Supprimer', description: 'Supprimer des ventes' },
      { id: 'sales_approve', label: 'Approuver', description: 'Approuver les ventes' },
      { id: 'sales_pricing', label: 'Tarification', description: 'Modifier les prix' }
    ]
  },
  {
    id: 'presales',
    name: 'Pré-Ventes',
    description: 'Gestion des pré-ventes et estimations',
    permissions: [
      { id: 'presales_view', label: 'Consulter', description: 'Voir pré-ventes' },
      { id: 'presales_create', label: 'Créer', description: 'Créer pré-vente' },
      { id: 'presales_update', label: 'Modifier', description: 'Modifier pré-ventes' },
      { id: 'presales_delete', label: 'Supprimer', description: 'Supprimer pré-ventes' }
    ]
  },
  {
    id: 'customers',
    name: 'Clients',
    description: 'Gestion des clients et profils',
    permissions: [
      { id: 'customers_view', label: 'Consulter', description: 'Voir clients' },
      { id: 'customers_create', label: 'Créer', description: 'Créer nouveau client' },
      { id: 'customers_update', label: 'Modifier', description: 'Modifier clients' },
      { id: 'customers_delete', label: 'Supprimer', description: 'Supprimer clients' }
    ]
  },
  {
    id: 'payments',
    name: 'Paiements',
    description: 'Gestion des paiements clients',
    permissions: [
      { id: 'payments_view', label: 'Consulter', description: 'Voir les paiements' },
      { id: 'payments_record', label: 'Enregistrer', description: 'Enregistrer paiement' },
      { id: 'payments_update', label: 'Modifier', description: 'Modifier paiements' },
      { id: 'payments_approve', label: 'Approuver', description: 'Approuver paiements' },
      { id: 'payments_virtual', label: 'Paiements Virtuels', description: 'Gérer paiements virtuels' }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytique',
    description: 'Analyses et intelligence d\'affaires',
    permissions: [
      { id: 'analytics_view', label: 'Consulter', description: 'Voir rapports' },
      { id: 'analytics_export', label: 'Exporter', description: 'Exporter données' },
      { id: 'analytics_advanced', label: 'Avancé', description: 'Analyses avancées' }
    ]
  },
  {
    id: 'reports',
    name: 'Rapports',
    description: 'Génération et gestion des rapports',
    permissions: [
      { id: 'reports_view', label: 'Consulter', description: 'Voir rapports' },
      { id: 'reports_generate', label: 'Générer', description: 'Générer rapports' },
      { id: 'reports_schedule', label: 'Planifier', description: 'Planifier rapports' },
      { id: 'reports_export', label: 'Exporter', description: 'Exporter rapports' }
    ]
  },
  {
    id: 'licenses',
    name: 'Licences d\'Export',
    description: 'Gestion des licences d\'exportation',
    permissions: [
      { id: 'licenses_view', label: 'Consulter', description: 'Voir licences' },
      { id: 'licenses_create', label: 'Créer', description: 'Créer licence' },
      { id: 'licenses_update', label: 'Modifier', description: 'Modifier licences' },
      { id: 'licenses_approve', label: 'Approuver', description: 'Approuver licences' }
    ]
  },
  {
    id: 'performance',
    name: 'Performance & Budget',
    description: 'Gestion des budgets et prévisions',
    permissions: [
      { id: 'performance_view', label: 'Consulter', description: 'Voir performance' },
      { id: 'performance_budget', label: 'Budgets', description: 'Gérer budgets' },
      { id: 'performance_forecast', label: 'Prévisions', description: 'Gérer prévisions' }
    ]
  },
  {
    id: 'prices',
    name: 'Prix & Taux de Change',
    description: 'Gestion des prix or et taux FX',
    permissions: [
      { id: 'prices_view', label: 'Consulter', description: 'Voir prix et taux' },
      { id: 'prices_update', label: 'Modifier', description: 'Modifier prix' },
      { id: 'prices_import', label: 'Importer', description: 'Importer données' }
    ]
  },
  {
    id: 'stakeholders',
    name: 'Parties Prenantes',
    description: 'Gestion des sociétés minières, raffineries, etc.',
    permissions: [
      { id: 'stakeholders_view', label: 'Consulter', description: 'Voir parties prenantes' },
      { id: 'stakeholders_create', label: 'Créer', description: 'Créer partie prenante' },
      { id: 'stakeholders_update', label: 'Modifier', description: 'Modifier parties prenantes' },
      { id: 'stakeholders_delete', label: 'Supprimer', description: 'Supprimer parties prenantes' }
    ]
  },
  {
    id: 'users',
    name: 'Gestion Utilisateurs',
    description: 'Gestion des utilisateurs et permissions',
    permissions: [
      { id: 'users_view', label: 'Consulter', description: 'Voir utilisateurs' },
      { id: 'users_create', label: 'Créer', description: 'Créer utilisateur' },
      { id: 'users_update', label: 'Modifier', description: 'Modifier utilisateurs' },
      { id: 'users_delete', label: 'Supprimer', description: 'Supprimer utilisateurs' },
      { id: 'users_permissions', label: 'Permissions', description: 'Gérer permissions' }
    ]
  },
  {
    id: 'settings',
    name: 'Paramètres Système',
    description: 'Configuration et paramètres',
    permissions: [
      { id: 'settings_view', label: 'Consulter', description: 'Voir paramètres' },
      { id: 'settings_update', label: 'Modifier', description: 'Modifier paramètres' },
      { id: 'settings_status', label: 'Statuts', description: 'Gérer gestionnaire statuts' }
    ]
  },
  {
    id: 'audit',
    name: 'Audit & Conformité',
    description: 'Journal d\'audit et traçabilité',
    permissions: [
      { id: 'audit_view', label: 'Consulter', description: 'Voir journal audit' },
      { id: 'audit_export', label: 'Exporter', description: 'Exporter logs audit' }
    ]
  },
  {
    id: 'approvals',
    name: 'Approbations',
    description: 'Gestion des workflows d\'approbation',
    permissions: [
      { id: 'approvals_view', label: 'Consulter', description: 'Voir approbations' },
      { id: 'approvals_approve', label: 'Approuver', description: 'Approuver demandes' },
      { id: 'approvals_reject', label: 'Rejeter', description: 'Rejeter demandes' }
    ]
  }
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  management: [
    'dashboard_view', 'dashboard_manage',
    'production_view', 'production_create', 'production_update', 'production_delete', 'production_approve',
    'shipping_view', 'shipping_create', 'shipping_update', 'shipping_delete', 'shipping_status',
    'freight_view', 'freight_create', 'freight_update', 'freight_approve',
    'customs_view', 'customs_create', 'customs_update', 'customs_approve',
    'documents_view', 'documents_upload', 'documents_delete', 'documents_approve',
    'inventory_view', 'inventory_add', 'inventory_adjust', 'inventory_transfer',
    'receiving_view', 'receiving_confirm', 'receiving_reconcile',
    'refining_view', 'refining_record', 'refining_approve',
    'sales_view', 'sales_create', 'sales_update', 'sales_delete', 'sales_approve', 'sales_pricing',
    'presales_view', 'presales_create', 'presales_update', 'presales_delete',
    'customers_view', 'customers_create', 'customers_update', 'customers_delete',
    'payments_view', 'payments_record', 'payments_update', 'payments_approve', 'payments_virtual',
    'analytics_view', 'analytics_export', 'analytics_advanced',
    'reports_view', 'reports_generate', 'reports_schedule', 'reports_export',
    'licenses_view', 'licenses_create', 'licenses_update', 'licenses_approve',
    'performance_view', 'performance_budget', 'performance_forecast',
    'prices_view', 'prices_update', 'prices_import',
    'stakeholders_view', 'stakeholders_create', 'stakeholders_update', 'stakeholders_delete',
    'users_view', 'users_create', 'users_update', 'users_delete', 'users_permissions',
    'settings_view', 'settings_update', 'settings_status',
    'audit_view', 'audit_export',
    'approvals_view', 'approvals_approve', 'approvals_reject'
  ],
  factory: [
    'dashboard_view',
    'production_view', 'production_create', 'production_update',
    'shipping_view', 'shipping_create',
    'documents_view', 'documents_upload',
    'inventory_view', 'inventory_add',
    'licenses_view', 'licenses_create',
    'reports_view',
    'analytics_view'
  ],
  airport: [
    'dashboard_view',
    'shipping_view', 'shipping_update', 'shipping_status',
    'freight_view',
    'documents_view',
    'inventory_view',
    'receiving_view', 'receiving_confirm', 'receiving_reconcile',
    'reports_view',
    'analytics_view'
  ],
  refinery: [
    'dashboard_view',
    'freight_view',
    'documents_view',
    'inventory_view', 'inventory_add', 'inventory_adjust',
    'receiving_view', 'receiving_confirm',
    'refining_view', 'refining_record',
    'reports_view',
    'analytics_view'
  ],
  customer: [
    'dashboard_view',
    'sales_view',
    'presales_view',
    'payments_view',
    'documents_view',
    'reports_view',
    'analytics_view'
  ]
};

export default function UserPermissionsTab({ userId, userRole }: UserPermissionsTabProps) {
  const rolePermissions = ROLE_PERMISSIONS[userRole.toLowerCase()] || [];

  const hasPermission = (permissionId: string) => {
    return rolePermissions.includes(permissionId);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      management: 'Management',
      factory: 'Usine',
      airport: 'Aéroport',
      refinery: 'Raffinerie',
      customer: 'Client'
    };
    return labels[role.toLowerCase()] || role;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Permissions par Module
          </h3>
          <p className="text-sm text-slate-600">
            Rôle: <span className="font-medium">{getRoleLabel(userRole)}</span>
          </p>
        </div>
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Permissions Basées sur le Rôle
            </h4>
            <p className="text-sm text-blue-700">
              Les permissions sont automatiquement attribuées en fonction du rôle de l'utilisateur.
              Pour modifier les permissions, vous devez changer le rôle de l'utilisateur ou définir
              des permissions personnalisées pour ce rôle dans les paramètres système.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {MODULES.map((module) => {
          const modulePermissions = module.permissions.filter(p => hasPermission(p.id));
          const hasAnyPermission = modulePermissions.length > 0;

          return (
            <Card key={module.id} className={`p-6 ${hasAnyPermission ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className={`w-5 h-5 ${hasAnyPermission ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <h4 className="text-base font-semibold text-slate-900">
                      {module.name}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-600">{module.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  hasAnyPermission
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {modulePermissions.length}/{module.permissions.length} permissions
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {module.permissions.map((permission) => {
                  const granted = hasPermission(permission.id);
                  return (
                    <div
                      key={permission.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        granted
                          ? 'bg-white border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {granted ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          granted ? 'text-slate-900' : 'text-slate-500'
                        }`}>
                          {permission.label}
                        </div>
                        <div className={`text-xs ${
                          granted ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {permission.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 bg-slate-50 border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Résumé des Permissions
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {rolePermissions.length}
            </div>
            <div className="text-xs text-slate-600">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {MODULES.filter(m => m.permissions.some(p => hasPermission(p.id))).length}
            </div>
            <div className="text-xs text-slate-600">Modules Accessibles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {rolePermissions.filter(p => p.includes('approve')).length}
            </div>
            <div className="text-xs text-slate-600">Approbations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {rolePermissions.filter(p => p.includes('admin')).length}
            </div>
            <div className="text-xs text-slate-600">Admin</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
