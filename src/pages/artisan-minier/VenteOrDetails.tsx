import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  BadgeCheck,
  Coins,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  Scale,
  StickyNote,
  UserRound,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  EmptyState,
  Note,
  PageHeader,
  Section,
  StatGrid,
  type BadgeTone,
} from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import './vente-or-details.css';

type Statut = ArtisanGoldSale['statut'];

const STATUT_LABELS: Record<Statut, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  payee: 'Payée',
  annulee: 'Annulée',
};

const STATUT_TONES: Record<Statut, BadgeTone> = {
  en_attente: 'warning',
  validee: 'info',
  payee: 'success',
  annulee: 'danger',
};

const TYPE_OR_LABELS: Record<string, string> = {
  poudre: 'Poudre',
  lingot: 'Lingot',
  pepites: 'Pépites',
  bijoux: 'Bijoux',
  autre: 'Autre',
};

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFcfa = (value?: number) => `${integer.format(Math.round(value || 0))} FCFA`;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const artisanLabel = (artisan: ArtisanMinier | null) => {
  if (!artisan) return 'Artisan inconnu';
  return (
    artisan.raison_sociale ||
    [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') ||
    'Artisan sans nom'
  );
};

/** Actions ouvertes selon le statut courant de la vente. */
export function availableActions(statut: Statut) {
  return {
    modifier: statut === 'en_attente',
    valider: statut === 'en_attente',
    annuler: statut === 'en_attente' || statut === 'validee',
    payer: statut === 'validee',
  };
}

export default function VenteOrDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [vente, setVente] = useState<ArtisanGoldSale | null>(null);
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();
  const confirmation = useConfirmationDialog();

  const charger = async (venteId: string) => {
    setLoading(true);
    try {
      const data = await artisanGoldSalesService.getById(venteId);
      if (!data) {
        setVente(null);
        return;
      }
      setVente(data);
      if (data.artisan_id) {
        try {
          setArtisan(await artisanMinierService.getById(data.artisan_id));
        } catch {
          setArtisan(null); // le détail de la vente reste consultable sans la fiche artisan
        }
      }
    } catch {
      showError('Impossible de charger les détails de la vente');
      setVente(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) void charger(id);
  }, [id]);

  const orFin = useMemo(() => {
    if (!vente) return 0;
    return (vente.quantite_grammes * (vente.purete_karat / 24) * 100) / 100;
  }, [vente]);

  const actions = vente ? availableActions(vente.statut) : null;

  const changerStatut = async (statut: Statut, libelle: string) => {
    if (!vente || updating) return;

    const confirmed = await confirmation.open({
      title: `${libelle} cette vente ?`,
      message: `La vente ${vente.numero_recu || ''} passera au statut « ${STATUT_LABELS[statut]} ».`,
      confirmText: libelle,
      cancelText: 'Annuler',
      severity: statut === 'annulee' ? 'danger' : 'warning',
      details: {
        Quantité: `${decimal.format(vente.quantite_grammes)} g`,
        Montant: formatFcfa(vente.montant_total_fcfa),
      },
    });
    if (!confirmed) return;

    setUpdating(true);
    try {
      await artisanGoldSalesService.updateStatus(vente.id, statut);
      showSuccess(`Vente ${STATUT_LABELS[statut].toLocaleLowerCase('fr')}`);
      await charger(vente.id);
    } catch {
      showError('Le changement de statut a échoué');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <p className="sn-empty">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la vente…
          </p>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (!vente) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <PageHeader
            icon={Coins}
            title="Vente introuvable"
            subtitle="Cette vente n’existe pas ou a été supprimée du registre."
            breadcrumb={[
              { label: 'Artisans miniers', to: '/artisan-minier' },
              { label: "Ventes d'or", to: '/artisan-minier/ventes-or' },
              { label: 'Détail' },
            ]}
          />
          <EmptyState
            title="Aucune vente à afficher"
            description="Retournez au registre pour sélectionner une déclaration existante."
            action={
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/artisan-minier/ventes-or')}>
                <ArrowLeft aria-hidden="true" /> Retour au registre
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page vente-detail">
        <CustomAlert {...alertState} onClose={closeAlert} />
        <confirmation.ConfirmationDialog />

        <PageHeader
          icon={Coins}
          title={vente.numero_recu || 'Vente sans numéro de reçu'}
          subtitle={`Déclarée le ${formatDate(vente.date_vente)} · ${TYPE_OR_LABELS[vente.type_or] || vente.type_or}`}
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: "Ventes d'or", to: '/artisan-minier/ventes-or' },
            { label: vente.numero_recu || 'Détail' },
          ]}
          aside={
            <div className="vente-detail__statut">
              <Badge tone={STATUT_TONES[vente.statut]}>{STATUT_LABELS[vente.statut]}</Badge>
            </div>
          }
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/ventes-or')}>
                <ArrowLeft aria-hidden="true" /> Registre
              </button>
              {actions?.modifier && (
                <button
                  type="button"
                  className="sn-btn"
                  onClick={() => navigate(`/artisan-minier/ventes-or/${vente.id}/modifier`)}
                >
                  <Pencil aria-hidden="true" /> Modifier
                </button>
              )}
              {actions?.valider && (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  disabled={updating}
                  onClick={() => void changerStatut('validee', 'Valider')}
                >
                  {updating ? <Loader2 className="sn-spin" aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}
                  Valider la vente
                </button>
              )}
              {actions?.payer && (
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => navigate(`/artisan-minier/paiements/${vente.id}/nouveau`)}
                >
                  <CreditCard aria-hidden="true" /> Ouvrir le paiement
                </button>
              )}
            </>
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="Indicateurs de la vente"
            items={[
              { label: 'Quantité déclarée', value: `${decimal.format(vente.quantite_grammes)} g`, hint: `${decimal.format(vente.quantite_grammes / TROY_OZ_GRAMS)} oz troy`, icon: Scale, tone: 'gold' },
              { label: 'Or fin estimé', value: `${decimal.format(orFin)} g`, hint: `${vente.purete_karat} carats`, icon: Coins, tone: 'green' },
              { label: 'Montant total', value: formatFcfa(vente.montant_total_fcfa), hint: 'Taxes comprises', icon: Banknote, tone: 'blue' },
              { label: 'Taxes appliquées', value: formatFcfa((vente.tva_montant_fcfa || 0) + (vente.taxe_dev_comm_montant_fcfa || 0)), icon: Receipt, tone: 'violet' },
            ]}
          />
        </div>

        <div className="vente-detail__layout">
          <div className="vente-detail__main">
            <Section
              id="caracteristiques"
              icon={Scale}
              tone="amber"
              title="Caractéristiques de la collecte"
              description="Nature, titre et volume de l’or déclaré."
            >
              <dl className="vente-detail__facts">
                <div>
                  <dt>Type d’or</dt>
                  <dd>{TYPE_OR_LABELS[vente.type_or] || vente.type_or}</dd>
                </div>
                <div>
                  <dt>Titre</dt>
                  <dd>{vente.purete_karat} carats ({decimal.format((vente.purete_karat / 24) * 100)} %)</dd>
                </div>
                <div>
                  <dt>Quantité</dt>
                  <dd>{decimal.format(vente.quantite_grammes)} g</dd>
                </div>
                <div>
                  <dt>Prix au kilogramme</dt>
                  <dd>{formatFcfa(vente.prix_kg_fcfa)}</dd>
                </div>
                <div>
                  <dt>Prix au gramme</dt>
                  <dd>{formatFcfa(vente.prix_kg_fcfa / 1000)}</dd>
                </div>
                <div>
                  <dt>Date de vente</dt>
                  <dd>{formatDate(vente.date_vente)}</dd>
                </div>
              </dl>
            </Section>

            <Section
              id="fiscal"
              icon={Receipt}
              tone="blue"
              title="Détail fiscal"
              description="Décomposition du montant enregistré au registre national."
            >
              <dl className="vente-detail__amounts">
                <div>
                  <dt>Montant brut</dt>
                  <dd>{formatFcfa(vente.montant_brut_fcfa)}</dd>
                </div>
                <div>
                  <dt>TVA ({vente.tva_taux || 0} %)</dt>
                  <dd>{formatFcfa(vente.tva_montant_fcfa)}</dd>
                </div>
                <div>
                  <dt>Taxe de développement communal ({vente.taxe_dev_comm_taux || 0} %)</dt>
                  <dd>{formatFcfa(vente.taxe_dev_comm_montant_fcfa)}</dd>
                </div>
                <div className="is-total">
                  <dt>Montant total</dt>
                  <dd>{formatFcfa(vente.montant_total_fcfa)}</dd>
                </div>
              </dl>
            </Section>

            {vente.observations ? (
              <Section
                id="observations"
                icon={StickyNote}
                tone="slate"
                title="Observations"
                description="Remarques consignées lors de la déclaration."
              >
                <p className="vente-detail__notes">{vente.observations}</p>
              </Section>
            ) : null}
          </div>

          <aside className="vente-detail__aside" aria-label="Artisan et suivi">
            <section className="sn-card">
              <div className="sn-card__head">
                <div>
                  <h3>Artisan vendeur</h3>
                  <p className="sn-card__hint">Titulaire de la déclaration.</p>
                </div>
              </div>
              {!artisan ? (
                <p className="sn-empty">Fiche artisan indisponible.</p>
              ) : (
                <div className="vente-detail__artisan">
                  <p className="vente-detail__artisan-name">
                    <UserRound aria-hidden="true" />
                    <strong>{artisanLabel(artisan)}</strong>
                  </p>
                  <ul>
                    <li><CreditCard aria-hidden="true" /> {artisan.numero_carte || 'Carte non renseignée'}</li>
                    <li><MapPin aria-hidden="true" /> {[artisan.commune, artisan.region].filter(Boolean).join(', ') || 'Localisation inconnue'}</li>
                    <li><Phone aria-hidden="true" /> {artisan.telephone || 'Téléphone non renseigné'}</li>
                    <li><Mail aria-hidden="true" /> {artisan.email || 'E-mail non renseigné'}</li>
                  </ul>
                  <button
                    type="button"
                    className="sn-btn sn-btn--sm"
                    onClick={() => navigate(`/artisan-minier/${artisan.id}`)}
                  >
                    Ouvrir la fiche artisan
                  </button>
                </div>
              )}
            </section>

            <section className="sn-card">
              <div className="sn-card__head">
                <div>
                  <h3>Suivi</h3>
                  <p className="sn-card__hint">Traçabilité de la déclaration.</p>
                </div>
              </div>
              <ol className="vente-detail__timeline">
                <li>
                  <span>Déclaration créée</span>
                  <b>{formatDateTime(vente.created_at)}</b>
                </li>
                <li>
                  <span>Dernière modification</span>
                  <b>{formatDateTime(vente.updated_at)}</b>
                </li>
                <li>
                  <span>Statut courant</span>
                  <b>{STATUT_LABELS[vente.statut]}</b>
                </li>
              </ol>

              {actions?.annuler && (
                <div className="vente-detail__danger">
                  <button
                    type="button"
                    className="sn-btn sn-btn--sm sn-btn--danger"
                    disabled={updating}
                    onClick={() => void changerStatut('annulee', 'Annuler')}
                  >
                    Annuler la vente
                  </button>
                </div>
              )}
            </section>

            {vente.statut === 'payee' && (
              <Note icon={Wallet}>
                Cette vente a été réglée. Le détail du paiement est consultable depuis
                l’historique des paiements.
              </Note>
            )}
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
