import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, SearchInput, Section, SelectControl, StatGrid } from '@/components/ui/sn';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import './payments.css';

const JOURS_ECHEANCE = 30;
const JOUR_MS = 24 * 60 * 60 * 1000;

export type CategoriePaiement = 'paye' | 'en_attente' | 'en_retard' | 'rejete' | 'inconnu';

export interface Paiement {
  id: string;
  sale_id: string | null;
  invoice_number: string;
  expected_date: string | null;
  due_date: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  sale_number: string;
  client: string;
  categorie: CategoriePaiement;
  created_at: string | null;
}

export const LIBELLES_CATEGORIE: Record<CategoriePaiement, string> = {
  paye: 'Payé',
  en_attente: 'En attente',
  en_retard: 'En retard',
  rejete: 'Rejeté',
  inconnu: 'Statut inconnu',
};

const TONS_CATEGORIE: Record<CategoriePaiement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  paye: 'success',
  en_attente: 'warning',
  en_retard: 'danger',
  rejete: 'danger',
  inconnu: 'neutral',
};

/** Montant dans sa devise d'origine, en écriture française. */
export function montant(valeur: number, devise: string): string {
  const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(valeur || 0));
  return `${nombre} ${devise || ''}`.trim();
}

export function formatDate(valeur: string | null): string {
  if (!valeur) return '—';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Échéance contractuelle : trente jours après la date attendue. */
export function echeance(dateAttendue: string | null): string | null {
  if (!dateAttendue) return null;
  const base = new Date(dateAttendue);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + JOURS_ECHEANCE * JOUR_MS).toISOString().slice(0, 10);
}

/** Jours restants avant échéance ; négatif au-delà. `null` sans échéance connue. */
export function joursAvantEcheance(dateEcheance: string | null, aujourdhui = new Date()): number | null {
  if (!dateEcheance) return null;
  const cible = new Date(dateEcheance);
  if (Number.isNaN(cible.getTime())) return null;
  cible.setHours(0, 0, 0, 0);
  const reference = new Date(aujourdhui);
  reference.setHours(0, 0, 0, 0);
  return Math.ceil((cible.getTime() - reference.getTime()) / JOUR_MS);
}

export function libelleEcheance(jours: number | null): string {
  if (jours === null) return '—';
  if (jours < 0) return `${Math.abs(jours)} jour${Math.abs(jours) > 1 ? 's' : ''} de retard`;
  if (jours === 0) return 'Échoit aujourd’hui';
  return `${jours} jour${jours > 1 ? 's' : ''}`;
}

export function categoriePaiement(
  statut: string | null,
  dateEcheance: string | null,
  aujourdhui = new Date()
): CategoriePaiement {
  if (statut === 'approved') return 'paye';
  if (statut === 'rejected') return 'rejete';
  if (statut === 'pending') {
    const jours = joursAvantEcheance(dateEcheance, aujourdhui);
    return jours !== null && jours < 0 ? 'en_retard' : 'en_attente';
  }
  return 'inconnu';
}

/**
 * Cumuls affichés en tête.
 * Les montants ne sont additionnés que si toutes les lignes partagent la même devise :
 * l'écran totalisait indistinctement des montants de devises différentes.
 */
export function cumulsPaiements(paiements: Paiement[]) {
  const devises = new Set(paiements.map((paiement) => paiement.currency).filter(Boolean));
  const deviseUnique = devises.size === 1 ? [...devises][0] : null;
  const somme = (categorie?: CategoriePaiement) =>
    paiements
      .filter((paiement) => !categorie || paiement.categorie === categorie)
      .reduce((total, paiement) => total + Number(paiement.amount || 0), 0);

  return {
    deviseUnique,
    total: somme(),
    paye: somme('paye'),
    enAttente: somme('en_attente'),
    nombre: paiements.length,
    nombrePaye: paiements.filter((paiement) => paiement.categorie === 'paye').length,
    nombreEnAttente: paiements.filter((paiement) => paiement.categorie === 'en_attente').length,
    nombreEnRetard: paiements.filter((paiement) => paiement.categorie === 'en_retard').length,
  };
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtrePeriode, setFiltrePeriode] = useState('toutes');

  const charger = useCallback(async (actualiser = false) => {
    if (actualiser) setActualisation(true);
    else setChargement(true);
    setErreur(null);

    try {
      const { data: lignes, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const brutes = lignes || [];
      if (brutes.length === 0) {
        setPaiements([]);
        return;
      }

      const identifiantsVente = [...new Set(brutes.map((ligne) => ligne.sale_id).filter(Boolean))];
      const ventes = identifiantsVente.length
        ? (await supabase.from('sales').select('id, sale_number, customer_id').in('id', identifiantsVente)).data || []
        : [];

      const identifiantsClient = [...new Set(ventes.map((vente) => vente.customer_id).filter(Boolean))];
      const clients = identifiantsClient.length
        ? (await supabase.from('customers').select('id, name').in('id', identifiantsClient)).data || []
        : [];

      const parVente = new Map(ventes.map((vente) => [vente.id, vente]));
      const parClient = new Map(clients.map((client) => [client.id, client]));

      setPaiements(
        brutes
          .filter((ligne) => ligne?.id)
          .map((ligne) => {
            const vente = ligne.sale_id ? parVente.get(ligne.sale_id) : null;
            const client = vente?.customer_id ? parClient.get(vente.customer_id) : null;
            const dateEcheance = echeance(ligne.expected_date);

            return {
              id: ligne.id,
              sale_id: ligne.sale_id ?? null,
              invoice_number: ligne.invoice_number || `FACT-${String(ligne.id).slice(0, 8).toUpperCase()}`,
              expected_date: ligne.expected_date ?? null,
              due_date: dateEcheance,
              amount: Number(ligne.amount || 0),
              currency: ligne.currency || 'USD',
              payment_method: ligne.bank_name || 'Virement bancaire',
              sale_number: vente?.sale_number || '—',
              client: client?.name || 'Client non renseigné',
              categorie: categoriePaiement(ligne.status, dateEcheance),
              created_at: ligne.created_at,
            };
          })
      );
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les paiements.'));
      setPaiements([]);
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return paiements.filter((paiement) => {
      const correspondTerme =
        !terme ||
        [paiement.invoice_number, paiement.sale_number, paiement.client].some((champ) =>
          champ?.toLowerCase().includes(terme)
        );
      const correspondStatut = filtreStatut === 'tous' || paiement.categorie === filtreStatut;
      const correspondPeriode = (() => {
        if (filtrePeriode === 'toutes' || !paiement.created_at) return filtrePeriode === 'toutes';
        const ecart = Math.floor((Date.now() - new Date(paiement.created_at).getTime()) / JOUR_MS);
        if (filtrePeriode === 'semaine') return ecart <= 7;
        if (filtrePeriode === 'mois') return ecart <= 30;
        return ecart <= 90;
      })();
      return correspondTerme && correspondStatut && correspondPeriode;
    });
  }, [paiements, recherche, filtreStatut, filtrePeriode]);

  const cumuls = useMemo(() => cumulsPaiements(visibles), [visibles]);
  const total = (valeur: number) => (cumuls.deviseUnique ? montant(valeur, cumuls.deviseUnique) : '—');
  const indiceDevise = cumuls.deviseUnique
    ? undefined
    : 'Devises multiples : total non additionnable';

  return (
    <NationalDashboardLayout>
      <div className="sn-page paiements">
        <PageHeader
          icon={Wallet}
          title="Paiements clients"
          subtitle="Suivi des règlements attendus, encaissés et en retard."
          breadcrumb={[{ label: 'Ventes' }, { label: 'Paiements' }]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger(true)} disabled={actualisation}>
                <RefreshCw className={actualisation ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/payments/create')}>
                <Plus aria-hidden="true" /> Enregistrer un paiement
              </button>
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          sober
          ariaLabel="Cumuls des paiements"
          items={[
            {
              label: 'Total attendu',
              value: total(cumuls.total),
              hint: indiceDevise || `${cumuls.nombre} règlement${cumuls.nombre > 1 ? 's' : ''}`,
              icon: Wallet,
              tone: 'neutral',
            },
            {
              label: 'Encaissé',
              value: total(cumuls.paye),
              hint: `${cumuls.nombrePaye} réglé${cumuls.nombrePaye > 1 ? 's' : ''}`,
              icon: CheckCircle2,
              tone: 'green',
            },
            {
              label: 'En attente',
              value: total(cumuls.enAttente),
              hint: `${cumuls.nombreEnAttente} en cours`,
              icon: Clock,
              tone: 'gold',
            },
            {
              label: 'En retard',
              value: cumuls.nombreEnRetard,
              hint: cumuls.nombreEnRetard > 0 ? 'Relance à engager' : 'Aucun retard constaté',
              icon: AlertTriangle,
              tone: cumuls.nombreEnRetard > 0 ? 'gold' : 'neutral',
            },
          ]}
        />

        <Section
          id="paiements"
          icon={CreditCard}
          title={`Règlements (${visibles.length})`}
          description="Chaque ligne renvoie au détail du paiement et à sa facture."
        >
          <div className="paiements__filtres">
            <SearchInput
              value={recherche}
              onChange={setRecherche}
              placeholder="Facture, vente ou client…"
              ariaLabel="Rechercher un paiement"
            />
            <SelectControl value={filtreStatut} onChange={setFiltreStatut} ariaLabel="Filtrer par statut">
              <option value="tous">Tous les statuts</option>
              <option value="paye">Payés</option>
              <option value="en_attente">En attente</option>
              <option value="en_retard">En retard</option>
              <option value="rejete">Rejetés</option>
            </SelectControl>
            <SelectControl value={filtrePeriode} onChange={setFiltrePeriode} ariaLabel="Filtrer par période">
              <option value="toutes">Toutes les périodes</option>
              <option value="semaine">7 derniers jours</option>
              <option value="mois">30 derniers jours</option>
              <option value="trimestre">90 derniers jours</option>
            </SelectControl>
          </div>

          {chargement ? (
            <p className="paiements__chargement">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des paiements…
            </p>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucun paiement"
              description={
                paiements.length === 0
                  ? 'Aucun règlement n’est enregistré.'
                  : 'Aucun règlement ne correspond à ces critères.'
              }
              action={
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => navigate('/payments/create')}
                >
                  Enregistrer un paiement
                </button>
              }
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th>Vente</th>
                    <th>Facture</th>
                    <th>Client</th>
                    <th className="sn-table__num">Montant</th>
                    <th>Échéance</th>
                    <th>Délai</th>
                    <th>Mode</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((paiement) => {
                    const jours = joursAvantEcheance(paiement.due_date);
                    return (
                      <tr
                        key={paiement.id}
                        className="is-clickable"
                        onClick={() => navigate(`/payments/${paiement.id}`)}
                      >
                        <td>{paiement.sale_number}</td>
                        <td>
                          <strong>{paiement.invoice_number}</strong>
                        </td>
                        <td>{paiement.client}</td>
                        <td className="sn-table__num">{montant(paiement.amount, paiement.currency)}</td>
                        <td>
                          <span className="paiements__date">
                            <CalendarDays aria-hidden="true" /> {formatDate(paiement.due_date)}
                          </span>
                        </td>
                        <td className={jours !== null && jours < 0 ? 'paiements__retard' : undefined}>
                          {libelleEcheance(jours)}
                        </td>
                        <td>{paiement.payment_method}</td>
                        <td>
                          <Badge tone={TONS_CATEGORIE[paiement.categorie]}>
                            {LIBELLES_CATEGORIE[paiement.categorie]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
