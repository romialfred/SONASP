import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  Building2,
  Coins,
  Landmark,
  Loader2,
  Plane,
  Plus,
  RefreshCw,
  Truck,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  chargerStockNational,
  ozVersKg,
  STOCK_VIDE,
  type StockNational,
} from './inventoryOverviewData';
import './inventory-overview.css';

const onces = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entier = new Intl.NumberFormat('fr-FR');

export const formatOz = (valeur: number) => `${onces.format(valeur || 0)} oz`;
export const formatKg = (valeur: number) => `${onces.format(ozVersKg(valeur || 0))} kg`;

/** Libellés français des étapes d'expédition affichées dans le suivi. */
export const LIBELLES_TRANSIT: Record<string, string> = {
  shipped_to_refinery: 'Expédié à la raffinerie',
  received_at_refinery: 'Reçu à la raffinerie',
  processing: 'En cours de raffinage',
  processed: 'Raffinage terminé',
};

/** Part d'un poste dans le total national ; `null` quand il n'y a rien à rapporter. */
export function part(valeur: number, total: number): number | null {
  if (!(total > 0)) return null;
  return (valeur / total) * 100;
}

export function InventoryManagement() {
  const navigate = useNavigate();
  const [stock, setStock] = useState<StockNational>(STOCK_VIDE);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async (actualiser = false) => {
    if (actualiser) setActualisation(true);
    else setChargement(true);
    setErreur(null);
    try {
      setStock(await chargerStockNational());
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger le suivi des stocks.'));
      setStock(STOCK_VIDE);
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Or engagé hors des coffres : en route, en attente d'embarquement, ou vendu sans règlement. */
  const horsCoffre = stock.transitOz + stock.aeroportOz + stock.venduNonPayeOz;
  const socle = stock.totalOz + horsCoffre;

  const postes = useMemo(
    () => [
      {
        cle: 'disponible',
        libelle: 'Disponible à la vente',
        icone: Coins,
        valeur: stock.disponibleOz,
        detail: 'Non engagé, mobilisable immédiatement',
      },
      {
        cle: 'alloue',
        libelle: 'Alloué à des ventes',
        icone: Wallet,
        valeur: stock.allloueOz,
        detail: 'Réservé sur des ventes en cours',
      },
      {
        cle: 'transit',
        libelle: 'En transit',
        icone: Truck,
        valeur: stock.transitOz,
        detail: 'Expédié, pas encore réintégré au stock',
      },
      {
        cle: 'aeroport',
        libelle: 'À l’aéroport',
        icone: Plane,
        valeur: stock.aeroportOz,
        detail: 'Lots constitués, en attente d’embarquement',
      },
    ],
    [stock]
  );

  return (
    <NationalDashboardLayout>
      <div className="sn-page stocks">
        <PageHeader
          icon={Boxes}
          title="Suivi des stocks d’or"
          subtitle="Vue nationale et détaillée : coffres, mines, transit, aéroport et créances."
          breadcrumb={[{ label: 'Suivi des stocks' }, { label: 'Stock d’or' }]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger(true)} disabled={actualisation}>
                <RefreshCw className={actualisation ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/inventory/add')}>
                <Plus aria-hidden="true" /> Nouvelle entrée
              </button>
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        {stock.indisponibles.length > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            Vue partielle : {stock.indisponibles.join(', ')} n’ont pas pu être chargés. Les postes
            concernés restent à zéro plutôt que d’afficher une estimation.
          </Note>
        )}

        {chargement ? (
          <p className="stocks__chargement">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du suivi des stocks…
          </p>
        ) : (
          <div className="stocks__grille">
            <div className="stocks__principal">
              {/* --- Socle national --- */}
              <section className="stocks__socle" aria-label="Stock national">
                <header>
                  <span className="stocks__socle-icone" aria-hidden="true">
                    <Landmark />
                  </span>
                  <div>
                    <p>Or national sous suivi</p>
                    <strong>{formatOz(socle)}</strong>
                    <small>{formatKg(socle)} · coffres, transit, aéroport et créances</small>
                  </div>
                </header>

                <dl className="stocks__socle-detail">
                  <div>
                    <dt>En coffre</dt>
                    <dd>{formatOz(stock.totalOz)}</dd>
                  </div>
                  <div>
                    <dt>Hors coffre</dt>
                    <dd>{formatOz(horsCoffre)}</dd>
                  </div>
                  <div>
                    <dt>Déjà vendu</dt>
                    <dd>{formatOz(stock.venduOz)}</dd>
                  </div>
                </dl>
              </section>

              {/* --- Postes --- */}
              <section className="stocks__postes" aria-label="Répartition du stock">
                {postes.map((poste) => {
                  const Icone = poste.icone;
                  const pourcentage = part(poste.valeur, socle);
                  return (
                    <article key={poste.cle} className="stocks__poste">
                      <header>
                        <span aria-hidden="true">
                          <Icone />
                        </span>
                        <h3>{poste.libelle}</h3>
                      </header>
                      <strong>{formatOz(poste.valeur)}</strong>
                      <p>{formatKg(poste.valeur)}</p>
                      <div
                        className="stocks__jauge"
                        role="progressbar"
                        aria-valuenow={pourcentage === null ? undefined : Math.round(pourcentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Part de ${poste.libelle} dans l’or national`}
                      >
                        <span style={{ width: `${Math.min(pourcentage || 0, 100)}%` }} />
                      </div>
                      <small>
                        {/* Aucune part n'est calculée sur un socle vide. */}
                        {pourcentage === null ? '—' : `${entier.format(Math.round(pourcentage))} % du national`} ·{' '}
                        {poste.detail}
                      </small>
                    </article>
                  );
                })}
              </section>

              {/* --- Stock par mine --- */}
              <Section
                id="par-mine"
                icon={Building2}
                title={`Stock par société minière (${stock.parMine.length})`}
                description="Or raffiné détenu au nom de chaque société."
              >
                {stock.parMine.length === 0 ? (
                  <EmptyState
                    title="Aucun stock rattaché"
                    description="Aucune entrée de stock n’est enregistrée pour l’instant."
                  />
                ) : (
                  <div className="sn-table-wrap">
                    <table className="sn-table">
                      <thead>
                        <tr>
                          <th>Société minière</th>
                          <th className="sn-table__num">Total</th>
                          <th className="sn-table__num">Disponible</th>
                          <th className="sn-table__num">Alloué</th>
                          <th className="sn-table__num">Vendu</th>
                          <th className="sn-table__num">Part</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.parMine.map((mine) => {
                          const pourcentage = part(mine.totalOz, stock.totalOz);
                          return (
                            <tr key={mine.id}>
                              <td>
                                <strong>{mine.nom}</strong>
                                <small className="stocks__lignes">{entier.format(mine.lignes)} entrée(s)</small>
                              </td>
                              <td className="sn-table__num">{formatOz(mine.totalOz)}</td>
                              <td className="sn-table__num">{formatOz(mine.disponibleOz)}</td>
                              <td className="sn-table__num">{formatOz(mine.allloueOz)}</td>
                              <td className="sn-table__num">{formatOz(mine.venduOz)}</td>
                              <td className="sn-table__num">
                                {pourcentage === null ? '—' : `${entier.format(Math.round(pourcentage))} %`}
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

            {/* --- Volet de droite --- */}
            <aside className="stocks__volet" aria-label="Engagements et acheminements">
              <section className="stocks__carte stocks__creances">
                <h3>Vendu non réglé</h3>
                <p className="stocks__creances-valeur">{formatOz(stock.venduNonPayeOz)}</p>
                <p className="stocks__creances-montant">
                  {/* Un total n'a de sens qu'en devise unique. */}
                  {stock.venduNonPayeDevise
                    ? `${entier.format(Math.round(stock.venduNonPayeMontant))} ${stock.venduNonPayeDevise}`
                    : '— (devises multiples)'}
                </p>
                <p className="stocks__carte-note">
                  Or sorti du stock dont le règlement n’est pas encaissé. Une vente sans ligne de
                  paiement y est comptée.
                </p>
                <button type="button" className="sn-btn" onClick={() => navigate('/payments')}>
                  Voir les paiements
                </button>
              </section>

              <section className="stocks__carte">
                <h3>Acheminements en cours</h3>
                {stock.transit.length === 0 ? (
                  <p className="stocks__carte-note">Aucune expédition en cours.</p>
                ) : (
                  <ul className="stocks__transit">
                    {stock.transit.map((ligne) => (
                      <li key={ligne.reference}>
                        <div>
                          <strong>{ligne.reference}</strong>
                          <small>{ligne.destination}</small>
                        </div>
                        <div className="stocks__transit-droite">
                          <b>{formatOz(ligne.quantiteOz)}</b>
                          <Badge tone="neutral">{LIBELLES_TRANSIT[ligne.statut] || ligne.statut}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="sn-btn" onClick={() => navigate('/freight')}>
                  Suivi des expéditions
                </button>
              </section>

              <section className="stocks__carte">
                <h3>Aéroport</h3>
                <p className="stocks__creances-valeur">{formatOz(stock.aeroportOz)}</p>
                <p className="stocks__carte-note">
                  Lots préparés et scellés, en attente de dédouanement ou d’embarquement.
                </p>
                <button type="button" className="sn-btn" onClick={() => navigate('/shipping/preparation')}>
                  Voir les préparations
                </button>
              </section>
            </aside>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default InventoryManagement;
