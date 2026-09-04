import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Loader2, PanelsTopLeft, Plus, Save, ShieldCheck } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/errorMessage';
import {
  accessGovernanceService,
  type PortalConfiguration,
} from '@/services/accessGovernanceService';
import type { AccessPortal } from '@/types/accessGovernance';
import './admin.css';

const emptyEditor = () => ({
  id: null as string | null,
  code: '', name: '', description: '', institutionalScope: '', isActive: true,
  reason: '', configuration: null as PortalConfiguration | null,
});

export function AccessPortalsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [portals, setPortals] = useState<AccessPortal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState(emptyEditor);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = user?.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await accessGovernanceService.listPortals(true);
      setPortals(list);
      setSelectedId((current) => current && list.some(({ id }) => id === current) ? current : list[0]?.id ?? null);
    } catch (reason) {
      setError(errorMessage(reason, 'Impossible de charger les portails.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void accessGovernanceService.getPortalConfiguration(selectedId).then((configuration) => {
      if (!active || !configuration.portal) return;
      const portal = configuration.portal;
      setEditor({
        id: portal.id, code: portal.code, name: portal.name,
        description: portal.description ?? '', institutionalScope: portal.institutional_scope ?? '',
        isActive: portal.is_active, reason: '', configuration,
      });
    }).catch((reason) => active && setError(errorMessage(reason, 'Configuration du portail indisponible.')));
    return () => { active = false; };
  }, [selectedId]);

  const beginCreate = async () => {
    setSelectedId(null); setError(null);
    try {
      const configuration = await accessGovernanceService.getPortalConfiguration();
      setEditor({ ...emptyEditor(), configuration });
    } catch (reason) { setError(errorMessage(reason, 'Référentiel des modules indisponible.')); }
  };
  const setGroup = (code: string, field: 'is_active' | 'is_visible', value: boolean) =>
    setEditor((current) => current.configuration ? ({ ...current, configuration: {
      ...current.configuration,
      groups: current.configuration.groups.map((group) => group.code === code ? { ...group, [field]: value } : group),
    } }) : current);
  const setModule = (id: string, field: 'is_portal_active' | 'is_portal_visible', value: boolean) =>
    setEditor((current) => current.configuration ? ({ ...current, configuration: {
      ...current.configuration,
      modules: current.configuration.modules.map((module) => module.id === id ? { ...module, [field]: value } : module),
    } }) : current);

  const save = async () => {
    if (!editor.configuration || saving) return;
    if (!editor.name.trim() || !editor.code.trim() || editor.reason.trim().length < 10) {
      setError('Renseignez le code, le nom et un motif détaillé d’au moins 10 caractères.'); return;
    }
    setSaving(true); setError(null);
    try {
      const saved = await accessGovernanceService.savePortal({
        id: editor.id, code: editor.code.trim().toLowerCase(), name: editor.name.trim(),
        description: editor.description.trim(), institutionalScope: editor.institutionalScope.trim(),
        isActive: editor.isActive,
        groups: editor.configuration.groups.map(({ code, is_active, is_visible }) => ({ code, is_active, is_visible })),
        modules: editor.configuration.modules.map(({ id, is_portal_active, is_portal_visible }) => ({
          module_id: id, is_active: is_portal_active, is_visible: is_portal_visible,
        })),
        reason: editor.reason.trim(),
      });
      addToast(editor.id ? 'Portail mis à jour' : 'Portail créé', 'success');
      await load(); setSelectedId(saved.id);
    } catch (reason) { setError(errorMessage(reason, 'Enregistrement du portail impossible.')); }
    finally { setSaving(false); }
  };
  const archive = async () => {
    if (!editor.id || !isOwner || editor.reason.trim().length < 10 || saving) {
      setError('Un motif détaillé est obligatoire avant l’archivage.'); return;
    }
    if (!window.confirm(`Archiver définitivement le portail « ${editor.name} » ?`)) return;
    setSaving(true);
    try {
      await accessGovernanceService.archivePortal(editor.id, editor.reason.trim());
      addToast('Portail archivé', 'success'); setEditor(emptyEditor()); await load();
    } catch (reason) { setError(errorMessage(reason, 'Archivage impossible.')); }
    finally { setSaving(false); }
  };

  const activeCount = useMemo(() => portals.filter(({ is_active }) => is_active).length, [portals]);
  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page access-governance">
        <PageHeader icon={PanelsTopLeft} title="Portails"
          subtitle={`${activeCount} portail${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''} — structure de navigation et périmètres institutionnels.`}
          breadcrumb={[{ label: 'Utilisateurs & Portails' }, { label: 'Portails' }]}
          actions={isOwner ? <button className="sn-btn sn-btn--primary" type="button" onClick={() => void beginCreate()}><Plus /> Nouveau portail</button> : undefined}
        />
        {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}
        {!isOwner && <Note tone="info" icon={ShieldCheck}>Vous pouvez configurer les portails existants. La création et l’archivage sont réservés au Super Administrateur.</Note>}
        <div className="access-layout">
          <Section id="portal-list" icon={PanelsTopLeft} title="Référentiel des portails" description="Sélectionnez un portail pour contrôler sa configuration.">
            {loading ? <div className="admin-page__loading"><Loader2 className="sn-spin" /> Chargement…</div> : portals.length === 0 ? <EmptyState title="Aucun portail" description="Le référentiel ne contient aucun portail." /> : (
              <div className="access-card-list">{portals.map((portal) => (
                <button type="button" key={portal.id} className={`access-card${selectedId === portal.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(portal.id)}>
                  <span><strong>{portal.name}</strong><small>{portal.description || portal.code}</small></span>
                  <span><Badge tone={portal.is_active ? 'success' : 'danger'}>{portal.is_active ? 'Actif' : 'Inactif'}</Badge><small>{portal.user_count} utilisateur(s) · {portal.role_count} rôle(s)</small></span>
                </button>
              ))}</div>
            )}
          </Section>
          <Section id="portal-editor" icon={ShieldCheck} tone="blue" title={editor.id ? 'Configuration du portail' : 'Nouveau portail'} description="Un groupe ou un parent désactivé coupe automatiquement ses descendants.">
            {!editor.configuration ? <EmptyState title="Sélectionnez un portail" description="Sa configuration apparaîtra dans ce panneau." /> : <>
              <div className="sn-form-grid">
                <Field label="Code technique" required><input className="sn-input" value={editor.code} disabled={Boolean(editor.id)} onChange={(e) => setEditor({ ...editor, code: e.target.value })} /></Field>
                <Field label="Nom institutionnel" required><input className="sn-input" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} /></Field>
                <Field label="Périmètre institutionnel"><input className="sn-input" value={editor.institutionalScope} onChange={(e) => setEditor({ ...editor, institutionalScope: e.target.value })} /></Field>
                <Field label="État"><label className="access-switch"><input type="checkbox" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} /> Portail actif</label></Field>
                <Field label="Description" wide><textarea className="sn-input" rows={2} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></Field>
              </div>
              <h4 className="access-subtitle">Groupes de navigation</h4>
              <div className="access-toggle-grid">{editor.configuration.groups.map((group) => <div className="access-toggle" key={group.code}><strong>{group.name}</strong><label><input type="checkbox" checked={group.is_active} onChange={(e) => setGroup(group.code, 'is_active', e.target.checked)} /> Actif</label><label><input type="checkbox" checked={group.is_visible} disabled={!group.is_active} onChange={(e) => setGroup(group.code, 'is_visible', e.target.checked)} /> Visible</label></div>)}</div>
              <h4 className="access-subtitle">Modules du portail</h4>
              <div className="access-module-list">{editor.configuration.modules.map((module) => <div key={module.id}><span><strong>{module.name}</strong><small>{module.group_name || 'Sans groupe'} · {module.code}</small></span><label><input type="checkbox" checked={module.is_portal_active} disabled={!module.is_globally_active} onChange={(e) => setModule(module.id, 'is_portal_active', e.target.checked)} /> Actif</label><label><input type="checkbox" checked={module.is_portal_visible} disabled={!module.is_portal_active} onChange={(e) => setModule(module.id, 'is_portal_visible', e.target.checked)} /> Menu</label></div>)}</div>
              <Field label="Motif de la modification" required hint="Au moins 10 caractères ; il sera conservé dans l’audit."><textarea className="sn-input" rows={2} value={editor.reason} onChange={(e) => setEditor({ ...editor, reason: e.target.value })} /></Field>
              <div className="sn-form-actions">
                {editor.id && isOwner && !editor.configuration.portal?.is_system && <button className="sn-btn sn-btn--danger" type="button" onClick={() => void archive()} disabled={saving}><Archive /> Archiver</button>}
                <button className="sn-btn sn-btn--primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="sn-spin" /> : <Save />} Enregistrer</button>
              </div>
            </>}
          </Section>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}

export default AccessPortalsPage;
