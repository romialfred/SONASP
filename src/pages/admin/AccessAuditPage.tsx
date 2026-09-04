import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Eye, FileSearch, Loader2, RefreshCw, X } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import { accessGovernanceService } from '@/services/accessGovernanceService';
import type { AccessAuditEvent, AccessAuditFilters, AccessPortal, AccessRole } from '@/types/accessGovernance';
import './admin.css';

const escapeCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const formatDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));

export function AccessAuditPage() {
  const [events, setEvents] = useState<AccessAuditEvent[]>([]);
  const [portals, setPortals] = useState<AccessPortal[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [filters, setFilters] = useState<AccessAuditFilters>({ query: '', from: '', to: '', portalCode: '', roleCode: '', action: '', result: '', offset: 0, limit: 100 });
  const [selected, setSelected] = useState<AccessAuditEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rows, portalRows, roleRows] = await Promise.all([
        accessGovernanceService.listAuditEvents(filters), accessGovernanceService.listPortals(true), accessGovernanceService.listRoles(undefined, true),
      ]);
      setEvents(rows); setPortals(portalRows); setRoles(roleRows);
    } catch (reason) { setError(errorMessage(reason, 'Impossible de charger l’audit des accès.')); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);

  const actions = useMemo(() => [...new Set(events.map(({ action }) => action))].sort(), [events]);
  const exportCsv = async () => {
    setError(null);
    try {
      const rows = await accessGovernanceService.exportAuditEvents(filters);
      const headers = ['Date','Acteur','Cible','Objet','Action','Portail','Rôle','Résultat','Motif','Adresse IP','Corrélation'];
      const lines = rows.map((event) => [event.occurred_at,event.actor_email,event.target_label,event.object_type,event.action,event.portal_code,event.role_code,event.result,event.reason,event.ip_address,event.correlation_id].map(escapeCsv).join(';'));
      const blob = new Blob(['\ufeff', headers.map(escapeCsv).join(';'), '\n', lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `audit-acces-sonasp-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(errorMessage(reason, 'Export de l’audit impossible.')); }
  };
  const setFilter = (key: keyof AccessAuditFilters, value: string) => setFilters((current) => ({ ...current, [key]: value, offset: 0 }));
  const resultTone = (result: string) => result === 'success' ? 'success' : result === 'warning' ? 'warning' : 'danger';

  return <NationalDashboardLayout><div className="sn-page admin-page access-governance">
    <PageHeader icon={FileSearch} title="Audit des accès" subtitle="Traçabilité immuable des utilisateurs, rôles, portails et décisions d’autorisation." breadcrumb={[{ label: 'Utilisateurs & Portails' }, { label: 'Audit des accès' }]} actions={<><button type="button" className="sn-btn" onClick={() => void load()}><RefreshCw /> Actualiser</button><button type="button" className="sn-btn sn-btn--primary" onClick={() => void exportCsv()}><Download /> Exporter en CSV</button></>} />
    {error && <Note tone="danger" icon={AlertTriangle}>{error}</Note>}
    <Section id="audit-filters" icon={FileSearch} title="Filtres de recherche" description="Les filtres sont appliqués côté serveur avant pagination.">
      <div className="sn-form-grid access-filters">
        <Field label="Recherche"><input className="sn-input" type="search" value={filters.query} onChange={(e) => setFilter('query', e.target.value)} placeholder="Acteur, cible, objet ou motif" /></Field>
        <Field label="Du"><input className="sn-input" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} /></Field>
        <Field label="Au"><input className="sn-input" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} /></Field>
        <Field label="Portail"><select className="sn-input" value={filters.portalCode} onChange={(e) => setFilter('portalCode', e.target.value)}><option value="">Tous</option>{portals.map((portal) => <option key={portal.id} value={portal.code}>{portal.name}</option>)}</select></Field>
        <Field label="Rôle"><select className="sn-input" value={filters.roleCode} onChange={(e) => setFilter('roleCode', e.target.value)}><option value="">Tous</option>{roles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}</select></Field>
        <Field label="Action"><select className="sn-input" value={filters.action} onChange={(e) => setFilter('action', e.target.value)}><option value="">Toutes</option>{actions.map((action) => <option key={action}>{action}</option>)}</select></Field>
        <Field label="Résultat"><select className="sn-input" value={filters.result} onChange={(e) => setFilter('result', e.target.value)}><option value="">Tous</option><option value="success">Succès</option><option value="denied">Refus</option><option value="failure">Échec</option><option value="warning">Avertissement</option></select></Field>
      </div>
    </Section>
    <Section id="audit-feed" icon={FileSearch} tone="slate" title="Événements d’accès">
      {loading ? <div className="admin-page__loading"><Loader2 className="sn-spin" /> Chargement…</div> : events.length === 0 ? <EmptyState title="Aucun événement" description="Aucun événement ne correspond aux filtres sélectionnés." /> : <div className="access-matrix-wrap"><table className="admin-page__table"><caption className="sr-only">Journal d’audit des accès</caption><thead><tr><th>Date</th><th>Acteur</th><th>Cible</th><th>Action</th><th>Portail / rôle</th><th>Résultat</th><th>Détail</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{formatDate(event.occurred_at)}</td><td><strong>{event.actor_email || 'Système'}</strong></td><td>{event.target_label || event.object_type}</td><td>{event.action}</td><td>{[event.portal_code,event.role_code].filter(Boolean).join(' · ') || '—'}</td><td><Badge tone={resultTone(event.result)}>{event.result}</Badge></td><td><button type="button" className="sn-btn sn-btn--sm" onClick={() => setSelected(event)}><Eye /> Consulter</button></td></tr>)}</tbody></table></div>}
    </Section>
    {selected && <div className="access-drawer-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><aside className="access-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onMouseDown={(e) => e.stopPropagation()}><header><div><h2 id="audit-detail-title">Détail de l’événement</h2><p>{formatDate(selected.occurred_at)}</p></div><button type="button" className="sn-btn sn-btn--icon" aria-label="Fermer" onClick={() => setSelected(null)}><X /></button></header><dl><dt>Acteur</dt><dd>{selected.actor_email || 'Système'}</dd><dt>Cible</dt><dd>{selected.target_label || '—'}</dd><dt>Objet</dt><dd>{selected.object_type} · {selected.object_id || '—'}</dd><dt>Action</dt><dd>{selected.action}</dd><dt>Résultat</dt><dd>{selected.result}</dd><dt>Motif</dt><dd>{selected.reason || '—'}</dd><dt>Adresse IP</dt><dd>{selected.ip_address || '—'}</dd><dt>Corrélation</dt><dd>{selected.correlation_id || '—'}</dd></dl><h3>Valeurs antérieures</h3><pre>{JSON.stringify(selected.previous_values, null, 2)}</pre><h3>Nouvelles valeurs</h3><pre>{JSON.stringify(selected.new_values, null, 2)}</pre></aside></div>}
  </div></NationalDashboardLayout>;
}

export default AccessAuditPage;
