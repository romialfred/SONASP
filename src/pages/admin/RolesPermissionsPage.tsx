import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, KeyRound, Loader2, Plus, Save, ShieldCheck, X } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/errorMessage';
import { accessGovernanceService } from '@/services/accessGovernanceService';
import { ACCESS_PERMISSION_CODES, type AccessPermissionCode, type AccessPortal, type AccessRole, type ActorCategory, type RoleMatrix, type RolePermissionCell } from '@/types/accessGovernance';
import './admin.css';

const permissionLabels: Record<AccessPermissionCode, string> = {
  view: 'Voir', create: 'Créer', edit: 'Modifier', delete: 'Supprimer', submit: 'Soumettre', validate: 'Valider', approve: 'Approuver', reject: 'Rejeter', export: 'Exporter', download: 'Télécharger', admin: 'Administrer',
};
const legacyRoles = ['admin','management','manager','dgmg','dgi','mine','comptoir','collector','customer'] as const;

export function RolesPermissionsPage() {
  const { addToast } = useToast();
  const [portals, setPortals] = useState<AccessPortal[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [categories, setCategories] = useState<ActorCategory[]>([]);
  const [portalId, setPortalId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', legacyRole: 'management', isActive: true, categories: [] as string[], reason: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [portalRows, roleRows, categoryRows] = await Promise.all([accessGovernanceService.listPortals(true), accessGovernanceService.listRoles(undefined, true), accessGovernanceService.listActorCategories()]);
      setPortals(portalRows); setRoles(roleRows); setCategories(categoryRows);
      setPortalId((value) => value || portalRows[0]?.id || '');
    } catch (reason) { setError(errorMessage(reason, 'Impossible de charger les rôles.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (roleId && !roles.some((role) => role.id === roleId && role.portal_id === portalId)) setRoleId(''); }, [portalId, roleId, roles]);
  useEffect(() => {
    if (!roleId) { setMatrix(null); return; }
    let active = true;
    void accessGovernanceService.getRoleMatrix(roleId).then((result) => {
      if (!active) return;
      setMatrix(result);
      setForm({ code: result.role.code, name: result.role.name, description: result.role.description ?? '', legacyRole: result.role.legacy_role, isActive: result.role.is_active, categories: result.role.category_codes, reason: '' });
    }).catch((reason) => active && setError(errorMessage(reason, 'Matrice du rôle indisponible.')));
    return () => { active = false; };
  }, [roleId]);

  const visibleRoles = useMemo(() => roles.filter((role) => role.portal_id === portalId), [portalId, roles]);
  const create = () => { setRoleId(''); setMatrix(null); setForm({ code: '', name: '', description: '', legacyRole: 'management', isActive: true, categories: [], reason: '' }); };
  const togglePermission = (moduleId: string, permissionCode: AccessPermissionCode) => {
    if (!matrix) return;
    setMatrix({ ...matrix, permissions: matrix.permissions.map((permission) => permission.module_id === moduleId && permission.permission_code === permissionCode ? { ...permission, allowed: !permission.allowed } : permission) });
  };
  const toggleCategory = (code: string) => setForm((current) => ({ ...current, categories: current.categories.includes(code) ? current.categories.filter((item) => item !== code) : [...current.categories, code] }));
  const save = async () => {
    if (!portalId || saving) return;
    if (!form.code.trim() || !form.name.trim() || form.categories.length === 0 || form.reason.trim().length < 10) { setError('Renseignez le code, le nom, au moins une catégorie et un motif détaillé.'); return; }
    setSaving(true); setError(null);
    try {
      const permissions: RolePermissionCell[] = matrix?.permissions ?? [];
      const saved = await accessGovernanceService.saveRole({ id: roleId || null, portalId, code: form.code.trim().toLowerCase(), name: form.name.trim(), description: form.description.trim(), legacyRole: form.legacyRole, isActive: form.isActive, categoryCodes: form.categories, permissions, reason: form.reason.trim() });
      addToast(roleId ? 'Rôle mis à jour' : 'Rôle créé', 'success');
      await load(); setPortalId(saved.portal_id); setRoleId(saved.id);
    } catch (reason) { setError(errorMessage(reason, 'Enregistrement du rôle impossible.')); }
    finally { setSaving(false); }
  };

  return <NationalDashboardLayout><div className="sn-page admin-page access-governance">
    <PageHeader icon={KeyRound} title="Rôles & permissions" subtitle="Un rôle appartient à un seul portail ; chaque droit reste borné par le socle technique SONASP." breadcrumb={[{ label: 'Utilisateurs & Portails' }, { label: 'Rôles & permissions' }]} actions={<button type="button" className="sn-btn sn-btn--primary" onClick={create}><Plus /> Nouveau rôle</button>} />
    {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}
    <Note tone="info" icon={ShieldCheck}>Les colonnes affichent uniquement les permissions applicables au module. Une case vide est un refus explicite, jamais une autorisation implicite.</Note>
    <div className="access-layout">
      <Section id="role-list" icon={KeyRound} title="Rôles par portail">
        <Field label="Portail"><select className="sn-input" value={portalId} onChange={(e) => setPortalId(e.target.value)}>{portals.map((portal) => <option key={portal.id} value={portal.id}>{portal.name}</option>)}</select></Field>
        {loading ? <div className="admin-page__loading"><Loader2 className="sn-spin" /> Chargement…</div> : visibleRoles.length === 0 ? <EmptyState title="Aucun rôle" description="Créez le premier rôle de ce portail." /> : <div className="access-card-list">{visibleRoles.map((role) => <button type="button" className={`access-card${roleId === role.id ? ' is-selected' : ''}`} key={role.id} onClick={() => setRoleId(role.id)}><span><strong>{role.name}</strong><small>{role.description || role.code}</small></span><span><Badge tone={role.is_active ? 'success' : 'danger'}>{role.is_active ? 'Actif' : 'Inactif'}</Badge><small>{role.user_count} utilisateur(s)</small></span></button>)}</div>}
      </Section>
      <Section id="role-editor" icon={ShieldCheck} tone="violet" title={roleId ? 'Définition du rôle' : 'Nouveau rôle'}>
        <div className="sn-form-grid">
          <Field label="Code" required><input className="sn-input" value={form.code} disabled={Boolean(roleId && matrix?.role.is_system)} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nom" required><input className="sn-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Rôle technique" required><select className="sn-input" value={form.legacyRole} disabled={Boolean(roleId && matrix?.role.is_system)} onChange={(e) => setForm({ ...form, legacyRole: e.target.value })}>{legacyRoles.map((role) => <option value={role} key={role}>{role}</option>)}</select></Field>
          <Field label="État"><span className="access-switch"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Rôle actif</span></Field>
          <Field label="Description" wide><textarea className="sn-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        <h4 className="access-subtitle">Catégories d’acteurs compatibles</h4>
        <div className="access-choice-row">{categories.map((category) => <label key={category.code} className={form.categories.includes(category.code) ? 'is-selected' : ''}><input type="checkbox" checked={form.categories.includes(category.code)} onChange={() => toggleCategory(category.code)} /> {category.name}</label>)}</div>
        {matrix ? <div className="access-matrix-wrap"><table className="access-matrix"><caption className="sr-only">Matrice des permissions du rôle</caption><thead><tr><th>Module</th>{ACCESS_PERMISSION_CODES.map((code) => <th key={code}>{permissionLabels[code]}</th>)}</tr></thead><tbody>{matrix.modules.filter((module) => module.is_portal_active).map((module) => <tr key={module.id}><th><strong>{module.name}</strong><small>{module.group_name}</small></th>{ACCESS_PERMISSION_CODES.map((code) => { const permission = matrix.permissions.find((item) => item.module_id === module.id && item.permission_code === code); return <td key={code}>{permission ? <button type="button" className={`access-permission ${permission.allowed ? 'is-allowed' : 'is-denied'}`} aria-label={`${permissionLabels[code]} — ${module.name} : ${permission.allowed ? 'autorisé' : 'refusé'}`} onClick={() => togglePermission(module.id, code)}>{permission.allowed ? <Check /> : <X />}</button> : <span className="access-na" aria-label="Non applicable">—</span>}</td>; })}</tr>)}</tbody></table></div> : <Note tone="warning" icon={AlertTriangle}>Enregistrez d’abord le nouveau rôle, puis ouvrez-le pour configurer sa matrice.</Note>}
        <Field label="Motif de la modification" required><textarea className="sn-input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        <div className="sn-form-actions"><button type="button" className="sn-btn sn-btn--primary" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="sn-spin" /> : <Save />} Enregistrer</button></div>
      </Section>
    </div>
  </div></NationalDashboardLayout>;
}

export default RolesPermissionsPage;
