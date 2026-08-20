import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Coins,
  CreditCard,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  Card,
  EmptyState,
  Note,
  PageHeader,
  StatGrid,
} from '@/components/ui/sn';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import './carte-suivi.css';

interface DashboardStats {
  total: number;
  en_cours: number;
  validees: number;
  en_exploitation: number;
  expirees: number;
  suspendues: number;
  expirant_30_jours: number;
}

interface ActivityRow {
  id: string;
  type_activite?: string;
  description?: string;
  created_at?: string;
  artisan?: {
    nom?: string;
    prenoms?: string;
    raison_sociale?: string;
    type_personne?: string;
    type_artisan?: string;
  } | null;
  carte?: { numero_carte?: string } | null;
}

interface TopArtisan {
  artisanId: string;
  artisan: Record<string, unknown> | null;
  carte: Record<string, unknown> | null;
  ventes: number;
  montant: number;
  grammes: number;
}

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const holderLabel = (holder?: Record<string, unknown> | null) => {
  if (!holder) return 'Titulaire inconnu';
  if (holder.type_personne === 'morale') return String(holder.raison_sociale || 'Société');
  return [holder.nom, holder.prenoms].filter(Boolean).join(' ') || 'Artisan';
};

const formatMoney = (value: number) =>
  value >= 1_000_000 ? `${decimal.format(value / 1_000_000)} M FCFA` : `${integer.format(value)} FCFA`;

/** Ancienneté lisible d'un évènement, sans dépendance de formatage supplémentaire. */
export function timeAgo(value?: string, reference: Date = new Date()) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const minutes = Math.floor((reference.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR');
}

export default function CarteSuivi() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [topArtisans, setTopArtisans] = useState<TopArtisan[]>([]);
  const { showAlert } = useCustomAlert();

  const loadData = async () => {
    setLoading(true);
    try {
      // Chaque source est indépendante : une table absente ne doit pas vider l'écran.
      const [statsResult, activitiesResult, topResult] = await Promise.allSettled([
        carteProfessionnelleService.getDashboardStats(),
        carteProfessionnelleService.getRecentActivities(10),
        carteProfessionnelleService.getTopArtisans(5),
      ]);

      if (statsResult.status === 'fulfilled') setStats(statsResult.value as DashboardStats);
      else showAlert('Erreur lors du chargement des indicateurs', 'error');

      setActivities(activitiesResult.status === 'fulfilled' ? (activitiesResult.value as ActivityRow[]) : []);
      setTopArtisans(topResult.status === 'fulfilled' ? (topResult.value as TopArtisan[]) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const validityRate = useMemo(() => {
    if (!stats || !stats.total) return 0;
    return Math.round(((stats.validees + stats.en_exploitation) / stats.total) * 100);
  }, [stats]);

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
        <PageHeader
          icon={TrendingUp}
          title="Suivi des cartes professionnelles"
          subtitle="État du parc de cartes, activité récente et artisans les plus actifs."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Suivi des cartes' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void loadData()}>
                <RefreshCw aria-hidden="true" /> Actualiser
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/artisan-minier/cartes/validation')}>
                <ClipboardCheck aria-hidden="true" /> Valider les demandes
              </button>
            </>
          }
        />

        <div style={{ marginTop: 16 }}>
          <StatGrid
            ariaLabel="État du parc de cartes"
            items={[
              { label: 'Cartes délivrées', value: integer.format(stats?.total || 0), hint: `${validityRate} % en cours de validité`, icon: CreditCard, tone: 'blue' },
              { label: 'En exploitation', value: integer.format(stats?.en_exploitation || 0), icon: BadgeCheck, tone: 'green' },
              { label: 'En attente', value: integer.format(stats?.en_cours || 0), hint: 'À valider', icon: Clock3, tone: 'gold' },
              { label: 'Expirent sous 30 j', value: integer.format(stats?.expirant_30_jours || 0), icon: CalendarClock, tone: 'gold' },
              { label: 'Expirées', value: integer.format(stats?.expirees || 0), icon: XCircle, tone: 'red' },
              { label: 'Suspendues', value: integer.format(stats?.suspendues || 0), icon: ShieldAlert, tone: 'violet' },
            ]}
          />
        </div>

        {(stats?.expirant_30_jours || 0) > 0 && (
          <div style={{ marginTop: 12 }}>
            <Note tone="warning" icon={CalendarClock}>
              {integer.format(stats?.expirant_30_jours || 0)} carte(s) arrivent à échéance dans les 30 jours.{' '}
              <button
                type="button"
                className="carte-suivi__inline-link"
                onClick={() => navigate('/artisan-minier/cartes/expirations')}
              >
                Traiter les expirations
              </button>
            </Note>
          </div>
        )}

        <section className="carte-suivi__grid">
          <Card title="Activité récente" hint="Dix derniers évènements enregistrés sur les cartes.">
            {loading ? (
              <p className="sn-empty">Chargement de l’activité…</p>
            ) : activities.length === 0 ? (
              <EmptyState
                title="Aucune activité enregistrée"
                description="Les évènements de délivrance, validation et suspension apparaîtront ici."
              />
            ) : (
              <ol className="carte-suivi__feed">
                {activities.map((item) => (
                  <li key={item.id}>
                    <span className="carte-suivi__feed-icon">
                      <Activity aria-hidden="true" />
                    </span>
                    <span className="carte-suivi__feed-body">
                      <strong>{holderLabel(item.artisan)}</strong>
                      <small>
                        {item.description || item.type_activite || 'Activité sur la carte'}
                        {item.carte?.numero_carte ? ` · ${item.carte.numero_carte}` : ''}
                      </small>
                    </span>
                    <em>{timeAgo(item.created_at)}</em>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Artisans les plus actifs" hint="Classement par montant de ventes déclarées.">
            {loading ? (
              <p className="sn-empty">Chargement du classement…</p>
            ) : topArtisans.length === 0 ? (
              <EmptyState
                title="Aucune statistique disponible"
                description="Le classement se construit à partir des ventes d’or déclarées."
              />
            ) : (
              <ol className="carte-suivi__ranking">
                {topArtisans.map((item, index) => (
                  <li key={item.artisanId}>
                    <span className="carte-suivi__rank">{index + 1}</span>
                    <span className="carte-suivi__ranking-body">
                      <strong>{holderLabel(item.artisan)}</strong>
                      <small>
                        {integer.format(item.ventes)} vente(s) · {decimal.format(item.grammes)} g
                      </small>
                    </span>
                    <span className="carte-suivi__ranking-value">
                      <b>{formatMoney(item.montant)}</b>
                      {item.carte?.statut ? (
                        <Badge tone={item.carte.statut === 'suspendue' ? 'danger' : 'success'}>
                          {String(item.carte.statut)}
                        </Badge>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>

        <div style={{ marginTop: 12 }}>
          <Note icon={Coins}>
            Ventes déclarées, non paiements encaissés.
          </Note>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
