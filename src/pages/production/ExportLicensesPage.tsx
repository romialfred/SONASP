import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Loader2,
  Plus,
  Scale,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, Segmented, StatGrid } from '@/components/ui/sn';
import { exportLicenseService, type ExportLicense } from '@/services/exportLicenseService';
import { errorMessage } from '@/lib/errorMessage';
import './export-licenses.css';

const GRAMMES_PAR_ONCE = 31.1034768;
const TRENTE_JOURS = 30 * 24 * 60 * 60 * 1000;

export type FiltreLicence = 'toutes' | 'actives' | 'expirees' | 'epuisees';

export type EtatLicence = 'epuisee' | 'expiree' | 'tension' | 'active' | 'autre';

export const kilos = (grammes: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    (grammes || 0) / 1000
  );

export const onces = (grammes: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    (grammes || 0) / GRAMMES_PAR_ONCE
  );

/** Part consommée de la licence ; `null` quand aucun volume n'est autorisé. */
export function tauxUtilisation(licence: ExportLicense): number | null {
  const autorise = Number(licence.authorized_quantity_grams || 0);
  if (autorise <= 0) return null;
  return (Number(licence.used_quantity_grams || 0) / autorise) * 100;
}

export const estExpiree = (licence: ExportLicense, maintenant = new Date()) =>
  new Date(licence.end_date) < maintenant;

/**
 * État réel de la licence, dans l'ordre où il prime.
 * L'écran affichait cinq badges de couleurs différentes, dont un clignotant :
 * l'état se lit désormais sur un libellé, pas sur une animation.
 */
export function etatLicence(licence: ExportLicense, maintenant = new Date()): EtatLicence {
  if (licence.status === 'exhausted') return 'epuisee';
  if (estExpiree(licence, maintenant)) return 'expiree';
  const taux = tauxUtilisation(licence);
  if (taux !== null && taux >= 90) return 'tension';
  if (licence.status === 'active') return 'active';
  return 'autre';
}

const LIBELLES_ETAT: Record<EtatLicence, { texte: string; ton: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  epuisee: { texte: 'Épuisée', ton: 'danger' },
  expiree: { texte: 'Expirée', ton: 'neutral' },
  tension: { texte: 'Presque épuisée', ton: 'warning' },
  active: { texte: 'Active', ton: 'success' },
  autre: { texte: 'Statut à préciser', ton: 'neutral' },
};

const ICONES_ETAT = {
  epuisee: XCircle,
  expiree: Clock,
  tension: AlertTriangle,
  active: CheckCircle2,
  autre: FileText,
} as const;

export function filtrerLicences(
  licences: ExportLicense[],
  filtre: FiltreLicence,
  maintenant = new Date()
): ExportLicense[] {
  if (filtre === 'actives') {
    return licences.filter((licence) => licence.status === 'active' && !estExpiree(licence, maintenant));
  }
  if (filtre === 'expirees') return licences.filter((licence) => estExpiree(licence, maintenant));
  if (filtre === 'epuisees') return licences.filter((licence) => licence.status === 'exhausted');
  return licences;
}

/** Cumuls affichés en tête, calculés sur les seules licences en cours de validité. */
export function cumulsLicences(licences: ExportLicense[], maintenant = new Date()) {
  const actives = filtrerLicences(licences, 'actives', maintenant);
  return {
    actives: actives.length,
    autorise: actives.reduce((somme, licence) => somme + Number(licence.authorized_quantity_grams || 0), 0),
    utilise: actives.reduce((somme, licence) => somme + Number(licence.used_quantity_grams || 0), 0),
    disponible: actives.reduce((somme, licence) => somme + Number(licence.remaining_quantity_grams || 0), 0),
  };
}

const periode = (licence: ExportLicense) => {
  const format = (valeur: string, avecAnnee: boolean) =>
    new Date(valeur).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      ...(avecAnnee ? { year: 'numeric' } : {}),
    });
  return `${format(licence.start_date, false)} – ${format(licence.end_date, true)}`;
};

export function ExportLicensesPage() {
  const navigate = useNavigate();
  const [licences, setLicences] = useState<ExportLicense[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<FiltreLicence>('toutes');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setLicences(await exportLicenseService.getAllLicenses());
    } catch (raison) {
      // L'échec n'était consigné qu'au journal : l'écran restait vide sans un mot.
      setErreur(errorMessage(raison, 'Impossible de charger les licences d’exportation.'));
      setLicences([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const cumuls = useMemo(() => cumulsLicences(licences), [licences]);
  const visibles = useMemo(() => filtrerLicences(licences, filtre), [licences, filtre]);

  const compte = (valeur: FiltreLicence) => filtrerLicences(licences, valeur).length;

  return (
    <NationalDashboardLayout>
      <div className="sn-page licences">
        <PageHeader
          icon={FileText}
          title="Licences d’exportation"
          subtitle="Volumes autorisés, consommés et restants par compagnie minière."
          breadcrumb={[{ label: 'Production' }, { label: 'Licences d’exportation' }]}
          actions={
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={() => navigate('/production/licenses/new')}
            >
              <Plus aria-hidden="true" /> Nouvelle licence
            </button>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          sober
          ariaLabel="Cumuls des licences en cours"
          items={[
            { label: 'Licences en cours', value: cumuls.actives, icon: FileText, tone: 'neutral' },
            {
              label: 'Volume autorisé',
              value: `${kilos(cumuls.autorise)} kg`,
              hint: `${onces(cumuls.autorise)} oz`,
              icon: Scale,
              tone: 'green',
            },
            {
              label: 'Volume consommé',
              value: `${kilos(cumuls.utilise)} kg`,
              hint: `${onces(cumuls.utilise)} oz`,
              icon: Gauge,
              tone: 'gold',
            },
            {
              label: 'Reste à exporter',
              value: `${kilos(cumuls.disponible)} kg`,
              hint: `${onces(cumuls.disponible)} oz`,
              icon: CheckCircle2,
              tone: 'green',
            },
          ]}
        />

        <Section
          id="licences"
          icon={FileText}
          title={`Licences (${visibles.length})`}
          description="Chaque fiche donne le volume autorisé, ce qui reste et l’échéance."
        >
          <div className="licences__filtres">
            <Segmented
              name="filtre-licences"
              ariaLabel="Filtrer les licences"
              value={filtre}
              onChange={setFiltre}
              options={[
                { value: 'toutes', label: `Toutes (${licences.length})` },
                { value: 'actives', label: `En cours (${compte('actives')})` },
                { value: 'expirees', label: `Expirées (${compte('expirees')})` },
                { value: 'epuisees', label: `Épuisées (${compte('epuisees')})` },
              ]}
            />
          </div>

          {chargement ? (
            <p className="licences__chargement">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des licences…
            </p>
          ) : visibles.length === 0 ? (
            <EmptyState
              title="Aucune licence"
              description={
                licences.length === 0
                  ? 'Aucune licence d’exportation n’est enregistrée.'
                  : 'Aucune licence ne correspond à ce filtre.'
              }
              action={
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => navigate('/production/licenses/new')}
                >
                  Nouvelle licence
                </button>
              }
            />
          ) : (
            <ul className="licences__liste">
              {visibles.map((licence) => {
                const etat = etatLicence(licence);
                const taux = tauxUtilisation(licence);
                const IconeEtat = ICONES_ETAT[etat];
                const finProche =
                  etat === 'active' && new Date(licence.end_date).getTime() - Date.now() < TRENTE_JOURS;

                return (
                  <li key={licence.id}>
                    <article
                      className="licence"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/production/licenses/${licence.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/production/licenses/${licence.id}`);
                        }
                      }}
                    >
                      <header className="licence__tete">
                        <div>
                          <h4>{licence.license_number}</h4>
                          <p>
                            {licence.mining_company?.name || 'Compagnie non renseignée'}
                            {licence.mining_company?.code && <code>{licence.mining_company.code}</code>}
                          </p>
                        </div>
                        <div className="licence__etats">
                          <Badge tone={LIBELLES_ETAT[etat].ton} icon={IconeEtat}>
                            {LIBELLES_ETAT[etat].texte}
                          </Badge>
                          {finProche && (
                            <Badge tone="warning" icon={Clock}>
                              Échéance sous 30 jours
                            </Badge>
                          )}
                        </div>
                      </header>

                      <dl className="licence__faits">
                        <div>
                          <dt>Institution</dt>
                          <dd>{licence.issuing_institution || '—'}</dd>
                        </div>
                        <div>
                          <dt>Période</dt>
                          <dd>{periode(licence)}</dd>
                        </div>
                        <div>
                          <dt>Autorisée</dt>
                          <dd className="licence__valeur">
                            {kilos(licence.authorized_quantity_grams)} kg
                            <small>{onces(licence.authorized_quantity_grams)} oz</small>
                          </dd>
                        </div>
                        <div>
                          <dt>Reste</dt>
                          <dd className="licence__valeur">
                            {kilos(licence.remaining_quantity_grams)} kg
                            <small>{onces(licence.remaining_quantity_grams)} oz</small>
                          </dd>
                        </div>
                      </dl>

                      <footer className="licence__utilisation">
                        <div className="licence__utilisation-tete">
                          <span>Utilisation</span>
                          {/* Aucun taux n'est inventé : sans volume autorisé, il n'y a rien à calculer. */}
                          <strong>{taux === null ? '—' : `${Math.round(taux)} %`}</strong>
                        </div>
                        <div
                          className="licence__jauge"
                          role="progressbar"
                          aria-valuenow={taux === null ? undefined : Math.round(taux)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Utilisation de la licence ${licence.license_number}`}
                        >
                          <span
                            className={taux !== null && taux >= 90 ? 'is-tendu' : ''}
                            style={{ width: `${Math.min(taux || 0, 100)}%` }}
                          />
                        </div>
                        <p>
                          <span>{kilos(licence.used_quantity_grams)} kg consommés</span>
                          <span>{kilos(licence.remaining_quantity_grams)} kg restants</span>
                        </p>
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
