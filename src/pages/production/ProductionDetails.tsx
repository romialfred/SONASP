import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Calendar,
  FileText,
  History,
  Package,
  Pencil,
  Plus,
  Scale,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { Loading } from '@/components/ui/Loading';
import { Tabs } from '@/components/ui/Tabs';
import { dailyProductionService, type DailyProduction } from '@/services/dailyProductionService';
import type { StatusHistoryEntry } from '@/services/productionStatusService';
import { productionDocumentService } from '@/services/productionDocumentService';
import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';
import { ProductionStatusWorkflow } from '@/components/production/ProductionStatusWorkflow';
import { ProductionStatusWorkflowEnhanced } from '@/components/production/ProductionStatusWorkflowEnhanced';
import { ProductionDocumentsList, type ProductionDocument } from '@/components/production/ProductionDocumentsList';
import { ProductionDocumentUpload } from '@/components/production/ProductionDocumentUpload';
import { ProductionStatusHistory } from '@/components/production/ProductionStatusHistory';
import type { ProductionStatus } from '@/constants/productionStatuses';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { chargerHistorique, composerBarre } from './productionDetailsData';
import './production.css';

/**
 * Fiche d'une déclaration de production.
 *
 * L'écran affichait, faute de données, le nom d'une mine guinéenne et une
 * référence de barre inventée — vestiges d'un autre projet. Une plateforme de
 * traçabilité ne comble pas un manque : elle le montre.
 */

interface Compagnie {
  id: string;
  name: string;
  country: string | null;
}

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quatre = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const GRAMMES_PAR_ONCE = 31.1034768;

export const grammes = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${decimal.format(valeur)} g`;
export const onces = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${quatre.format(valeur)} oz`;
export const pourcent = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${decimal.format(valeur)} %`;

export const formatDateLongue = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export function ProductionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { alertState, showError, closeAlert } = useCustomAlert();

  const [production, setProduction] = useState<DailyProduction | null>(null);
  const [compagnie, setCompagnie] = useState<Compagnie | null>(null);
  const [historique, setHistorique] = useState<StatusHistoryEntry[]>([]);
  const [documents, setDocuments] = useState<ProductionDocument[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [televersementOuvert, setTeleversementOuvert] = useState(false);
  const [onglet, setOnglet] = useState('details');

  const charger = useCallback(
    async (attendreDeclencheur = false) => {
      if (!id) {
        setErreur('L’identifiant de la déclaration est manquant.');
        setChargement(false);
        return;
      }

      setChargement(true);
      setErreur(null);
      try {
        // Le changement de statut passe par un déclencheur : sans ce délai, la
        // fiche se rechargerait avant que la base ne soit à jour.
        if (attendreDeclencheur) await new Promise((resoudre) => setTimeout(resoudre, 500));

        const donnees = await dailyProductionService.getProductionById(id);
        if (!donnees) {
          setErreur('La déclaration demandée n’existe pas ou a été supprimée.');
          setProduction(null);
          return;
        }
        if (!donnees.status) donnees.status = 'prepared';
        setProduction(donnees);

        // Chaque source annexe s'affiche ou se tait pour son propre compte :
        // un historique illisible ne doit pas emporter la fiche.
        const [historiqueRes, documentsRes, compagnieRes] = await Promise.allSettled([
          chargerHistorique(id),
          productionDocumentService.listDocuments(id),
          donnees.mining_company_id
            ? supabase
                .from('mining_companies')
                .select('id, name, country')
                .eq('id', donnees.mining_company_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        setHistorique(historiqueRes.status === 'fulfilled' ? historiqueRes.value : []);
        setDocuments(documentsRes.status === 'fulfilled' ? documentsRes.value : []);
        setCompagnie(
          compagnieRes.status === 'fulfilled' ? ((compagnieRes.value as any)?.data as Compagnie) || null : null
        );
      } catch (raison) {
        setErreur(errorMessage(raison, 'Impossible de charger la déclaration.'));
      } finally {
        setChargement(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void charger();
  }, [charger]);

  const televerser = async (fichier: File, nom: string) => {
    if (!id) return;
    try {
      await productionDocumentService.uploadDocument(id, fichier, nom);
      setDocuments(await productionDocumentService.listDocuments(id));
      setTeleversementOuvert(false);
    } catch (raison) {
      showError(errorMessage(raison, 'Impossible de téléverser le document.'));
      throw raison;
    }
  };

  const ouvrirDocument = async (document: ProductionDocument) => {
    try {
      const url = await productionDocumentService.getDocumentUrl(document.file_path);
      window.open(url, '_blank');
    } catch (raison) {
      showError(errorMessage(raison, 'Impossible d’ouvrir le document.'));
    }
  };

  const telechargerDocument = async (document: ProductionDocument) => {
    try {
      await productionDocumentService.downloadDocument(document);
    } catch (raison) {
      showError(errorMessage(raison, 'Impossible de télécharger le document.'));
    }
  };

  const supprimerDocument = async (documentId: string) => {
    if (!id) return;
    try {
      await productionDocumentService.deleteDocument(documentId);
      setDocuments(await productionDocumentService.listDocuments(id));
    } catch (raison) {
      showError(errorMessage(raison, 'Impossible de supprimer le document.'));
    }
  };

  if (chargement) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page production-page">
          <Loading />
        </div>
      </NationalDashboardLayout>
    );
  }

  if (erreur || !production) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page production-page">
          <PageHeader
            icon={Package}
            title="Déclaration de production"
            breadcrumb={[{ label: 'Mines industrielles' }, { label: 'Production journalière' }]}
            actions={
              <button type="button" className="sn-btn" onClick={() => navigate('/production/daily')}>
                <ArrowLeft aria-hidden="true" /> Retour aux déclarations
              </button>
            }
          />
          <Note tone="danger" icon={AlertTriangle}>
            {erreur || 'Déclaration introuvable.'}
          </Note>
        </div>
      </NationalDashboardLayout>
    );
  }

  const composition = composerBarre(
    production.bullion_grams,
    production.estimated_fineness_pct,
    production.estimated_silver_pct
  );
  const doreOnces = production.bullion_grams / GRAMMES_PAR_ONCE;

  return (
    <NationalDashboardLayout>
      <div className="sn-page production-page">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={Package}
          title={production.bar_reference || 'Barre sans référence'}
          subtitle={`Déclarée le ${formatDateLongue(production.production_date)}`}
          breadcrumb={[
            { label: 'Mines industrielles' },
            { label: 'Production journalière' },
            { label: production.bar_reference || 'Déclaration' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/production/daily')}>
                <ArrowLeft aria-hidden="true" /> Retour
              </button>
              {/* Le bouton menait vers `/production/daily-production`, route
                  inexistante : la modification n'aboutissait jamais. */}
              <button
                type="button"
                className="sn-btn sn-btn--primary"
                onClick={() => navigate('/production/daily', { state: { productionId: production.id } })}
              >
                <Pencil aria-hidden="true" /> Modifier
              </button>
            </>
          }
          aside={<ProductionStatusBadge status={production.status as ProductionStatus} size="sm" showIcon />}
        />

        <StatGrid
          sober
          ariaLabel="Composition de la barre"
          items={[
            { label: 'Doré', value: grammes(production.bullion_grams), hint: onces(doreOnces), icon: Scale, tone: 'neutral' },
            {
              label: 'Or fin',
              value: grammes(production.pure_gold_grams),
              hint: onces(production.estimated_oz),
              icon: Package,
              tone: 'gold',
            },
            { label: 'Teneur en or', value: pourcent(production.estimated_fineness_pct), icon: Scale, tone: 'gold' },
            {
              label: 'Compagnie',
              value: compagnie?.name || '—',
              hint: compagnie?.country || 'Pays non renseigné',
              icon: Building,
              tone: 'neutral',
            },
          ]}
        />

        <ProductionStatusWorkflowEnhanced
          currentStatus={production.status as ProductionStatus}
          statusHistory={historique}
        />

        <Tabs
          tabs={[
            { id: 'details', label: 'Détail de la déclaration', icon: Package },
            { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
            { id: 'historique', label: 'Historique', icon: History, count: historique.length },
          ]}
          activeTab={onglet}
          onChange={setOnglet}
        >
          {(ongletActif) => (
            <>
              {ongletActif === 'details' && (
                <>
                  <Section
                    id="identification"
                    icon={Calendar}
                    title="Identification"
                   
                  >
                    <dl className="production-page__fiche">
                      <div>
                        <dt>Date de production</dt>
                        <dd>{formatDateLongue(production.production_date)}</dd>
                      </div>
                      <div>
                        <dt>Compagnie minière</dt>
                        <dd>{compagnie?.name || '—'}</dd>
                      </div>
                      <div>
                        <dt>Pays du site</dt>
                        <dd>{compagnie?.country || '—'}</dd>
                      </div>
                      <div>
                        <dt>Référence de barre</dt>
                        <dd>{production.bar_reference || '—'}</dd>
                      </div>
                    </dl>
                  </Section>

                  <Section
                    id="composition"
                    icon={Scale}
                    title="Poids et composition"
                    description="Les impuretés sont le complément à 100 % de la teneur déclarée."
                  >
                    <div className="production-page__composition">
                      <article>
                        <header>
                          <h4>Doré</h4>
                          <Badge tone="neutral">100 %</Badge>
                        </header>
                        <p className="production-page__composition-poids">{grammes(production.bullion_grams)}</p>
                        <p className="production-page__composition-note">{onces(doreOnces)}</p>
                      </article>

                      <article className="est-or">
                        <header>
                          <h4>Or</h4>
                          <Badge tone="success">{pourcent(composition.orPct)}</Badge>
                        </header>
                        <p className="production-page__composition-poids">{grammes(production.pure_gold_grams)}</p>
                        <p className="production-page__composition-note">
                          {onces(production.estimated_oz)} · {entier.format(production.bullion_grams)} g ×{' '}
                          {decimal.format(composition.orPct)} %
                        </p>
                      </article>

                      {composition.argentPct > 0 && (
                        <article>
                          <header>
                            <h4>Argent</h4>
                            <Badge tone="neutral">{pourcent(composition.argentPct)}</Badge>
                          </header>
                          <p className="production-page__composition-poids">{grammes(composition.argentGrammes)}</p>
                          <p className="production-page__composition-note">
                            {onces(composition.argentGrammes / GRAMMES_PAR_ONCE)}
                          </p>
                        </article>
                      )}

                      {composition.impuretesPct > 0 && (
                        <article>
                          <header>
                            <h4>Impuretés</h4>
                            <Badge tone="warning">{pourcent(composition.impuretesPct)}</Badge>
                          </header>
                          <p className="production-page__composition-poids">{grammes(composition.impuretesGrammes)}</p>
                          <p className="production-page__composition-note">
                            100 % − {decimal.format(composition.orPct)} % − {decimal.format(composition.argentPct)} %
                          </p>
                        </article>
                      )}
                    </div>

                    {production.notes && (
                      <div className="production-page__notes">
                        <h4>Observations</h4>
                        <p>{production.notes}</p>
                      </div>
                    )}
                  </Section>

                  <ProductionStatusWorkflow
                    productionId={production.id}
                    currentStatus={production.status as ProductionStatus}
                    production={{
                      id: production.id,
                      bar_reference: production.bar_reference,
                      production_date: production.production_date,
                      bullion_grams: production.bullion_grams,
                      estimated_fineness_pct: production.estimated_fineness_pct,
                      pure_gold_grams: production.pure_gold_grams,
                      estimated_oz: production.estimated_oz,
                      estimated_silver_pct: production.estimated_silver_pct,
                      mining_company_name: compagnie?.name,
                      // Le pays venait d'une constante figée à « Guinée ».
                      site_country: compagnie?.country || undefined,
                    }}
                    userEmail={user?.email}
                    onStatusChanged={() => void charger(true)}
                    compactButton
                  />
                </>
              )}

              {ongletActif === 'documents' && (
                <Section
                  id="documents"
                  icon={FileText}
                  title="Documents joints"
                  description="Pièces rattachées à cette déclaration."
                >
                  <div className="production-page__actions">
                    <button
                      type="button"
                      className="sn-btn sn-btn--primary"
                      onClick={() => setTeleversementOuvert(true)}
                    >
                      <Plus aria-hidden="true" /> Ajouter un document
                    </button>
                  </div>

                  <ProductionDocumentsList
                    documents={documents}
                    onView={ouvrirDocument}
                    onDownload={telechargerDocument}
                    onDelete={supprimerDocument}
                    canDelete
                  />
                </Section>
              )}

              {ongletActif === 'historique' && (
                <Section
                  id="historique"
                  icon={History}
                  title="Historique des changements"
                  description="Chaque changement de statut, son auteur et sa date."
                >
                  {historique.length === 0 ? (
                    <EmptyState
                      title="Aucun changement enregistré"
                      description="Cette déclaration n’a pas changé de statut depuis sa création."
                    />
                  ) : (
                    <ProductionStatusHistory history={historique} siteCountry={compagnie?.country || undefined} />
                  )}
                </Section>
              )}
            </>
          )}
        </Tabs>
      </div>

      <ProductionDocumentUpload
        isOpen={televersementOuvert}
        onClose={() => setTeleversementOuvert(false)}
        onUpload={televerser}
      />
    </NationalDashboardLayout>
  );
}
