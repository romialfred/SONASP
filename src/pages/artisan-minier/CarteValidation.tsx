import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Check,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Loader2,
  ShieldCheck,
  UserRound,
  XCircle,
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
  type Column,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import type { CarteProfessionnelle } from '@/services/carteProfessionnelleService';
import type { ArtisanMinier } from '@/services/artisanMinierService';

interface CarteRow extends CarteProfessionnelle {
  artisan?: ArtisanMinier | null;
}

interface DashboardStats {
  total: number;
  en_cours: number;
  validees: number;
  expirees: number;
  suspendues: number;
}

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

export default function CarteValidation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<CarteRow[]>([]);
  const [search, setSearch] = useState('');
  const { showAlert } = useCustomAlert();

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardStats, enCours] = await Promise.all([
        carteProfessionnelleService.getDashboardStats(),
        carteProfessionnelleService.getCartesEnCours(),
      ]);
      setStats(dashboardStats as DashboardStats);
      setPending((enCours || []) as CarteRow[]);
    } catch {
      showAlert('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleValidate = async (carte: CarteRow) => {
    setValidating(carte.id);
    try {
      await carteProfessionnelleService.valider(carte.id);
      showAlert(`Carte ${carte.numero_carte} validée`, 'success');
      await loadData();
    } catch {
      showAlert('Erreur lors de la validation', 'error');
    } finally {
      setValidating(null);
    }
  };

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    if (!query) return pending;
    return pending.filter((carte) =>
      [holderName(carte), carte.numero_carte, carte.artisan?.region]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query)
    );
  }, [pending, search]);

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
    {
      key: 'type',
      header: 'Type d’artisan',
      render: (carte) => <Badge tone="info">{carte.artisan?.type_artisan || '—'}</Badge>,
    },
    { key: 'region', header: 'Région', render: (carte) => carte.artisan?.region || '—' },
    { key: 'delivrance', header: 'Délivrance', render: (carte) => formatDate(carte.date_delivrance) },
    { key: 'expiration', header: 'Expiration', render: (carte) => formatDate(carte.date_expiration) },
    {
      key: 'action',
      header: 'Action',
      render: (carte) => (
        <button
          type="button"
          className="sn-btn sn-btn--primary sn-btn--sm"
          disabled={validating === carte.id}
          onClick={(event) => {
            event.stopPropagation();
            void handleValidate(carte);
          }}
        >
          {validating === carte.id ? (
            <Loader2 className="sn-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          Valider
        </button>
      ),
    },
  ];

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <PageHeader
          icon={ClipboardCheck}
          title="Validation des cartes professionnelles"
          subtitle="Contrôlez les demandes en attente et délivrez les cartes des artisans miniers."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Validation des cartes' },
          ]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/cartes/suivi')}>
              <CreditCard aria-hidden="true" /> Suivi des cartes
            </button>
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="Indicateurs des cartes professionnelles"
            items={[
              { label: 'En attente de validation', value: integer.format(stats?.en_cours || 0), icon: Clock3, tone: 'gold' },
              { label: 'Cartes validées', value: integer.format(stats?.validees || 0), icon: BadgeCheck, tone: 'green' },
              { label: 'Cartes expirées', value: integer.format(stats?.expirees || 0), icon: XCircle, tone: 'red' },
              { label: 'Cartes suspendues', value: integer.format(stats?.suspendues || 0), icon: ShieldCheck, tone: 'violet' },
            ]}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Section
            id="pending"
            icon={ClipboardCheck}
            tone="amber"
            title={`Demandes en attente (${integer.format(pending.length)})`}
            description="Vérifiez l’identité du titulaire et les dates avant de valider la carte."
          >
            <div style={{ display: 'flex', gap: 11, marginBottom: 14 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par titulaire, numéro de carte ou région"
              />
            </div>

            {!loading && pending.length === 0 ? (
              <EmptyState
                title="Aucune carte en attente de validation"
                description="Les demandes apparaîtront ici dès l’enregistrement d’un artisan minier."
              />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                loading={loading}
                empty="Aucune demande ne correspond à cette recherche."
                caption="Cartes professionnelles en attente de validation"
              />
            )}
          </Section>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
