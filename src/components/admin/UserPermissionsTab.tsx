import { useState } from 'react';
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
    id: 'sales',
    name: 'Ventes',
    description: 'Gestion des ventes et des clients',
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
    id: 'shipping',
    name: 'Expédition',
    description: 'Gestion des expéditions et de la logistique',
    permissions: [
      { id: 'shipping_view', label: 'Consulter', description: 'Voir les expéditions' },
      { id: 'shipping_create', label: 'Créer', description: 'Préparer expédition' },
      { id: 'shipping_update', label: 'Modifier', description: 'Modifier expéditions' },
      { id: 'shipping_delete', label: 'Supprimer', description: 'Supprimer expéditions' },
      { id: 'shipping_status', label: 'Statut', description: 'Changer statut expédition' }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventaire',
    description: 'Gestion du stock et de l\'inventaire',
    permissions: [
      { id: 'inventory_view', label: 'Consulter', description: 'Voir l\'inventaire' },
      { id: 'inventory_add', label: 'Ajouter', description: 'Ajouter au stock' },
      { id: 'inventory_adjust', label: 'Ajuster', description: 'Ajustements inventaire' },
      { id: 'inventory_transfer', label: 'Transférer', description: 'Transférer entre sites' }
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
      { id: 'payments_approve', label: 'Approuver', description: 'Approuver paiements' }
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
    id: 'freight',
    name: 'Fret & Douanes',
    description: 'Gestion du fret et des documents douaniers',
    permissions: [
      { id: 'freight_view', label: 'Consulter', description: 'Voir fret/douanes' },
      { id: 'freight_create', label: 'Créer', description: 'Créer expédition fret' },
      { id: 'freight_update', label: 'Modifier', description: 'Modifier documents' },
      { id: 'freight_approve', label: 'Approuver', description: 'Approuver documents' }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytique',
    description: 'Rapports et tableaux de bord',
    permissions: [
      { id: 'analytics_view', label: 'Consulter', description: 'Voir rapports' },
      { id: 'analytics_export', label: 'Exporter', description: 'Exporter données' },
      { id: 'analytics_advanced', label: 'Avancé', description: 'Analyses avancées' }
    ]
  },
  {
    id: 'admin',
    name: 'Administration',
    description: 'Paramètres système et utilisateurs',
    permissions: [
      { id: 'admin_users', label: 'Utilisateurs', description: 'Gérer utilisateurs' },
      { id: 'admin_roles', label: 'Rôles', description: 'Gérer rôles et permissions' },
      { id: 'admin_settings', label: 'Paramètres', description: 'Paramètres système' },
      { id: 'admin_audit', label: 'Audit', description: 'Journal d\'audit' }
    ]
  }
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  management: [
    'production_view', 'production_create', 'production_update', 'production_delete', 'production_approve',
    'sales_view', 'sales_create', 'sales_update', 'sales_delete', 'sales_approve', 'sales_pricing',
    'shipping_view', 'shipping_create', 'shipping_update', 'shipping_delete', 'shipping_status',
    'inventory_view', 'inventory_add', 'inventory_adjust', 'inventory_transfer',
    'payments_view', 'payments_record', 'payments_update', 'payments_approve',
    'refining_view', 'refining_record', 'refining_approve',
    'freight_view', 'freight_create', 'freight_update', 'freight_approve',
    'analytics_view', 'analytics_export', 'analytics_advanced',
    'admin_users', 'admin_roles', 'admin_settings', 'admin_audit'
  ],
  factory: [
    'production_view', 'production_create', 'production_update',
    'inventory_view', 'inventory_add',
    'shipping_view',
    'analytics_view'
  ],
  airport: [
    'shipping_view', 'shipping_update', 'shipping_status',
    'inventory_view',
    'analytics_view'
  ],
  refinery: [
    'refining_view', 'refining_record',
    'inventory_view',
    'analytics_view'
  ],
  customer: [
    'sales_view',
    'payments_view',
    'shipping_view',
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
