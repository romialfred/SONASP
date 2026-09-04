import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  KeyRound,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errorMessage';
import { assignableRoles, isUserRole } from '@/lib/roleHierarchy';
import { roleLabel } from '@/lib/roleLabels';
import {
  accessGovernanceService,
  type PortalConfiguration,
} from '@/services/accessGovernanceService';
import {
  ACCESS_PERMISSION_CODES,
  type AccessPermissionCode,
  type AccessPortal,
  type AccessRole,
  type ActorCategory,
  type RoleMatrix,
  type RolePermissionCell,
} from '@/types/accessGovernance';
import type { UserRole } from '@/types/auth';
import './admin.css';

const permissionLabels: Record<AccessPermissionCode, string> = {
  view: 'Voir',
  create: 'Créer',
  edit: 'Modifier',
  delete: 'Supprimer',
  submit: 'Soumettre',
  validate: 'Valider',
  approve: 'Approuver',
  reject: 'Rejeter',
  export: 'Exporter',
  download: 'Télécharger',
  admin: 'Administrer',
};

const emptyForm = () => ({
  code: '',
  name: '',
  description: '',
  legacyRole: 'management',
  isActive: true,
  categories: [] as string[],
  reason: '',
});

/** Prépare un nouveau rôle avec un refus explicite pour chaque droit applicable. */
export function createBlankRoleMatrix(
  portalId: string,
  configuration: PortalConfiguration,
): RoleMatrix {
  const modules = configuration.modules.filter((module) => module.is_portal_active);
  return {
    role: {
      id: '',
      portal_id: portalId,
      portal_code: configuration.portal?.code ?? '',
      portal_name: configuration.portal?.name ?? '',
      code: '',
      name: '',
      description: null,
      legacy_role: 'management',
      is_active: true,
      is_system: false,
      user_count: 0,
      updated_at: '',
      updated_by_name: null,
      category_codes: [],
    },
    modules,
    permissions: modules.flatMap((module) => module.permissions.map((permissionCode) => ({
      module_id: module.id,
      permission_code: permissionCode,
      allowed: false,
    }))),
  };
}

export function RolesPermissionsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [portals, setPortals] = useState<AccessPortal[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [categories, setCategories] = useState<ActorCategory[]>([]);
  const [portalId, setPortalId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [portalRows, roleRows, categoryRows] = await Promise.all([
        accessGovernanceService.listPortals(true),
        accessGovernanceService.listRoles(undefined, true),
        accessGovernanceService.listActorCategories(),
      ]);
      setPortals(portalRows);
      setRoles(roleRows);
      setCategories(categoryRows);
      setPortalId((value) => value || portalRows[0]?.id || '');
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de charger les rôles.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!portalId) {
      setMatrix(null);
      return;
    }
    let active = true;
    setMatrixLoading(true);
    setError(null);
    const request = roleId
      ? accessGovernanceService.getRoleMatrix(roleId)
      : accessGovernanceService.getPortalConfiguration(portalId)
        .then((configuration) => createBlankRoleMatrix(portalId, configuration));

    void request.then((result) => {
      if (!active) return;
      setMatrix(result);
      if (roleId) {
        setForm({
          code: result.role.code,
          name: result.role.name,
          description: result.role.description ?? '',
          legacyRole: result.role.legacy_role,
          isActive: result.role.is_active,
          categories: result.role.category_codes,
          reason: '',
        });
      }
    }).catch((reason) => {
      if (active) setError(errorMessage(reason, 'Matrice du rôle indisponible.'));
    }).finally(() => {
      if (active) setMatrixLoading(false);
    });
    return () => { active = false; };
  }, [portalId, roleId]);

  const visibleRoles = useMemo(
    () => roles.filter((role) => role.portal_id === portalId),
    [portalId, roles],
  );
  const technicalRoles = useMemo<UserRole[]>(() => {
    const existing = [...new Set(roles.map(({ legacy_role }) => legacy_role))]
      .filter(isUserRole);
    return assignableRoles(user?.role, existing);
  }, [roles, user?.role]);

  const beginCreate = () => {
    setRoleId('');
    setForm(emptyForm());
    setError(null);
  };

  const selectPortal = (nextPortalId: string) => {
    setPortalId(nextPortalId);
    setRoleId('');
    setForm(emptyForm());
  };

  const togglePermission = (moduleId: string, permissionCode: AccessPermissionCode) => {
    if (!matrix) return;
    setMatrix({
      ...matrix,
      permissions: matrix.permissions.map((permission) => (
        permission.module_id === moduleId && permission.permission_code === permissionCode
          ? { ...permission, allowed: !permission.allowed }
          : permission
      )),
    });
  };

  const setModulePermissions = (moduleId: string, allowed: boolean) => {
    if (!matrix) return;
    setMatrix({
      ...matrix,
      permissions: matrix.permissions.map((permission) => (
        permission.module_id === moduleId ? { ...permission, allowed } : permission
      )),
    });
  };

  const toggleCategory = (code: string) => setForm((current) => ({
    ...current,
    categories: current.categories.includes(code)
      ? current.categories.filter((item) => item !== code)
      : [...current.categories, code],
  }));

  const save = async () => {
    if (!portalId || !matrix || saving) return;
    if (!form.code.trim() || !form.name.trim() || form.categories.length === 0 || form.reason.trim().length < 10) {
      setError('Renseignez le code, le nom, au moins une catégorie et un motif détaillé d’au moins 10 caractères.');
      return;
    }
    if (!isUserRole(form.legacyRole) || !technicalRoles.includes(form.legacyRole)) {
      setError('Le rôle technique choisi ne peut pas être attribué par votre profil.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const permissions: RolePermissionCell[] = matrix.permissions;
      const saved = await accessGovernanceService.saveRole({
        id: roleId || null,
        portalId,
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        legacyRole: form.legacyRole,
        isActive: form.isActive,
        categoryCodes: form.categories,
        permissions,
        reason: form.reason.trim(),
      });
      addToast(roleId ? 'Rôle mis à jour' : 'Rôle créé', 'success');
      await load();
      setPortalId(saved.portal_id);
      setRoleId(saved.id);
    } catch (reason) {
      setError(errorMessage(reason, 'Enregistrement du rôle impossible.'));
    } finally {
      setSaving(false);
    }
  };

  const displayedModules = matrix?.modules.filter((module) => module.is_portal_active) ?? [];

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page access-governance">
        <PageHeader
          icon={KeyRound}
          title="Rôles & permissions"
          subtitle="Un rôle appartient à un seul portail ; chaque droit reste borné par le socle technique SONASP."
          breadcrumb={[{ label: 'Utilisateurs & Portails' }, { label: 'Rôles & permissions' }]}
          actions={<button type="button" className="sn-btn sn-btn--primary" onClick={beginCreate}><Plus /> Nouveau rôle</button>}
        />
        {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}
        <Note tone="info" icon={ShieldCheck}>
          Seules les autorisations applicables et les rôles techniques que votre profil peut attribuer sont proposés. Une case rouge constitue un refus explicite.
        </Note>
        <div className="access-layout">
          <Section id="role-list" icon={KeyRound} title="Rôles par portail">
            <Field label="Portail">
              <select className="sn-input" value={portalId} onChange={(event) => selectPortal(event.target.value)}>
                {portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}
              </select>
            </Field>
            {loading ? (
              <div className="admin-page__loading"><Loader2 className="sn-spin" /> Chargement…</div>
            ) : visibleRoles.length === 0 ? (
              <EmptyState title="Aucun rôle" description="Créez le premier rôle de ce portail." />
            ) : (
              <div className="access-card-list">
                {visibleRoles.map((role) => (
                  <button
                    type="button"
                    className={`access-card${roleId === role.id ? ' is-selected' : ''}`}
                    key={role.id}
                    onClick={() => setRoleId(role.id)}
                  >
                    <span><strong>{role.name}</strong><small>{role.description || role.code}</small></span>
                    <span>
                      <Badge tone={role.is_active ? 'success' : 'danger'}>{role.is_active ? 'Actif' : 'Inactif'}</Badge>
                      <small>{role.user_count} utilisateur(s)</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Section>
          <Section id="role-editor" icon={ShieldCheck} tone="violet" title={roleId ? 'Définition du rôle' : 'Nouveau rôle'}>
            <div className="sn-form-grid">
              <Field label="Code" required>
                <input className="sn-input" value={form.code} disabled={Boolean(roleId && matrix?.role.is_system)} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              </Field>
              <Field label="Nom" required>
                <input className="sn-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Rôle technique" required>
                <select
                  className="sn-input"
                  value={form.legacyRole}
                  disabled={Boolean(roleId && matrix?.role.is_system)}
                  onChange={(event) => setForm({ ...form, legacyRole: event.target.value })}
                >
                  {technicalRoles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}
                </select>
              </Field>
              <Field label="État">
                <span className="access-switch"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Rôle actif</span>
              </Field>
              <Field label="Description" wide>
                <textarea className="sn-input" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
            </div>
            <h4 className="access-subtitle">Catégories d’acteurs compatibles</h4>
            <div className="access-choice-row">
              {categories.map((category) => (
                <label key={category.code} className={form.categories.includes(category.code) ? 'is-selected' : ''}>
                  <input type="checkbox" checked={form.categories.includes(category.code)} onChange={() => toggleCategory(category.code)} /> {category.name}
                </label>
              ))}
            </div>
            {matrixLoading ? (
              <div className="admin-page__loading"><Loader2 className="sn-spin" /> Chargement de la matrice…</div>
            ) : displayedModules.length === 0 ? (
              <EmptyState title="Aucun module actif" description="Activez d’abord les modules nécessaires dans la configuration du portail." />
            ) : (
              <div className="access-matrix-wrap">
                <table className="access-matrix">
                  <caption className="sr-only">Matrice des permissions du rôle</caption>
                  <thead><tr><th>Module</th>{ACCESS_PERMISSION_CODES.map((code) => <th key={code}>{permissionLabels[code]}</th>)}</tr></thead>
                  <tbody>
                    {displayedModules.map((module) => (
                      <tr key={module.id}>
                        <th>
                          <strong>{module.name}</strong>
                          <small>{module.group_name}</small>
                          <span className="access-row-actions">
                            <button type="button" onClick={() => setModulePermissions(module.id, true)} aria-label={`Tout autoriser pour ${module.name}`}><CheckCheck /> Tout autoriser</button>
                            <button type="button" onClick={() => setModulePermissions(module.id, false)} aria-label={`Tout refuser pour ${module.name}`}><XCircle /> Tout refuser</button>
                          </span>
                        </th>
                        {ACCESS_PERMISSION_CODES.map((code) => {
                          const permission = matrix?.permissions.find((item) => item.module_id === module.id && item.permission_code === code);
                          return (
                            <td key={code}>
                              {permission ? (
                                <button
                                  type="button"
                                  className={`access-permission ${permission.allowed ? 'is-allowed' : 'is-denied'}`}
                                  aria-label={`${permissionLabels[code]} — ${module.name} : ${permission.allowed ? 'autorisé' : 'refusé'}`}
                                  onClick={() => togglePermission(module.id, code)}
                                >
                                  {permission.allowed ? <Check /> : <X />}
                                </button>
                              ) : <span className="access-na" aria-label="Non applicable">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Field label="Motif de la modification" required hint="Au moins 10 caractères ; le motif sera conservé dans le journal d’audit.">
              <textarea className="sn-input" rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
            </Field>
            <div className="sn-form-actions">
              <button type="button" className="sn-btn sn-btn--primary" disabled={saving || matrixLoading || !matrix} onClick={() => void save()}>
                {saving ? <Loader2 className="sn-spin" /> : <Save />} Enregistrer
              </button>
            </div>
          </Section>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}

export default RolesPermissionsPage;
