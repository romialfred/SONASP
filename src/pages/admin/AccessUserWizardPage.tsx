import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, KeyRound, Loader2, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import { defaultResponsibilitiesForRole } from '@/lib/accessControl';
import { errorMessage } from '@/lib/errorMessage';
import { accessGovernanceService } from '@/services/accessGovernanceService';
import { createUser } from '@/services/userManagementService';
import { getAdministrationUserDetails } from '@/services/userAdministrationDetailsService';
import type { AccessPortal, AccessResource, AccessRole, ActorCategory, EffectivePermissionRow, UserAccessAssignment } from '@/types/accessGovernance';
import type { UserRole } from '@/types/auth';
import './admin.css';

const stepLabels = ['Catégorie', 'Ressource', 'Portail', 'Rôle', 'Autorisations'];
const permissionNames: Record<string, string> = { view: 'Voir', create: 'Créer', edit: 'Modifier', delete: 'Supprimer', submit: 'Soumettre', validate: 'Valider', approve: 'Approuver', reject: 'Rejeter', export: 'Exporter', download: 'Télécharger', admin: 'Administrer' };

export function AccessUserWizardPage() {
  const navigate = useNavigate(); const [searchParams] = useSearchParams(); const { addToast } = useToast();
  const userId = searchParams.get('userId'); const isEdit = Boolean(userId);
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<ActorCategory[]>([]);
  const [resources, setResources] = useState<AccessResource[]>([]);
  const [portals, setPortals] = useState<AccessPortal[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [matrix, setMatrix] = useState<EffectivePermissionRow[]>([]);
  const [categoryCode, setCategoryCode] = useState(''); const [resourceId, setResourceId] = useState('');
  const [portalId, setPortalId] = useState(''); const [roleId, setRoleId] = useState('');
  const [query, setQuery] = useState(''); const [restricted, setRestricted] = useState<Set<string>>(new Set());
  const [identity, setIdentity] = useState({ fullName: '', email: '', phone: '', jobTitle: '', department: '', active: true });
  const [restrictionReason, setRestrictionReason] = useState('Restriction individuelle validée lors de la création du compte.');
  const [initialAssignment, setInitialAssignment] = useState<UserAccessAssignment | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  const category = categories.find(({ code }) => code === categoryCode) ?? null;
  const resource = resources.find(({ id }) => id === resourceId) ?? null;
  const portal = portals.find(({ id }) => id === portalId) ?? null;
  const role = roles.find(({ id }) => id === roleId) ?? null;

  useEffect(() => {
    let active = true; setLoading(true);
    const profileRequest = userId ? getAdministrationUserDetails(userId) : Promise.resolve(null);
    const assignmentRequest = userId ? accessGovernanceService.getUserAssignment(userId) : Promise.resolve(null);
    void Promise.all([accessGovernanceService.listActorCategories(), profileRequest, assignmentRequest]).then(([rows, details, assignment]) => {
      if (!active) return;
      setCategories(rows);
      if (details && assignment) {
        setIdentity({ fullName: details.profile.full_name ?? '', email: details.profile.email, phone: details.profile.phone ?? '', jobTitle: details.profile.job_title ?? '', department: details.profile.department ?? '', active: details.profile.is_active });
        setInitialAssignment(assignment); setCategoryCode(assignment.actor_category_code);
      } else if (userId) throw new Error('L’affectation autoritative de ce compte est introuvable.');
    }).catch((reason) => active && setError(errorMessage(reason, 'Données du compte indisponibles.'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    setResourceId(''); setPortalId(''); setRoleId(''); setResources([]); setPortals([]); setRoles([]); setMatrix([]); setRestricted(new Set());
    if (!categoryCode) return;
    let active = true; setLoading(true); setError(null);
    const selected = categories.find(({ code }) => code === categoryCode);
    const resourceRequest = selected?.resource_kind === 'identity' ? Promise.resolve([]) : accessGovernanceService.searchResources(categoryCode, query);
    void Promise.all([resourceRequest, accessGovernanceService.listCompatiblePortals(categoryCode)]).then(([resourceRows, portalRows]) => { if (active) { setResources(resourceRows); setPortals(portalRows); if (initialAssignment?.actor_category_code === categoryCode) { setResourceId(initialAssignment.resource_id ?? ''); setPortalId(initialAssignment.portal_id); } } }).catch((reason) => active && setError(errorMessage(reason, 'Référentiel compatible indisponible.'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  // La recherche est déclenchée explicitement pour éviter de réinitialiser le parcours à chaque frappe.
  }, [categoryCode, categories]);
  useEffect(() => {
    setRoleId(''); setRoles([]); setMatrix([]); setRestricted(new Set());
    if (!portalId || !categoryCode) return;
    let active = true; setLoading(true);
    void accessGovernanceService.listCompatibleRoles(portalId, categoryCode).then((rows) => { if (active) { setRoles(rows); if (initialAssignment?.portal_id === portalId) setRoleId(initialAssignment.role_id); } }).catch((reason) => active && setError(errorMessage(reason, 'Rôles compatibles indisponibles.'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [portalId, categoryCode]);
  useEffect(() => {
    setMatrix([]); setRestricted(new Set()); if (!roleId) return;
    let active = true; setLoading(true);
    void accessGovernanceService.getEffectiveMatrix(roleId, userId ?? undefined).then((rows) => { if (active) { setMatrix(rows); setRestricted(new Set(rows.filter(({ user_denied }) => user_denied).map((row) => `${row.module_id}:${row.permission_code}`))); setInitialAssignment(null); } }).catch((reason) => active && setError(errorMessage(reason, 'Matrice effective indisponible.'))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [roleId, userId]);

  const searchResources = async () => {
    if (!category || category.resource_kind === 'identity') return;
    setLoading(true); try { setResources(await accessGovernanceService.searchResources(category.code, query)); } catch (reason) { setError(errorMessage(reason, 'Recherche impossible.')); } finally { setLoading(false); }
  };
  const rowsByModule = useMemo(() => {
    const groups = new Map<string, EffectivePermissionRow[]>();
    matrix.forEach((row) => groups.set(row.module_id, [...(groups.get(row.module_id) ?? []), row])); return [...groups.values()];
  }, [matrix]);
  const canContinue = step === 1 ? Boolean(categoryCode && identity.fullName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) : step === 2 ? Boolean(category?.resource_kind === 'identity' || resourceId) : step === 3 ? Boolean(portalId) : step === 4 ? Boolean(roleId) : true;
  const toggleRestriction = (row: EffectivePermissionRow) => {
    if (!row.effective) return; const key = `${row.module_id}:${row.permission_code}`;
    setRestricted((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };
  const submit = async () => {
    if (!category || !portal || !role || saving) return;
    if (restricted.size && restrictionReason.trim().length < 10) { setError('Précisez un motif d’au moins 10 caractères pour les restrictions individuelles.'); return; }
    setSaving(true); setError(null);
    try {
      const legacyRole = role.legacy_role as UserRole;
      if (userId) {
        await accessGovernanceService.updateUserAccess({
          userId, fullName: identity.fullName.trim(), phone: identity.phone.trim(), jobTitle: identity.jobTitle.trim(), department: identity.department.trim(), isActive: identity.active,
          portalId: portal.id, roleId: role.id, actorCategoryCode: category.code,
          resourceType: category.resource_kind === 'identity' ? null : category.resource_kind,
          resourceId: category.resource_kind === 'identity' ? null : resourceId,
          responsibilities: defaultResponsibilitiesForRole(legacyRole),
          restrictions: matrix.filter((row) => restricted.has(`${row.module_id}:${row.permission_code}`)).map((row) => ({ module_id: row.module_id, permission_code: row.permission_code, denied: true, reason: restrictionReason.trim() })),
          reason: 'Modification contrôlée du compte depuis l’assistant de gouvernance.',
        });
        addToast('Compte et accès mis à jour', 'success'); navigate(`/users/${userId}`); return;
      }
      const result = await createUser({
        email: identity.email.trim().toLowerCase(), full_name: identity.fullName.trim(), phone: identity.phone.trim(), job_title: identity.jobTitle.trim(), department: identity.department.trim(),
        role: legacyRole, account_type: legacyRole, is_active: identity.active,
        mining_company_id: category.resource_kind === 'mining_company' ? resourceId : null,
        organization_id: category.resource_kind === 'organization' ? resourceId : legacyRole === 'collector' ? resource?.organization_id ?? undefined : undefined,
        collector_id: category.resource_kind === 'collector' ? resourceId : undefined,
        responsibilities: defaultResponsibilitiesForRole(legacyRole),
        access_portal_id: portal.id, access_role_id: role.id, actor_category_code: category.code,
        resource_type: category.resource_kind === 'identity' ? null : category.resource_kind, resource_id: category.resource_kind === 'identity' ? null : resourceId,
        access_restrictions: matrix.filter((row) => restricted.has(`${row.module_id}:${row.permission_code}`)).map((row) => ({ module_id: row.module_id, permission_code: row.permission_code, denied: true as const, reason: restrictionReason.trim() })),
      });
      if (!result.success || !result.user) throw new Error(result.error || 'La création du compte a échoué.');
      addToast('Compte créé — courriel de bienvenue envoyé', 'success'); navigate(`/users/${result.user.id}`);
    } catch (reason) { setError(errorMessage(reason, 'Création du compte impossible.')); }
    finally { setSaving(false); }
  };

  return <NationalDashboardLayout><div className="sn-page admin-page access-governance access-wizard">
    <PageHeader icon={UserRound} title={isEdit ? 'Modifier un utilisateur' : 'Créer un utilisateur'} subtitle="Affectation guidée à une ressource réelle, un portail, un rôle et une matrice effective." breadcrumb={[{ label: 'Utilisateurs & Portails' }, { label: 'Utilisateurs', to: '/users' }, { label: isEdit ? 'Modification' : 'Nouveau compte' }]} />
    <ol className="access-steps" aria-label="Étapes de création">{stepLabels.map((label, index) => <li key={label} className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-complete' : ''}><span>{step > index + 1 ? <Check /> : index + 1}</span><strong>{label}</strong></li>)}</ol>
    {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}
    {loading && <div className="admin-page__loading"><Loader2 className="sn-spin" /> Chargement du référentiel…</div>}
    {step === 1 && <Section id="wizard-category" icon={UserRound} title="1. Catégorie d’acteur" description="Le choix de catégorie détermine les ressources, portails et rôles proposés.">
      <div className="access-choice-grid">{categories.map((item) => <button type="button" key={item.code} className={categoryCode === item.code ? 'is-selected' : ''} onClick={() => { setInitialAssignment(null); setCategoryCode(item.code); }}><Building2 /><span><strong>{item.name}</strong><small>{item.description}</small></span></button>)}</div>
      <div className="sn-form-grid"><Field label="Nom complet" required><input className="sn-input" value={identity.fullName} onChange={(e) => setIdentity({ ...identity, fullName: e.target.value })} /></Field><Field label="Identifiant / adresse e-mail" required hint={isEdit ? 'L’identifiant de connexion ne peut pas être modifié ici.' : undefined}><input className="sn-input" type="email" disabled={isEdit} value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} /></Field><Field label="Téléphone"><input className="sn-input" value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })} /></Field><Field label="Fonction"><input className="sn-input" value={identity.jobTitle} onChange={(e) => setIdentity({ ...identity, jobTitle: e.target.value })} /></Field><Field label="Direction / service"><input className="sn-input" value={identity.department} onChange={(e) => setIdentity({ ...identity, department: e.target.value })} /></Field><Field label="Sécurité"><span className="access-switch"><input type="checkbox" checked={identity.active} onChange={(e) => setIdentity({ ...identity, active: e.target.checked })} /> Compte actif · MFA obligatoire</span></Field></div>
    </Section>}
    {step === 2 && <Section id="wizard-resource" icon={Building2} tone="blue" title="2. Ressource de rattachement" description="Les données proviennent des référentiels métier réels de la plateforme.">
      {category?.resource_kind === 'identity' ? <Note tone="info" icon={ShieldCheck}>Compte institutionnel sans ressource métier externe.</Note> : <><div className="access-search"><input className="sn-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, code, carte ou téléphone" /><button className="sn-btn" type="button" onClick={() => void searchResources()}>Rechercher</button></div>{resources.length === 0 ? <EmptyState title="Aucune ressource compatible" description="Affinez la recherche ou vérifiez que le référentiel contient une ressource active." /> : <div className="access-choice-grid">{resources.map((item) => <button type="button" key={item.id} className={resourceId === item.id ? 'is-selected' : ''} onClick={() => setResourceId(item.id)}><Building2 /><span><strong>{item.display_name}</strong><small>{[item.code,item.secondary_name,item.organization_name,item.status].filter(Boolean).join(' · ')}</small></span></button>)}</div>}</>}
    </Section>}
    {step === 3 && <Section id="wizard-portal" icon={ShieldCheck} tone="emerald" title="3. Portail d’accès" description="Seuls les portails actifs compatibles avec la catégorie sont proposés."><div className="access-choice-grid">{portals.map((item) => <button type="button" key={item.id} className={portalId === item.id ? 'is-selected' : ''} onClick={() => setPortalId(item.id)}><ShieldCheck /><span><strong>{item.name}</strong><small>{item.description}</small></span></button>)}</div></Section>}
    {step === 4 && <Section id="wizard-role" icon={KeyRound} tone="violet" title="4. Rôle précis" description="Le rôle est lié au portail choisi et filtre automatiquement les droits possibles.">{roles.length === 0 ? <EmptyState title="Aucun rôle compatible" description="Configurez un rôle actif pour cette catégorie et ce portail." /> : <div className="access-choice-grid">{roles.map((item) => <button type="button" key={item.id} className={roleId === item.id ? 'is-selected' : ''} onClick={() => setRoleId(item.id)}><KeyRound /><span><strong>{item.name}</strong><small>{item.description || item.code}</small></span></button>)}</div>}</Section>}
    {step === 5 && <Section id="wizard-effective" icon={ShieldCheck} title="5. Matrice effective et validation" description="Vous pouvez seulement retirer un droit du rôle ; aucun droit individuel ne peut être ajouté.">
      <div className="access-summary"><div><small>Catégorie</small><strong>{category?.name}</strong></div><div><small>Ressource</small><strong>{resource?.display_name || 'Institution SONASP'}</strong></div><div><small>Portail</small><strong>{portal?.name}</strong></div><div><small>Rôle</small><strong>{role?.name}</strong></div></div>
      <div className="access-matrix-wrap"><table className="access-matrix"><caption className="sr-only">Autorisations effectives du futur utilisateur</caption><thead><tr><th>Module</th><th>Autorisations du rôle</th><th>Restriction individuelle</th></tr></thead><tbody>{rowsByModule.map((rows) => <tr key={rows[0].module_id}><th><strong>{rows[0].module_name}</strong><small>{rows[0].module_code}</small></th><td><div className="access-badges">{rows.filter(({ effective }) => effective).map((row) => <Badge key={row.permission_code} tone="success">{permissionNames[row.permission_code]}</Badge>)}</div></td><td><div className="access-badges">{rows.filter(({ effective }) => effective).map((row) => { const key = `${row.module_id}:${row.permission_code}`; return <label key={key} className={restricted.has(key) ? 'is-restricted' : ''}><input type="checkbox" checked={restricted.has(key)} onChange={() => toggleRestriction(row)} /> Retirer {permissionNames[row.permission_code]}</label>; })}</div></td></tr>)}</tbody></table></div>
      {restricted.size > 0 && <Field label="Motif des restrictions" required><textarea className="sn-input" rows={2} value={restrictionReason} onChange={(e) => setRestrictionReason(e.target.value)} /></Field>}
      <Note tone="warning" icon={Mail}>À validation, le compte sera créé de manière atomique et un lien d’activation à usage unique sera envoyé. L’enrôlement MFA est obligatoire.</Note>
    </Section>}
    <div className="sn-form-actions access-wizard__actions"><button type="button" className="sn-btn" onClick={() => step === 1 ? navigate('/users') : setStep(step - 1)}><ArrowLeft /> {step === 1 ? 'Annuler' : 'Précédent'}</button>{step < 5 ? <button type="button" className="sn-btn sn-btn--primary" disabled={!canContinue || loading} onClick={() => setStep(step + 1)}>Continuer <ArrowRight /></button> : <button type="button" className="sn-btn sn-btn--primary" disabled={saving || !role || loading} onClick={() => void submit()}>{saving ? <Loader2 className="sn-spin" /> : <Save />} {isEdit ? 'Enregistrer les modifications' : 'Créer et envoyer l’invitation'}</button>}</div>
  </div></NationalDashboardLayout>;
}

export default AccessUserWizardPage;
