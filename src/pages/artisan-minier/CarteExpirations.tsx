import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  CreditCard,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  SearchInput,
  Section,
  StatGrid,
  type BadgeTone,
  type Column,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import type { ArtisanMinier } from '@/services/artisanMinierService';

interface CarteRow extends CarteProfessionnelle {
  artisan?: ArtisanMinier | null;
}

/** Fenêtres de vigilance : la carte est classée dans la première qu'elle satisfait. */
type Horizon = 'expirees' | '7j' | '30j' | '60j';

const HORIZONS: Array<{ key: Horizon; label: string; days: number | null; tone: BadgeTone }> = [
  { key: 'expirees', label: 'Déjà expirées', days: null, tone: 'danger' },
  { key: '7j', label: 'Sous 7 jours', days: 7, tone: 'danger' },
  { key: '30j', label: 'Sous 30 jours', days: 30, tone: 'warning' },
  { key: '60j', label: 'Sous 60 jours', days: 60, tone: 'info' },
];

const integer = new Intl.NumberFormat('fr-FR');

const holderName = (carte: CarteRow) => {
  const artisan = carte.artisan;
  if (!artisan) return 'Titulaire inconnu';
  return artisan.type_personne === 'morale'
    ? artisan.raison_sociale || 'Société sans raison sociale'
    : [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan sans nom';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

export const daysUntil = (value: string | undefined, reference: Date = new Date()) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((date.getTime() - reference.getTime()) / 86_400_000);
};

/** Classe chaque carte dans sa fenêtre de vigilance ; une carte n'apparaît qu'une fois. */
export function groupByHorizon(cards: CarteRow[], reference: Date = new Date()): Record<Horizon, CarteRow[]> {
  const buckets: Record<Horizon, CarteRow[]> = { expirees: [], '7j': [], '30j': [], '60j': [] };

  cards.forEach((carte) => {
    const remaining = daysUntil(carte.date_expiration, reference);
    if (!Number.isFinite(remaining)) return;
    if (remaining < 0) buckets.expirees.push(carte);
    else if (remaining <= 7) buckets['7j'].push(carte);
    else if (remaining <= 30) buckets['30j'].push(carte);
    else if (remaining <= 60) buckets['60j'].push(carte);
  });

  (Object.keys(buckets) as Horizon[]).forEach((key) => {
    buckets[key].sort((a, b) => daysUntil(a.date_expiration, reference) - daysUntil(b.date_expiration, reference));
  });

  return buckets;
}

export default function CarteExpirations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CarteRow[]>([]);
  const [horizon, setHorizon] = useState<Horizon>('7j');
  const [search, setSearch] = useState('');
  const { showAlert } = useCustomAlert();

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await carteProfessionnelleService.getAllCartes();
      setCards((all || []) as CarteRow[]);
    } catch {
      showAlert('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const buckets = useMemo(() => groupByHorizon(cards), [cards]);

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    const list = buckets[horizon];
    if (!query) return list;
    return list.filter((carte) =>
      [holderName(carte), carte.numero_carte, carte.artisan?.region]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query)
    );
  }, [buckets, horizon, search]);

  const columns: Column<CarteRow>[] = [
    {
      key: 'titulaire',
      header: 'Titulaire',
      render: (carte) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <UserRound aria-hidden="true" style={{ width: 15, height: 15, color: '#7f92a5' }} />
          <strong>{holderName(carte)}</strong>
        </span>
      ),
    },
    { key: 'numero_carte', header: 'N° de carte', render: (carte) => carte.numero_carte || '—' },
    { key: 'region', header: 'Région', render: (carte) => carte.artisan?.region || '—' },
    { key: 'expiration', header: 'Expiration', render: (carte) => formatDate(carte.date_expiration) },
    {
      key: 'reste',
      header: 'Échéance',
      render: (carte) => {
        const remaining = daysUntil(carte.date_expiration);
        if (remaining < 0) return <Badge tone="danger">Expirée depuis {Math.abs(remaining)} j</Badge>;
        const tone: BadgeTone = remaining <= 7 ? 'danger' : remaining <= 30 ? 'warning' : 'info';
        return <Badge tone={tone}>{remaining} jour{remaining > 1 ? 's' : ''}</Badge>;
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (carte) => (
        <button
          type="button"
          className="sn-btn sn-btn--sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/artisan-minier/${carte.artisan_id}`);
          }}
        >
          <RefreshCw aria-hidden="true" /> Traiter
        </button>
      ),
    },
  ];

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <PageHeader
          icon={CalendarClock}
          title="Expirations des cartes professionnelles"
          subtitle="Anticipez les renouvellements : chaque carte n’apparaît que dans sa fenêtre d’échéance la plus proche."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Expirations' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void loadData()}>
                <RefreshCw aria-hidden="true" /> Actualiser
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/artisan-minier/cartes/validation')}>
                <CreditCard aria-hidden="true" /> Validation des cartes
              </button>
            </>
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="Fenêtres d’expiration"
            items={[
              { label: 'Déjà expirées', value: integer.format(buckets.expirees.length), hint: 'À régulariser sans délai', icon: ShieldAlert, tone: 'red' },
              { label: 'Sous 7 jours', value: integer.format(buckets['7j'].length), hint: 'Urgence de renouvellement', icon: AlertTriangle, tone: 'red' },
              { label: 'Sous 30 jours', value: integer.format(buckets['30j'].length), hint: 'À planifier ce mois', icon: Clock3, tone: 'gold' },
              { label: 'Sous 60 jours', value: integer.format(buckets['60j'].length), hint: 'À surveiller', icon: CalendarClock, tone: 'blue' },
            ]}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Section
            id="horizons"
            icon={CalendarClock}
            tone="amber"
            title="Cartes à renouveler"
            description="Sélectionnez une fenêtre d’échéance pour traiter les dossiers correspondants."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14, flexWrap: 'wrap' }}>
              <div className="sn-chips" role="group" aria-label="Fenêtre d’échéance">
                {HORIZONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={horizon === item.key ? 'is-active' : ''}
                    onClick={() => setHorizon(item.key)}
                  >
                    {item.label} <b>({integer.format(buckets[item.key].length)})</b>
                  </button>
                ))}
              </div>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par titulaire, numéro de carte ou région"
              />
            </div>

            {!loading && buckets[horizon].length === 0 ? (
              <EmptyState
                title="Aucune carte dans cette fenêtre"
                description="Rien à renouveler sur cette échéance : sélectionnez une autre fenêtre."
              />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                loading={loading}
                empty="Aucune carte ne correspond à cette recherche."
                caption="Cartes professionnelles arrivant à échéance"
              />
            )}
          </Section>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
