import { ArtisanDossierSummary } from '@/components/artisan/ArtisanDossierSummary';
import '@/components/artisan/artisan-form.css';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Coins,
  CreditCard,
  Download,
  Eye,
  Contact,
  Loader2,
  Pencil,
  Plus,
  Scale,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { artisanFullName } from '@/utils/artisanIdentity';
import {
  Badge,
  DataTable,
  EmptyState,
  Note,
  PageHeader,
  SearchInput,
  Section,
  StatGrid,
  type BadgeTone,
  type Column,
  type StatItem,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { carteProfessionnelleService, type CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanInfractionsService, type ArtisanInfraction } from '@/services/artisanInfractionsService';
import { useAuth } from '@/contexts/AuthContext';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { normaliserArtisan } from './artisanRow';
import './artisan-details.css';

type Onglet = 'informations' | 'carte' | 'transactions' | 'infractions';

const ONGLETS: Array<{ id: Onglet; label: string }> = [
  { id: 'informations', label: 'Informations' },
  { id: 'carte', label: 'Carte professionnelle' },
  { id: 'transactions', label: 'Ventes déclarées' },
  { id: 'infractions', label: 'Infractions' },
];

const VENTE_TONES: Record<string, BadgeTone> = {
  en_attente: 'warning',
  validee: 'info',
  payee: 'success',
  annulee: 'danger',
};

const VENTE_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  payee: 'Payée',
  annulee: 'Annulée',
};

const TRAITEMENT_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  cloture: 'Clôturé',
};

const CONCLUSION_LABELS: Record<string, string> = {
  reconnu: 'Reconnu',
  soupçonne: 'Soupçonné',
  complice: 'Complice',
  innocente: 'Innocenté',
};

const CONCLUSION_TONES: Record<string, BadgeTone> = {
  reconnu: 'danger',
  soupçonne: 'warning',
  complice: 'danger',
  innocente: 'success',
};

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFcfa = (value?: number) => `${integer.format(Math.round(value || 0))} FCFA`;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

export { artisanFullName };

/** Carte en cours de validité de l'artisan (la plus récemment délivrée parmi les valides). */
export function carteActive(cartes: CarteProfessionnelle[]): CarteProfessionnelle | null {
  const valides = cartes.filter((carte) => ['validee', 'en_exploitation'].includes(carte.statut));
  const candidates = valides.length > 0 ? valides : cartes;
  return (
    [...candidates].sort((a, b) => (b.date_delivrance || '').localeCompare(a.date_delivrance || ''))[0] || null
  );
}

export default function ArtisanMinierDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isCollector = isCollectorScopedUser(user);

  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);
  const [cartes, setCartes] = useState<CarteProfessionnelle[]>([]);
  const [ventes, setVentes] = useState<ArtisanGoldSale[]>([]);
  const [infractions, setInfractions] = useState<ArtisanInfraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<Onglet>('informations');
  const [rechercheVente, setRechercheVente] = useState('');
  const [rechercheInfraction, setRechercheInfraction] = useState('');
  const { alertState, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);

    const charger = async () => {
      // Chaque source est indépendante : l'absence d'infractions ou de ventes ne doit
      // pas empêcher l'affichage du dossier.
      const [artisanResult, cartesResult, ventesResult, infractionsResult] = await Promise.allSettled([
        artisanMinierService.getById(id),
        carteProfessionnelleService.getByArtisanId(id),
        artisanGoldSalesService.getByArtisan(id),
        isCollector ? Promise.resolve([]) : artisanInfractionsService.getByArtisanId(id),
      ]);
      if (!mounted) return;

      if (artisanResult.status === 'fulfilled' && artisanResult.value) {
        setArtisan(normaliserArtisan(artisanResult.value));
      } else {
        setArtisan(null);
        showError("Impossible de charger le dossier de l'artisan");
      }

      setCartes(cartesResult.status === 'fulfilled' ? ((cartesResult.value || []) as CarteProfessionnelle[]) : []);
      setVentes(ventesResult.status === 'fulfilled' ? ((ventesResult.value || []) as ArtisanGoldSale[]) : []);
      setInfractions(
        infractionsResult.status === 'fulfilled' ? ((infractionsResult.value || []) as ArtisanInfraction[]) : []
      );
      setLoading(false);
    };

    void charger();
    return () => {
      mounted = false;
    };
  }, [id, isCollector]);

  const carte = useMemo(() => carteActive(cartes), [cartes]);

  const totaux = useMemo(
    () => ({
      quantite: ventes.reduce((sum, vente) => sum + (vente.quantite_grammes || 0), 0),
      montant: ventes.reduce((sum, vente) => sum + (vente.montant_total_fcfa || 0), 0),
      infractionsOuvertes: infractions.filter((item) => item.statut_traitement === 'en_cours').length,
    }),
    [infractions, ventes]
  );

  const infractionTone: StatItem['tone'] = totaux.infractionsOuvertes > 0 ? 'red' : 'violet';

  const ventesFiltrees = useMemo(() => {
    const query = rechercheVente.trim().toLocaleLowerCase('fr');
    if (!query) return ventes;
    return ventes.filter((vente) =>
      [vente.numero_recu, vente.type_or, vente.observations]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query)
    );
  }, [rechercheVente, ventes]);

  const infractionsFiltrees = useMemo(() => {
    const query = rechercheInfraction.trim().toLocaleLowerCase('fr');
    if (!query) return infractions;
    return infractions.filter((item) =>
      [item.type_infraction, item.description, item.lieu]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query)
    );
  }, [infractions, rechercheInfraction]);

  const colonnesVentes: Column<ArtisanGoldSale>[] = [
    { key: 'numero_recu', header: 'N° de reçu', render: (vente) => <strong>{vente.numero_recu || '—'}</strong> },
    { key: 'date_vente', header: 'Date', render: (vente) => formatDate(vente.date_vente) },
    { key: 'type_or', header: 'Type', render: (vente) => vente.type_or },
    { key: 'quantite', header: 'Quantité', numeric: true, render: (vente) => `${decimal.format(vente.quantite_grammes)} g` },
    { key: 'montant', header: 'Montant', numeric: true, render: (vente) => formatFcfa(vente.montant_total_fcfa) },
    {
      key: 'statut',
      header: 'Statut',
      render: (vente) => (
        <Badge tone={VENTE_TONES[vente.statut] || 'neutral'}>{VENTE_LABELS[vente.statut] || vente.statut}</Badge>
      ),
    },
  ];

  const colonnesInfractions: Column<ArtisanInfraction>[] = [
    { key: 'date_infraction', header: 'Date', render: (item) => formatDate(item.date_infraction) },
    { key: 'type_infraction', header: 'Type', render: (item) => <strong>{item.type_infraction}</strong> },
    { key: 'lieu', header: 'Lieu', render: (item) => item.lieu || '—' },
    {
      key: 'statut_traitement',
      header: 'Traitement',
      render: (item) => (
        <Badge tone={item.statut_traitement === 'cloture' ? 'neutral' : 'warning'}>
          {TRAITEMENT_LABELS[item.statut_traitement] || item.statut_traitement}
        </Badge>
      ),
    },
    {
      key: 'conclusion',
      header: 'Conclusion',
      render: (item) =>
        item.conclusion ? (
          <Badge tone={CONCLUSION_TONES[item.conclusion] || 'neutral'}>
            {CONCLUSION_LABELS[item.conclusion] || item.conclusion}
          </Badge>
        ) : (
          <span className="artisan-detail__muted">En instruction</span>
        ),
    },
  ];

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <p className="sn-empty">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du dossier…
          </p>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (!artisan) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <CustomAlert {...alertState} onClose={closeAlert} />
          <PageHeader
            icon={UserRound}
            title="Artisan introuvable"
            subtitle="Ce dossier n’existe pas ou a été supprimé."
            breadcrumb={[
              { label: isCollector ? 'Collecteur' : 'Artisans miniers', to: isCollector ? '/portail-collecteur' : '/artisan-minier' },
              { label: 'Liste des artisans', to: '/artisan-minier/liste' },
              { label: 'Dossier' },
            ]}
          />
          <EmptyState
            title="Aucun dossier à afficher"
            description="Retournez à la liste pour sélectionner un artisan enregistré."
            action={
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/artisan-minier/liste')}>
                <ArrowLeft aria-hidden="true" /> Retour à la liste
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page artisan-detail">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={UserRound}
          title={artisanFullName(artisan)}
          subtitle={`${artisan.type_artisan || 'Artisan'} · ${artisan.numero_carte || 'Carte non attribuée'}`}
          breadcrumb={[
            { label: isCollector ? 'Collecteur' : 'Artisans miniers', to: isCollector ? '/portail-collecteur' : '/artisan-minier' },
            { label: 'Liste des artisans', to: '/artisan-minier/liste' },
            { label: artisanFullName(artisan) },
          ]}
          aside={
            <div className="artisan-detail__badges">
              <Badge tone={artisan.actif === false ? 'danger' : 'success'}>
                {artisan.actif === false ? 'Inactif' : 'Actif'}
              </Badge>
              {!isCollector && totaux.infractionsOuvertes > 0 && (
                <Badge tone="warning" icon={AlertTriangle}>
                  {integer.format(totaux.infractionsOuvertes)} infraction(s) en cours
                </Badge>
              )}
            </div>
          }
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/liste')}>
                <ArrowLeft aria-hidden="true" /> Liste
              </button>
              {!isCollector && <button
                type="button"
                className="sn-btn"
                onClick={() => navigate(`/artisan-minier/${artisan.id}/infractions/nouvelle`)}
              >
                <ShieldAlert aria-hidden="true" /> Signaler une infraction
              </button>}
              {!isCollector && <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate(`/artisan-minier/${artisan.id}/edit`)}
              >
                <Pencil aria-hidden="true" /> Modifier le dossier
              </button>}
            </>
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="Indicateurs du dossier"
            items={[
              { label: 'Ventes déclarées', value: integer.format(ventes.length), icon: Coins, tone: 'gold' },
              { label: 'Quantité collectée', value: `${decimal.format(totaux.quantite)} g`, icon: Scale, tone: 'green' },
              { label: "Chiffre d'affaires", value: formatFcfa(totaux.montant), icon: Banknote, tone: 'blue' },
              ...(isCollector ? [] : [{ label: 'Infractions', value: integer.format(infractions.length), hint: `${integer.format(totaux.infractionsOuvertes)} en cours`, icon: AlertTriangle, tone: infractionTone }]),
            ]}
          />
        </div>

        {isCollector && (
          <div style={{ marginTop: 16 }}>
            <Note tone="info" icon={Eye}>
              Dossier en lecture seule. Les modifications, validations, signalements et créations restent hors du périmètre du collecteur.
            </Note>
          </div>
        )}

        <nav className="artisan-detail__tabs" role="tablist" aria-label="Sections du dossier">
          {ONGLETS.filter((item) => !isCollector || item.id !== 'infractions').map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={onglet === item.id}
              className={onglet === item.id ? 'is-active' : ''}
              onClick={() => setOnglet(item.id)}
            >
              {item.label}
              {item.id === 'transactions' && ventes.length > 0 && <span className="sn-count">{ventes.length}</span>}
              {item.id === 'infractions' && infractions.length > 0 && <span className="sn-count">{infractions.length}</span>}
            </button>
          ))}
        </nav>

        {onglet === 'informations' && <ArtisanDossierSummary artisan={artisan} />}

        {onglet === 'carte' && (
          <Section
            id="carte"
            icon={Contact}
            tone="violet"
            title="Carte professionnelle"
            description="Titre d’exercice délivré à l’artisan."
          >
            {!carte ? (
              <EmptyState
                title="Aucune carte délivrée"
                description="La carte est générée après validation du dossier par la direction."
                action={!isCollector ? (
                  <button
                    type="button"
                    className="sn-btn"
                    onClick={() => navigate('/artisan-minier/cartes/validation')}
                  >
                    <BadgeCheck aria-hidden="true" /> Ouvrir la validation des cartes
                  </button>
                ) : undefined}
              />
            ) : (
              <>
                <dl className="artisan-detail__facts">
                  <div>
                    <dt>Numéro de carte</dt>
                    <dd>{carte.numero_carte}</dd>
                  </div>
                  <div>
                    <dt>Statut</dt>
                    <dd><Badge tone={carte.statut === 'suspendue' ? 'danger' : 'success'}>{carte.statut}</Badge></dd>
                  </div>
                  <div>
                    <dt>Délivrance</dt>
                    <dd>{formatDate(carte.date_delivrance)}</dd>
                  </div>
                  <div>
                    <dt>Expiration</dt>
                    <dd>{formatDate(carte.date_expiration)}</dd>
                  </div>
                  <div>
                    <dt>Numéro de sécurité</dt>
                    <dd>{carte.numero_securite || 'Non attribué'}</dd>
                  </div>
                </dl>

                {carte.carte_pdf_url ? (
                  <div className="artisan-detail__card-actions">
                    <a className="sn-btn" href={carte.carte_pdf_url} target="_blank" rel="noreferrer">
                      <Eye aria-hidden="true" /> Voir le PDF
                    </a>
                    <a
                      className="sn-btn sn-btn--primary"
                      href={carte.carte_pdf_url}
                      download={`carte_${(carte.numero_carte || '').replace(/\//g, '_')}.pdf`}
                    >
                      <Download aria-hidden="true" /> Télécharger
                    </a>
                  </div>
                ) : (
                  <Note tone="warning" icon={CreditCard}>
                    Le PDF de la carte n’a pas encore été généré pour ce titulaire.
                  </Note>
                )}

                {cartes.length > 1 && (
                  <p className="artisan-detail__muted" style={{ marginTop: 12 }}>
                    {integer.format(cartes.length - 1)} carte(s) antérieure(s) dans l’historique du titulaire.
                  </p>
                )}
              </>
            )}
          </Section>
        )}

        {onglet === 'transactions' && (
          <Section
            id="ventes"
            icon={Coins}
            tone="amber"
            title="Ventes déclarées"
            description="Collectes rattachées à cet artisan."
          >
            <div className="artisan-detail__toolbar">
              <SearchInput
                value={rechercheVente}
                onChange={setRechercheVente}
                placeholder="Rechercher par reçu, type d’or ou observation"
              />
              {!isCollector && <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate('/artisan-minier/ventes-or/nouvelle')}
              >
                <Plus aria-hidden="true" /> Nouvelle vente
              </button>}
            </div>
            {ventes.length === 0 ? (
              <EmptyState
                title="Aucune vente déclarée"
                description="Les collectes enregistrées pour cet artisan apparaîtront ici."
              />
            ) : (
              <DataTable
                columns={colonnesVentes}
                rows={ventesFiltrees}
                empty="Aucune vente ne correspond à cette recherche."
                caption="Ventes déclarées par l’artisan"
                onRowClick={(vente) => navigate(`/artisan-minier/ventes-or/${vente.id}`)}
              />
            )}
          </Section>
        )}

        {!isCollector && onglet === 'infractions' && (
          <Section
            id="infractions"
            icon={ShieldAlert}
            tone="slate"
            title="Infractions constatées"
            description="Manquements relevés lors des contrôles."
          >
            <div className="artisan-detail__toolbar">
              <SearchInput
                value={rechercheInfraction}
                onChange={setRechercheInfraction}
                placeholder="Rechercher par type, description ou lieu"
              />
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate(`/artisan-minier/${artisan.id}/infractions/nouvelle`)}
              >
                <Plus aria-hidden="true" /> Signaler une infraction
              </button>
            </div>
            {infractions.length === 0 ? (
              <EmptyState
                title="Aucune infraction enregistrée"
                description="Le dossier de cet artisan est vierge de tout manquement constaté."
              />
            ) : (
              <DataTable
                columns={colonnesInfractions}
                rows={infractionsFiltrees}
                empty="Aucune infraction ne correspond à cette recherche."
                caption="Infractions constatées"
                onRowClick={(item) => navigate(`/artisan-minier/${artisan.id}/infractions/${item.id}`)}
              />
            )}
          </Section>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
