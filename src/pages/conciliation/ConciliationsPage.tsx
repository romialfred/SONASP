import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale, Plus, AlertTriangle, FileText, Clock, CheckCircle2, Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  PageHeader, Section, DataTable, Badge, Note, StatGrid, EmptyState,
  SelectControl, SearchInput, type Column, type BadgeTone,
} from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { hasCapability, CAPABILITIES } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import {
  conciliationService, LIBELLES_STATUTS_CONCILIATION,
  type Conciliation, type StatutConciliation, type VenteConciliable,
} from '@/services/conciliationService';

const TONE_STATUT: Record<StatutConciliation, BadgeTone> = {
  en_attente_analyse: 'warning',
  analyse_recue: 'info',
  calculee: 'info',
  ecart_a_verifier: 'warning',
  en_attente_validation: 'warning',
  contestee: 'danger',
  validee: 'success',
  facture_definitive_generee: 'success',
  cloturee: 'neutral',
  annulee: 'neutral',
};

function montant(valeur: number | null, devise = 'USD'): string {
  if (valeur === null) return '-';
  return `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;
}

function joursDepuis(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function ConciliationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState<Conciliation[]>([]);
  const [ventes, setVentes] = useState<VenteConciliable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<string>('tous');
  const [recherche, setRecherche] = useState('');
  const [venteChoisie, setVenteChoisie] = useState('');
  const [ouverture, setOuverture] = useState(false);

  const peutOuvrir = hasCapability(user, CAPABILITIES.RECONCILIATION_CREATE);

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      const [liste, conciliables] = await Promise.all([
        conciliationService.lister(),
        peutOuvrir ? conciliationService.ventesConciliables() : Promise.resolve([]),
      ]);
      setDossiers(liste);
      setVentes(conciliables);
    } catch (error) {
      setErreur(errorMessage(error, 'Les dossiers de conciliation n’ont pas pu être chargés.'));
      setDossiers([]);
    } finally {
      setChargement(false);
    }
  }, [peutOuvrir]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const indicateurs = useMemo(() => {
    const enCours = dossiers.filter((d) => !['validee', 'cloturee', 'annulee', 'facture_definitive_generee'].includes(d.statut));
    const attenteAnalyse = dossiers.filter((d) => d.statut === 'en_attente_analyse');
    const validees = dossiers.filter((d) => ['validee', 'facture_definitive_generee', 'cloturee'].includes(d.statut));
    const ecartCumule = validees.reduce(
      (somme, d) => somme + ((d.ca_final ?? 0) - (d.ca_initial ?? 0)), 0,
    );

    return [
      { label: 'Dossiers ouverts', value: String(enCours.length), icon: FileText },
      { label: "En attente d'analyse", value: String(attenteAnalyse.length), icon: Clock, tone: 'gold' as const },
      { label: 'Validés', value: String(validees.length), icon: CheckCircle2, tone: 'green' as const },
      {
        label: 'Écart cumulé',
        value: montant(Math.round(ecartCumule * 100) / 100),
        hint: ecartCumule < 0 ? 'en faveur des acheteurs' : 'en faveur des vendeurs',
        icon: Wallet,
        tone: (ecartCumule < 0 ? 'red' : 'green') as const,
      },
    ];
  }, [dossiers]);

  const dossiersFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (filtreStatut !== 'tous' && d.statut !== filtreStatut) return false;
      if (!terme) return true;
      return d.reference.toLowerCase().includes(terme);
    });
  }, [dossiers, filtreStatut, recherche]);

  const ouvrirDossier = async () => {
    if (!venteChoisie) {
      setErreur('Choisissez la vente à concilier.');
      return;
    }
    try {
      setOuverture(true);
      setErreur(null);
      const dossier = await conciliationService.ouvrir(venteChoisie);
      setMessage(`Dossier ${dossier.reference} ouvert. Enregistrez le résultat de l’acheteur pour poursuivre.`);
      setVenteChoisie('');
      await charger();
      navigate(`/conciliation/${dossier.id}`);
    } catch (error) {
      setErreur(errorMessage(error, 'Le dossier n’a pas pu être ouvert.'));
    } finally {
      setOuverture(false);
    }
  };

  const colonnes: Column<Conciliation>[] = [
    {
      key: 'reference',
      header: 'Référence',
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600 }}>{d.reference}</div>
          <div className="sn-muted" style={{ fontSize: 12 }}>
            ouvert il y a {joursDepuis(d.created_at)} j
          </div>
        </div>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (d) => <Badge tone={TONE_STATUT[d.statut]}>{LIBELLES_STATUTS_CONCILIATION[d.statut]}</Badge>,
    },
    {
      key: 'ca_initial',
      header: 'Valeur déclarée',
      numeric: true,
      render: (d) => montant(d.ca_initial, d.devise_initiale ?? 'USD'),
    },
    {
      key: 'ca_final',
      header: 'Valeur définitive',
      numeric: true,
      render: (d) => montant(d.ca_final, d.devise_finale ?? d.devise_initiale ?? 'USD'),
    },
    {
      key: 'ecart',
      header: 'Écart',
      numeric: true,
      render: (d) => {
        if (d.ca_final === null || d.ca_initial === null) return <span className="sn-muted">-</span>;
        const ecart = Math.round((d.ca_final - d.ca_initial) * 100) / 100;
        if (ecart === 0) return '0,00';
        return (
          <span style={{ color: ecart < 0 ? 'var(--sn-danger, #b3261e)' : 'var(--sn-success, #0f7a56)', fontWeight: 600 }}>
            {ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'analyse',
      header: 'Analyse',
      render: (d) => d.source_analyse_type
        ? <Badge tone="success">reçue</Badge>
        : <Badge tone="warning">attendue</Badge>,
    },
  ];

  return (
    <NationalDashboardLayout>
      <PageHeader
        title="Conciliation des ventes"
        subtitle="Rapprochement entre ce qui a été déclaré à l’expédition et ce que l’acheteur reconnaît après analyse."
        icon={Scale}
        breadcrumb={[{ label: 'Conciliation' }]}
      />

      <StatGrid items={indicateurs} ariaLabel="État des conciliations" sober />

      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
      {message && <Note tone="success">{message}</Note>}

      {peutOuvrir && (
        <Section
          id="ouvrir"
          icon={Plus}
          title="Ouvrir un dossier"
          description="Les valeurs déclarées sont reprises de la vente : rien de ce qui est déjà connu n’est ressaisi."
        >
          {ventes.length === 0 ? (
            <Note tone="info">
              Aucune vente disponible : toutes portent déjà un dossier, ou aucune n’est enregistrée.
            </Note>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 320, flex: 1 }}>
                <SelectControl
                  value={venteChoisie}
                  onChange={setVenteChoisie}
                  ariaLabel="Vente à concilier"
                >
                  <option value="">Choisir une vente…</option>
                  {ventes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sale_number} — {new Date(v.sale_date).toLocaleDateString('fr-FR')} — {montant(v.gross_proceeds)}
                    </option>
                  ))}
                </SelectControl>
              </div>
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => void ouvrirDossier()}
                disabled={ouverture || !venteChoisie}
              >
                {ouverture ? 'Ouverture…' : 'Ouvrir le dossier'}
              </button>
            </div>
          )}
        </Section>
      )}

      <Section
        id="file"
        icon={FileText}
        title="Dossiers"
        description="Une vente ne peut porter qu’un seul dossier vivant."
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <SearchInput value={recherche} onChange={setRecherche} placeholder="Rechercher une référence…" />
          <SelectControl value={filtreStatut} onChange={setFiltreStatut} ariaLabel="Filtrer par statut">
            <option value="tous">Tous les statuts</option>
            {(Object.keys(LIBELLES_STATUTS_CONCILIATION) as StatutConciliation[]).map((s) => (
              <option key={s} value={s}>{LIBELLES_STATUTS_CONCILIATION[s]}</option>
            ))}
          </SelectControl>
        </div>

        {!chargement && dossiersFiltres.length === 0 ? (
          <EmptyState
            title={dossiers.length === 0 ? 'Aucun dossier de conciliation' : 'Aucun dossier pour ce filtre'}
            description={dossiers.length === 0
              ? 'Ouvrez un dossier depuis une vente pour rapprocher sa valeur déclarée de celle reconnue par l’acheteur.'
              : 'Modifiez le statut ou la recherche pour élargir la liste.'}
          />
        ) : (
          <DataTable
            columns={colonnes}
            rows={dossiersFiltres}
            loading={chargement}
            caption="Dossiers de conciliation"
            onRowClick={(d) => navigate(`/conciliation/${d.id}`)}
            empty="Aucun dossier"
          />
        )}
      </Section>
    </NationalDashboardLayout>
  );
}

export default ConciliationsPage;
