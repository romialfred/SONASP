import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, KeyRound, Loader2, PencilLine, ShieldCheck, Users } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errorMessage';
import { canManageAccount } from '@/lib/roleHierarchy';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import { supabase } from '@/lib/supabase';
import { userPermissionsService } from '@/services/userPermissionsService';
import type { UserRole } from '@/types/auth';
import './admin.css';

interface AccountPermissionSummary {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  modules: number;
  editableModules: number;
}

interface PermissionRow {
  user_id: string;
  module_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

export function RolesPermissionsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [accounts, setAccounts] = useState<AccountPermissionSummary[]>([]);
  const [moduleCount, setModuleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesResult, permissionsResult, modulesResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, email, full_name, role, is_active')
          .order('role')
          .order('full_name'),
        supabase
          .from('user_permissions')
          .select('user_id, module_id, can_view, can_create, can_edit, can_delete, can_approve'),
        userPermissionsService.listModules(),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (permissionsResult.error) throw permissionsResult.error;
      if (modulesResult.error) throw new Error(modulesResult.error);

      const canonicalModuleIds = new Set(modulesResult.modules.map(({ id }) => id));
      const permissionsByUser = new Map<string, PermissionRow[]>();
      (permissionsResult.data || []).filter((permission) => (
        canonicalModuleIds.has(permission.module_id)
      )).forEach((permission) => {
        const rows = permissionsByUser.get(permission.user_id) || [];
        rows.push(permission as PermissionRow);
        permissionsByUser.set(permission.user_id, rows);
      });

      setModuleCount(modulesResult.modules.length);
      setAccounts((profilesResult.data || []).map((profile) => {
        const permissions = permissionsByUser.get(profile.id) || [];
        return {
          ...profile,
          role: profile.role as UserRole,
          modules: permissions.filter((permission) => permission.can_view).length,
          editableModules: permissions.filter((permission) => (
            permission.can_create || permission.can_edit || permission.can_delete || permission.can_approve
          )).length,
        };
      }));
    } catch (reason) {
      setAccounts([]);
      setError(errorMessage(reason, 'Impossible de charger la matrice des habilitations.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleCount = useMemo(() => new Set(accounts.map(({ role }) => role)).size, [accounts]);
  const activeCount = useMemo(() => accounts.filter(({ is_active }) => is_active).length, [accounts]);
  const completeAdministrators = useMemo(() => accounts.filter((account) => (
    account.is_active
    && ['owner', 'admin'].includes(account.role)
    && account.modules >= moduleCount
  )).length, [accounts, moduleCount]);

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page roles-permissions">
        <PageHeader
          icon={KeyRound}
          title="Rôles & permissions"
          subtitle="Contrôle centralisé des rôles, modules ouverts et habilitations individuelles."
          breadcrumb={[{ label: 'Administration' }, { label: 'Rôles & permissions' }]}
        />

        {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}

        <Note tone="info" icon={ShieldCheck}>
          Le Owner conserve le périmètre global. Un Administrateur voit tous les modules actifs,
          tandis que les opérations métier sensibles restent soumises à leurs capacités dédiées.
        </Note>

        <StatGrid
          ariaLabel="Synthèse des rôles et permissions"
          items={[
            { label: 'Comptes actifs', value: activeCount, icon: Users, tone: 'green' },
            { label: 'Rôles utilisés', value: roleCount, icon: ShieldCheck, tone: 'violet' },
            { label: 'Modules habilitables', value: moduleCount, icon: KeyRound, tone: 'blue' },
            {
              label: 'Administrateurs complets',
              value: completeAdministrators,
              hint: 'Owner et Administrateurs couvrant tout le catalogue actif',
              icon: ShieldCheck,
              tone: 'gold',
            },
          ]}
        />

        <Section
          id="matrice-comptes"
          icon={KeyRound}
          tone="emerald"
          title="Habilitations par compte"
          description="Ouvrez un compte pour modifier son identité, son rôle ou sa matrice de modules."
        >
          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la matrice…
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              title="Aucun compte disponible"
              description="La matrice ne contient aucun compte administrable."
            />
          ) : (
            <div className="admin-page__table-wrap">
              <table className="admin-page__table">
                <caption className="sr-only">Rôles et habilitations des comptes</caption>
                <thead>
                  <tr>
                    <th scope="col">Compte</th>
                    <th scope="col">Rôle</th>
                    <th scope="col">État</th>
                    <th scope="col">Modules ouverts</th>
                    <th scope="col">Modules modifiables</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const manageable = canManageAccount(
                      currentUser?.role,
                      account.role,
                      currentUser?.id,
                      account.id,
                    );
                    return (
                      <tr key={account.id}>
                        <td><strong>{account.full_name || account.email}</strong><small>{account.email}</small></td>
                        <td><Badge tone={roleTone(account.role)}>{roleLabel(account.role)}</Badge></td>
                        <td><Badge tone={account.is_active ? 'success' : 'danger'}>{account.is_active ? 'Actif' : 'Désactivé'}</Badge></td>
                        <td>{account.modules} / {moduleCount}</td>
                        <td>{account.editableModules}</td>
                        <td>
                          <button
                            type="button"
                            className="sn-btn sn-btn--sm"
                            disabled={!manageable}
                            onClick={() => navigate(`/users/edit?userId=${account.id}&step=permissions`)}
                          >
                            <PencilLine aria-hidden="true" /> Modifier
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}

export default RolesPermissionsPage;
