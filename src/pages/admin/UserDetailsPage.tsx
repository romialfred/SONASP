import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  MapPin,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  StatGrid,
} from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import { roleLabel, roleTone } from '@/lib/roleLabels';
import {
  getAdministrationUserDetails,
  type AdministrationActivityEvent,
  type AdministrationConnectionEvent,
  type AdministrationPermission,
  type AdministrationSiteAccess,
  type AdministrationUserDetails,
} from '@/services/userAdministrationDetailsService';
import './admin.css';
import './user-details.css';

type OngletId = 'apercu' | 'sessions' | 'activite' | 'permissions' | 'sites';

const ONGLETS: Array<{ id: OngletId; label: string; icon: typeof UserRound }> = [
  { id: 'apercu', label: 'Vue d’ensemble', icon: UserRound },
  { id: 'sessions', label: 'Connexions', icon: LogIn },
  { id: 'activite', label: 'Journal d’activité', icon: Activity },
  { id: 'permissions', label: 'Permissions', icon: Lock },
  { id: 'sites', label: 'Accès aux sites', icon: Building2 },
];

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Ouagadougou',
  timeZoneName: 'short',
});

const formatDate = (valeur?: string | null): string => {
  if (!valeur) return 'Jamais';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? 'Non disponible' : DATE_LONGUE.format(date);
};

const eventLabel = (eventType: string): string => ({
  login_success: 'Connexion réussie',
  login_failed: 'Identifiants refusés',
  logout: 'Déconnexion',
  login_profile_unavailable: 'Profil indisponible',
  login_denied_inactive_account: 'Compte désactivé',
}[eventType] || eventType.replace(/_/g, ' '));

const eventSuccess = (eventType: string): boolean => eventType === 'login_success' || eventType === 'logout';

const describeUserAgent = (userAgent: string | null): { appareil: string; navigateur: string; systeme: string } => {
  if (!userAgent) return { appareil: 'Non renseigné', navigateur: 'Non renseigné', systeme: 'Non renseigné' };
  const appareil = /tablet|ipad/i.test(userAgent)
    ? 'Tablette'
    : /mobile|android|iphone/i.test(userAgent)
      ? 'Mobile'
      : 'Ordinateur';
  const navigateur = /edg\//i.test(userAgent)
    ? 'Microsoft Edge'
    : /firefox\//i.test(userAgent)
      ? 'Firefox'
      : /chrome\//i.test(userAgent)
        ? 'Chrome'
        : /safari\//i.test(userAgent)
          ? 'Safari'
          : 'Navigateur inconnu';
  const systeme = /windows/i.test(userAgent)
    ? 'Windows'
    : /android/i.test(userAgent)
      ? 'Android'
      : /iphone|ipad|ios/i.test(userAgent)
        ? 'iOS / iPadOS'
        : /mac os|macintosh/i.test(userAgent)
          ? 'macOS'
          : /linux/i.test(userAgent)
            ? 'Linux'
            : 'Système inconnu';
  return { appareil, navigateur, systeme };
};

const actionLabel = (valeur: string): string => ({
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  view: 'Consultation',
  export: 'Export',
  approve: 'Approbation',
  reject: 'Rejet',
  desactivation_compte: 'Désactivation du compte',
  reactivation_compte: 'Réactivation du compte',
  suppression_compte_inactif: 'Suppression du compte',
}[valeur] || valeur.replace(/_/g, ' '));

const descriptionActivite = (ligne: AdministrationActivityEvent): string => {
  if (!ligne.description) return 'Aucun détail complémentaire.';
  if (ligne.source !== 'audit') return ligne.description;
  try {
    const details = JSON.parse(ligne.description) as Record<string, unknown>;
    const motif = typeof details.motif === 'string' ? details.motif : null;
    const cible = typeof details.cible_email === 'string' ? details.cible_email : null;
    return [cible ? `Compte : ${cible}` : null, motif ? `Motif : ${motif}` : null]
      .filter(Boolean)
      .join(' · ') || 'Événement administratif consigné.';
  } catch {
    return ligne.description;
  }
};

export const csvCell = (valeur: unknown): string => {
  const brut = String(valeur ?? '');
  const neutralise = /^(?:[=+\-@\t\r\n]|[ \t]+[=+\-@])/.test(brut) ? `'${brut}` : brut;
  return `"${neutralise.replace(/"/g, '""')}"`;
};

function telechargerCsv(nom: string, entetes: string[], lignes: unknown[][]) {
  const contenu = `\uFEFF${[entetes, ...lignes].map((ligne) => ligne.map(csvCell).join(';')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}

export default function UserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<AdministrationUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<OngletId>('apercu');
  const requeteCourante = useRef(0);

  const charger = useCallback(async (signal?: AbortSignal) => {
    const numeroRequete = ++requeteCourante.current;
    const identifiantDemande = userId;
    if (!identifiantDemande) {
      setDetails(null);
      setErreur('La référence du compte est absente.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErreur(null);
    setDetails(null);
    try {
      const fiche = await getAdministrationUserDetails(identifiantDemande, signal);
      if (signal?.aborted || numeroRequete !== requeteCourante.current) return;
      if (fiche.profile.id !== identifiantDemande) {
        throw new Error('La fiche reçue ne correspond pas au compte demandé.');
      }
      setDetails(fiche);
    } catch (reason) {
      if (signal?.aborted || numeroRequete !== requeteCourante.current) return;
      setErreur(errorMessage(reason, 'Impossible de charger ce compte.'));
      setDetails(null);
    } finally {
      if (!signal?.aborted && numeroRequete === requeteCourante.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const controller = new AbortController();
    void charger(controller.signal);
    return () => controller.abort();
  }, [charger]);

  const connexions = details?.connections ?? [];
  const activites = details?.activities ?? [];
  const appareils = useMemo(() => {
    const synthese = new Map<string, number>();
    connexions.forEach((ligne) => {
      const agent = describeUserAgent(ligne.user_agent);
      const cle = `${agent.appareil} · ${agent.navigateur} · ${agent.systeme}`;
      synthese.set(cle, (synthese.get(cle) ?? 0) + 1);
    });
    return [...synthese.entries()].sort((a, b) => b[1] - a[1]);
  }, [connexions]);

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <div className="admin-page__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la fiche sécurisée…
          </div>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (!details) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page admin-page">
          <PageHeader
            icon={UserRound}
            title="Compte indisponible"
            subtitle="La fiche ne peut pas être consultée avec votre périmètre actuel."
            breadcrumb={[{ label: 'Administration' }, { label: 'Utilisateurs', to: '/admin/users' }, { label: 'Compte' }]}
          />
          {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
          <EmptyState
            title="Aucune fiche à afficher"
            description="Revenez à la liste ou actualisez après vérification de vos habilitations."
            action={
              <div className="user-detail__empty-actions">
                <button type="button" className="sn-btn" onClick={() => navigate('/admin/users')}>
                  <ArrowLeft aria-hidden="true" /> Retour à la liste
                </button>
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => void charger()}>
                  <RefreshCw aria-hidden="true" /> Réessayer
                </button>
              </div>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  const { profile, statistics } = details;
  const ongletActif = ONGLETS.find((item) => item.id === onglet) || ONGLETS[0];
  const sourceIndisponible = (nom: string): boolean => details.sources_unavailable.includes(nom);
  const connexionsIndisponibles = sourceIndisponible('journal des connexions')
    || sourceIndisponible('tentatives de connexion refusées');
  const activitesIndisponibles = sourceIndisponible('journal d’activité')
    || sourceIndisponible('journal d’audit');
  const permissionsIndisponibles = sourceIndisponible('permissions individuelles');
  const sitesIndisponibles = sourceIndisponible('accès aux sites');
  const historiqueIndisponible = sourceIndisponible('historique du statut')
    || sourceIndisponible('historique administratif de secours');
  const compagnieIndisponible = sourceIndisponible('société minière');

  const exporterConnexions = () => telechargerCsv(
    `connexions-${profile.email}-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Date', 'Événement', 'Résultat', 'Appareil', 'Navigateur', 'Système', 'Adresse IP'],
    connexions.map((ligne) => {
      const agent = describeUserAgent(ligne.user_agent);
      return [formatDate(ligne.created_at), eventLabel(ligne.event_type), eventSuccess(ligne.event_type) ? 'Autorisé' : 'Refusé', agent.appareil, agent.navigateur, agent.systeme, ligne.ip_address || 'Non collectée'];
    }),
  );

  const exporterActivites = () => telechargerCsv(
    `activites-${profile.email}-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Date', 'Action', 'Module', 'Ressource', 'Description', 'Statut', 'Source'],
    activites.map((ligne) => [formatDate(ligne.created_at), actionLabel(ligne.action_type), ligne.module_name, ligne.resource_type || '—', descriptionActivite(ligne), ligne.status || '—', ligne.source === 'audit' ? 'Audit administratif' : 'Journal métier']),
  );

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page user-detail">
        <PageHeader
          icon={UserRound}
          title={profile.full_name || 'Nom non renseigné'}
          subtitle={`${profile.email}${profile.job_title ? ` · ${profile.job_title}` : ''}`}
          breadcrumb={[{ label: 'Administration' }, { label: 'Utilisateurs', to: '/admin/users' }, { label: profile.full_name || profile.email }]}
          aside={
            <div className="user-detail__badges">
              <Badge tone={roleTone(profile.role)} icon={ShieldCheck}>{roleLabel(profile.role)}</Badge>
              <Badge tone={profile.is_active ? 'success' : 'danger'}>{profile.is_active ? 'Compte actif' : 'Compte désactivé'}</Badge>
              <Badge tone={profile.two_factor_enabled ? 'success' : 'warning'} icon={Fingerprint}>{profile.two_factor_enabled ? '2FA enrôlé' : '2FA à finaliser'}</Badge>
            </div>
          }
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/admin/users')}><ArrowLeft aria-hidden="true" /> Liste des comptes</button>
              <button type="button" className="sn-btn" onClick={() => navigate(`/admin/users/${profile.id}/permissions`)}><Lock aria-hidden="true" /> Permissions</button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate(`/users/edit?userId=${profile.id}`)}><PencilLine aria-hidden="true" /> Modifier le compte</button>
            </>
          }
        />

        {profile.failed_login_attempts > 0 && (
          <Note tone="warning" icon={AlertTriangle}>{profile.failed_login_attempts} tentative(s) échouée(s) sont encore enregistrées sur ce compte.</Note>
        )}

        <section className="sn-card user-detail__identity" aria-label="Identité et périmètre du compte">
          <dl>
            <div><dt>Rôle</dt><dd>{roleLabel(profile.role)}</dd></div>
            <div><dt>Fonction</dt><dd>{profile.job_title || 'Non renseignée'}</dd></div>
            <div><dt>Direction</dt><dd>{profile.department || 'Non renseignée'}</dd></div>
            <div><dt>Téléphone</dt><dd>{profile.phone || 'Non renseigné'}</dd></div>
            <div><dt>Société / périmètre</dt><dd>{compagnieIndisponible && profile.mining_company_id ? 'Indisponible' : profile.mining_company?.abbreviation || profile.mining_company?.name || 'Périmètre national'}</dd></div>
            <div><dt>Langue</dt><dd>{(profile.language_preference || profile.language || 'fr').toUpperCase()}</dd></div>
          </dl>
        </section>

        <div className="user-detail__tabs" role="tablist" aria-label="Sections du compte">
          {ONGLETS.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" role="tab" aria-selected={onglet === item.id} className={onglet === item.id ? 'is-active' : ''} onClick={() => setOnglet(item.id)}><Icon aria-hidden="true" /> {item.label}</button>;
          })}
        </div>

        <div className="user-detail__panel" role="tabpanel" aria-label={ongletActif.label}>
          {onglet === 'apercu' && (
            <div className="user-detail__overview">
              <StatGrid sober ariaLabel="Synthèse de la traçabilité du compte" items={[
                { label: 'Connexions consignées', value: statistics.connection_events ?? 'Indisponible', hint: statistics.connection_events_30d === null ? 'Source indisponible' : `${statistics.connection_events_30d} sur 30 jours`, icon: LogIn, tone: 'green' },
                { label: 'Actions tracées', value: statistics.activity_events ?? 'Indisponible', hint: statistics.activity_events_30d === null ? 'Source indisponible' : `${statistics.activity_events_30d} sur 30 jours`, icon: Activity, tone: 'neutral' },
                { label: 'Dernière connexion', value: profile.last_login_at ? formatDate(profile.last_login_at) : connexionsIndisponibles ? 'Indisponible' : 'Jamais', hint: connexionsIndisponibles ? 'Source indisponible' : profile.last_login_ip || 'Adresse IP non collectée', icon: Clock3, tone: 'neutral' },
                { label: 'Périmètres accessibles', value: statistics.sites_count ?? 'Indisponible', hint: statistics.permissions_count === null ? 'Permissions indisponibles' : `${statistics.permissions_count} permission(s) individuelle(s)`, icon: Building2, tone: 'gold' },
              ]} />

              <div className="user-detail__overview-grid">
                <Card title="Cycle de vie du compte" className="user-detail__card">
                  <dl className="user-detail__timeline-facts">
                    <div><dt><CalendarDays aria-hidden="true" /> Compte créé</dt><dd>{formatDate(profile.created_at)}</dd></div>
                    <div><dt><CheckCircle2 aria-hidden="true" /> Activation finalisée</dt><dd>{formatDate(profile.activation_completed_at)}</dd></div>
                    <div><dt><KeyRound aria-hidden="true" /> Mot de passe modifié</dt><dd>{formatDate(profile.password_changed_at)}</dd></div>
                    <div><dt><Activity aria-hidden="true" /> Dernière activité profil</dt><dd>{formatDate(profile.last_activity_at)}</dd></div>
                  </dl>
                </Card>
                <Card title="Sécurité et accès" className="user-detail__card">
                  <dl className="user-detail__security-list">
                    <div><dt>État du compte</dt><dd><Badge tone={profile.is_active ? 'success' : 'danger'}>{profile.is_active ? 'Actif' : 'Désactivé'}</Badge></dd></div>
                    <div><dt>Compte verrouillé</dt><dd><Badge tone={profile.account_locked ? 'danger' : 'success'}>{profile.account_locked ? 'Oui' : 'Non'}</Badge></dd></div>
                    <div><dt>Authentification à deux facteurs</dt><dd><Badge tone={profile.two_factor_enabled ? 'success' : 'warning'}>{profile.two_factor_enabled ? 'Enrôlée' : 'À finaliser'}</Badge></dd></div>
                    <div><dt>Changement de mot de passe requis</dt><dd><Badge tone={profile.must_change_password ? 'warning' : 'success'}>{profile.must_change_password ? 'Oui' : 'Non'}</Badge></dd></div>
                  </dl>
                </Card>
              </div>

              <Card title="Historique administratif du statut" className="user-detail__card">
                <DataTable caption="Historique des activations et désactivations" rows={details.account_changes} empty={historiqueIndisponible ? 'Historique administratif partiellement indisponible.' : 'Aucun changement de statut n’a été consigné pour ce compte.'} columns={[
                  { key: 'date', header: 'Date', render: (ligne) => formatDate(ligne.cree_le) },
                  { key: 'action', header: 'Décision', render: (ligne) => <Badge tone={ligne.nouvel_etat ? 'success' : 'danger'}>{ligne.nouvel_etat ? 'Réactivation' : 'Désactivation'}</Badge> },
                  { key: 'motif', header: 'Motif', render: (ligne) => ligne.motif || 'Non renseigné' },
                ]} />
              </Card>
            </div>
          )}

          {onglet === 'sessions' && (
            <div className="user-detail__section-stack">
              <div className="user-detail__section-head"><div><h3>Connexions et événements de session</h3><p>Journal serveur des accès associés à ce compte.</p></div><button type="button" className="sn-btn" disabled={connexions.length === 0 || connexionsIndisponibles} title={connexionsIndisponibles ? 'Export indisponible tant que les sources de connexion sont incomplètes' : undefined} onClick={exporterConnexions}><Download aria-hidden="true" /> Exporter en CSV</button></div>
              <DataTable<AdministrationConnectionEvent> caption="Historique des connexions" rows={connexions} empty={connexionsIndisponibles ? 'Journal des connexions partiellement indisponible.' : profile.last_login_at ? `Dernière connexion connue : ${formatDate(profile.last_login_at)}. Aucun événement détaillé antérieur n’est disponible.` : 'Ce compte ne s’est jamais connecté.'} columns={[
                { key: 'date', header: 'Date et heure', render: (ligne) => formatDate(ligne.created_at) },
                { key: 'event', header: 'Événement', render: (ligne) => <strong>{eventLabel(ligne.event_type)}</strong> },
                { key: 'result', header: 'Résultat', render: (ligne) => <Badge tone={eventSuccess(ligne.event_type) ? 'success' : 'danger'}>{eventSuccess(ligne.event_type) ? 'Autorisé' : 'Refusé'}</Badge> },
                { key: 'device', header: 'Appareil', render: (ligne) => { const agent = describeUserAgent(ligne.user_agent); return <span>{agent.appareil}<small>{agent.navigateur} · {agent.systeme}</small></span>; } },
                { key: 'ip', header: 'Adresse IP', render: (ligne) => ligne.ip_address || 'Non collectée' },
              ]} />
              {appareils.length > 0 && <Card title="Appareils observés" className="user-detail__card"><ul className="user-detail__device-list">{appareils.map(([appareil, nombre]) => <li key={appareil}><span>{appareil}</span><strong>{nombre}</strong></li>)}</ul></Card>}
            </div>
          )}

          {onglet === 'activite' && (
            <div className="user-detail__section-stack">
              <div className="user-detail__section-head"><div><h3>Journal d’activité</h3><p>Actions métier et décisions administratives rapprochées dans une chronologie unique.</p></div><button type="button" className="sn-btn" disabled={activites.length === 0 || activitesIndisponibles} title={activitesIndisponibles ? 'Export indisponible tant que les sources d’activité sont incomplètes' : undefined} onClick={exporterActivites}><Download aria-hidden="true" /> Exporter en CSV</button></div>
              <DataTable<AdministrationActivityEvent> caption="Journal d’activité du compte" rows={activites} empty={activitesIndisponibles ? 'Journal d’activité partiellement indisponible.' : 'Aucune action n’a encore été consignée pour ce compte.'} columns={[
                { key: 'date', header: 'Date et heure', render: (ligne) => formatDate(ligne.created_at) },
                { key: 'action', header: 'Action', render: (ligne) => <strong>{actionLabel(ligne.action_type)}</strong> },
                { key: 'module', header: 'Module', render: (ligne) => ligne.module_name || 'Non renseigné' },
                { key: 'description', header: 'Détail', render: (ligne) => <span className="user-detail__description">{descriptionActivite(ligne)}</span> },
                { key: 'status', header: 'Statut', render: (ligne) => <Badge tone={ligne.status === 'success' ? 'success' : ligne.status === 'error' ? 'danger' : 'neutral'}>{ligne.status === 'success' ? 'Succès' : ligne.status === 'error' ? 'Échec' : 'Consigné'}</Badge> },
                { key: 'source', header: 'Source', render: (ligne) => ligne.source === 'audit' ? 'Audit administratif' : 'Journal métier' },
              ]} />
            </div>
          )}

          {onglet === 'permissions' && (
            <div className="user-detail__section-stack">
              <div className="user-detail__section-head"><div><h3>Permissions individuelles</h3><p>Lecture détaillée des droits ajoutés au rôle du compte.</p></div></div>
              <DataTable<AdministrationPermission> caption="Permissions individuelles du compte" rows={details.permissions} empty={permissionsIndisponibles ? 'Permissions individuelles indisponibles.' : `Aucune permission individuelle : le rôle « ${roleLabel(profile.role)} » reste l’autorité de base.`} columns={[
                { key: 'module', header: 'Module', render: (ligne) => <span><strong>{ligne.modules?.display_name || ligne.modules?.name || ligne.module_id}</strong><small>{ligne.modules?.category || 'Sans catégorie'}</small></span> },
                { key: 'read', header: 'Consulter', render: (ligne) => ligne.can_view || ligne.can_read ? <CheckCircle2 className="user-detail__yes" aria-label="Autorisé" /> : <XCircle className="user-detail__no" aria-label="Non autorisé" /> },
                { key: 'create', header: 'Créer', render: (ligne) => ligne.can_create || ligne.can_write ? <CheckCircle2 className="user-detail__yes" aria-label="Autorisé" /> : <XCircle className="user-detail__no" aria-label="Non autorisé" /> },
                { key: 'edit', header: 'Modifier', render: (ligne) => ligne.can_edit ? <CheckCircle2 className="user-detail__yes" aria-label="Autorisé" /> : <XCircle className="user-detail__no" aria-label="Non autorisé" /> },
                { key: 'delete', header: 'Supprimer', render: (ligne) => ligne.can_delete ? <CheckCircle2 className="user-detail__yes" aria-label="Autorisé" /> : <XCircle className="user-detail__no" aria-label="Non autorisé" /> },
                { key: 'approve', header: 'Approuver', render: (ligne) => ligne.can_approve ? <CheckCircle2 className="user-detail__yes" aria-label="Autorisé" /> : <XCircle className="user-detail__no" aria-label="Non autorisé" /> },
              ]} />
            </div>
          )}

          {onglet === 'sites' && (
            <div className="user-detail__section-stack">
              <div className="user-detail__section-head"><div><h3>Périmètre organisationnel et sites</h3><p>Rattachements opérationnels actuellement applicables au compte.</p></div></div>
              {profile.mining_company && <Card className="user-detail__company-card"><span className="user-detail__company-icon"><Building2 aria-hidden="true" /></span><div><small>Société minière principale</small><strong>{profile.mining_company.name}</strong><p>{profile.mining_company.abbreviation || 'Aucune abréviation'}</p></div><Badge tone={profile.mining_company.is_active ? 'success' : 'danger'}>{profile.mining_company.is_active ? 'Active' : 'Inactive'}</Badge></Card>}
              <DataTable<AdministrationSiteAccess> caption="Sites accessibles au compte" rows={details.sites} empty={sitesIndisponibles ? 'Accès aux sites indisponibles.' : 'Aucun site spécifique n’est affecté à ce compte.'} columns={[
                { key: 'site', header: 'Site', render: (ligne) => <span><strong>{ligne.sites?.name || ligne.site_id}</strong><small>{ligne.sites?.site_type || 'Type non renseigné'}</small></span> },
                { key: 'location', header: 'Localisation', render: (ligne) => <span className="user-detail__inline"><MapPin aria-hidden="true" />{ligne.sites?.location || 'Non renseignée'}</span> },
                { key: 'primary', header: 'Priorité', render: (ligne) => ligne.is_primary ? <Badge tone="success">Site principal</Badge> : <Badge tone="neutral">Site associé</Badge> },
                { key: 'assigned', header: 'Affecté le', render: (ligne) => formatDate(ligne.assigned_at) },
              ]} />
            </div>
          )}
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
