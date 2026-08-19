import { useMemo, useState } from 'react';
import { ArrowRight, Banknote, CircleDot, Flag, Info, Layers, Search, Workflow } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import {
  ALLOWED_TRANSITIONS,
  WorkflowModule,
  getModuleForStatus,
} from '@/services/statusTransitionControlService';
import { SALES_STATUSES, STATUS_LABELS, type SalesStatus } from '@/constants/salesStatuses';
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_DESCRIPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TRANSITIONS,
  type PaymentStatus,
} from '@/constants/paymentStatuses';
import { formatStatusFr } from '@/utils/statusFormatter';
import './admin.css';

export const MODULE_LABELS: Record<WorkflowModule, string> = {
  [WorkflowModule.PRODUCTION]: 'Production',
  [WorkflowModule.SHIPPING_PREPARATION]: 'Préparation d’expédition',
  [WorkflowModule.FREIGHT_CUSTOMS]: 'Fret et douane',
  [WorkflowModule.REFINERY]: 'Raffinerie',
  [WorkflowModule.INVENTORY]: 'Stock',
  [WorkflowModule.SALE]: 'Vente',
};

export interface EtapeWorkflow {
  statut: string;
  libelle: string;
  module: string;
  transitions: string[];
  estFinal: boolean;
}

/**
 * Étapes du circuit de traçabilité, lues dans la table de transitions du service de
 * contrôle. L'écran reconstituait auparavant une carte de transitions approximative,
 * codée en dur module par module.
 */
export function etapesWorkflow(): EtapeWorkflow[] {
  return Object.entries(ALLOWED_TRANSITIONS).map(([statut, transitions]) => {
    const module = getModuleForStatus(statut);
    return {
      statut,
      libelle: formatStatusFr(statut),
      module: module ? MODULE_LABELS[module] : 'Transverse',
      transitions,
      estFinal: transitions.length === 0,
    };
  });
}

export function filtrerEtapes(etapes: EtapeWorkflow[], recherche: string): EtapeWorkflow[] {
  const terme = recherche.trim().toLowerCase();
  if (!terme) return etapes;
  return etapes.filter((etape) =>
    [etape.statut, etape.libelle, etape.module].some((valeur) => valeur.toLowerCase().includes(terme))
  );
}

export default function StatusManagerPage() {
  const [recherche, setRecherche] = useState('');

  const etapes = useMemo(() => etapesWorkflow(), []);
  const visibles = useMemo(() => filtrerEtapes(etapes, recherche), [etapes, recherche]);

  const statutsVente = Object.values(SALES_STATUSES) as SalesStatus[];
  const statutsPaiement = Object.values(PAYMENT_STATUSES) as PaymentStatus[];

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page statuts">
        <PageHeader
          icon={Workflow}
          title="Référentiel des statuts"
          subtitle="Circuit de traçabilité de l’or, module responsable de chaque étape et transitions autorisées."
          breadcrumb={[{ label: 'Administration' }, { label: 'Statuts' }]}
        />

        {/* L'écran proposait « Éditer » et « Voir les détails » : le premier n'écrivait
            rien et annonçait « une prochaine version », le second n'avait aucune action. */}
        <Note tone="info" icon={Info}>
          Ce référentiel est <strong>en lecture seule</strong> : les statuts et leurs
          transitions sont définis dans le code du circuit de traçabilité, et non en base.
          Toute évolution passe par une mise à jour applicative.
        </Note>

        <StatGrid
          ariaLabel="Portée du référentiel"
          items={[
            { label: 'Étapes du circuit', value: etapes.length, icon: Layers, tone: 'blue' },
            {
              label: 'États finaux',
              value: etapes.filter((etape) => etape.estFinal).length,
              hint: 'Aucune transition sortante',
              icon: Flag,
              tone: 'violet',
            },
            { label: 'Statuts de vente', value: statutsVente.length, icon: CircleDot, tone: 'green' },
            { label: 'Statuts de paiement', value: statutsPaiement.length, icon: Banknote, tone: 'gold' },
          ]}
        />

        <section className="sn-card admin-page__filtres" aria-label="Filtres du référentiel">
          <label className="sn-field admin-page__filtre-large">
            <span className="sn-field__label">Rechercher</span>
            <input
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Statut, libellé ou module…"
            />
          </label>
          <button type="button" className="sn-btn" onClick={() => setRecherche('')} disabled={!recherche}>
            <Search aria-hidden="true" /> Réinitialiser
          </button>
        </section>

        <Section
          id="circuit"
          icon={Workflow}
          tone="emerald"
          title={`Circuit de traçabilité (${visibles.length} étapes)`}
          description="Chaîne unique suivie par un lot, de la production au paiement."
        >
          {visibles.length === 0 ? (
            <EmptyState title="Aucune étape" description="Aucun statut ne correspond à cette recherche." />
          ) : (
            <div className="admin-page__table-wrap">
              <table className="admin-page__table">
                <caption className="sr-only">Étapes du circuit de traçabilité</caption>
                <thead>
                  <tr>
                    <th scope="col">Étape</th>
                    <th scope="col">Module responsable</th>
                    <th scope="col">Transitions autorisées</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((etape) => (
                    <tr key={etape.statut}>
                      <td>
                        <strong>{etape.libelle}</strong>
                        <small>{etape.statut}</small>
                      </td>
                      <td>
                        <Badge tone="info">{etape.module}</Badge>
                      </td>
                      <td>
                        {etape.estFinal ? (
                          <Badge tone="neutral" icon={Flag}>
                            État final
                          </Badge>
                        ) : (
                          <span className="statuts__transitions">
                            {etape.transitions.map((cible) => (
                              <span key={cible}>
                                <ArrowRight aria-hidden="true" /> {formatStatusFr(cible)}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          id="ventes"
          icon={CircleDot}
          tone="blue"
          title="Statuts de vente"
          description="États d’une vente au fil de son circuit d’approbation."
        >
          {/* Aucune carte de transitions n'est définie pour les ventes : l'écran en
              affichait une, vide, laissant croire qu'aucune transition n'existe. */}
          <Note tone="info" icon={Info}>
            Le circuit d’approbation des ventes est porté par le moteur de validation ; aucune
            carte de transitions n’est déclarée dans le référentiel des statuts.
          </Note>
          <ul className="statuts__liste">
            {statutsVente.map((statut) => (
              <li key={statut}>
                <strong>{STATUS_LABELS[statut]}</strong>
                <code>{statut}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="paiements"
          icon={Banknote}
          tone="amber"
          title="Statuts de paiement"
          description="États d’un règlement et suites possibles."
        >
          <div className="admin-page__table-wrap">
            <table className="admin-page__table">
              <caption className="sr-only">Statuts de paiement</caption>
              <thead>
                <tr>
                  <th scope="col">Statut</th>
                  <th scope="col">Signification</th>
                  <th scope="col">Transitions autorisées</th>
                </tr>
              </thead>
              <tbody>
                {statutsPaiement.map((statut) => {
                  const transitions = PAYMENT_STATUS_TRANSITIONS[statut] || [];
                  return (
                    <tr key={statut}>
                      <td>
                        <strong>{PAYMENT_STATUS_LABELS[statut]}</strong>
                        <small>{statut}</small>
                      </td>
                      <td>{PAYMENT_STATUS_DESCRIPTIONS[statut] || '—'}</td>
                      <td>
                        {transitions.length === 0 ? (
                          <Badge tone="neutral" icon={Flag}>
                            État final
                          </Badge>
                        ) : (
                          <span className="statuts__transitions">
                            {transitions.map((cible) => (
                              <span key={cible}>
                                <ArrowRight aria-hidden="true" /> {PAYMENT_STATUS_LABELS[cible as PaymentStatus] || cible}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
