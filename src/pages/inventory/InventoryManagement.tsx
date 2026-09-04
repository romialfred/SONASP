import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  Boxes,
  Building2,
  ChevronRight,
  Coins,
  FlaskConical,
  Landmark,
  Loader2,
  PackageCheck,
  Pickaxe,
  Plane,
  Plus,
  RefreshCw,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  chargerStockNational,
  GRAMMES_PAR_ONCE,
  ozVersKg,
  STOCK_VIDE,
  type PosteStock,
  type TendanceStock,
  type StockNational,
} from './inventoryOverviewData';
import './inventory-overview.css';
import { useAuth } from '@/contexts/AuthContext';
import { StockHistoryDialog } from './StockHistoryDialog';
import { formatStatusFr } from '@/utils/statusFormatter';

const onces = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entier = new Intl.NumberFormat('fr-FR');

export const formatOz = (valeur: number) => `${onces.format(valeur || 0)} oz`;
export const formatKg = (valeur: number) => `${onces.format(ozVersKg(valeur || 0))} kg`;
export const formatG = (valeur: number) => `${onces.format(valeur || 0)} g`;
export const grammesEnOz = (grammes: number) => (grammes || 0) / GRAMMES_PAR_ONCE;

/** Part d'un poste dans le total national ; `null` quand il n'y a rien à rapporter. */
export function part(valeur: number, total: number): number | null {
  if (!(total > 0)) return null;
  return (valeur / total) * 100;
}

function StockTrend({ points }: { points: TendanceStock[] }) {
  const donnees = points.length > 0 ? points : [{ cle: 'aucune', libelle: '—', valeurOz: 0 }];
  const maximum = Math.max(...donnees.map((point) => point.valeurOz), 0);
  const largeur = 420;
  const hauteur = 92;
  const marge = 8;
  const x = (index: number) => marge + (index * (largeur - marge * 2)) / Math.max(donnees.length - 1, 1);
  const y = (value: number) => hauteur - marge - (maximum > 0 ? (value / maximum) * (hauteur - marge * 2) : 0);
  const chemin = donnees.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point.valeurOz)}`).join(' ');
  const total = donnees.reduce((somme, point) => somme + point.valeurOz, 0);
  const actifs = donnees.filter((point) => point.valeurOz > 0).length;

  return (
    <figure className="stocks__tendance">
      <figcaption>
        <span><TrendingUp aria-hidden="true" /> Entrées sur 6 mois</span>
        <strong>{formatOz(total)}</strong>
        <small>{actifs} mois avec mouvement</small>
      </figcaption>
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} role="img" aria-label={`Tendance des entrées de stock sur six mois : ${formatOz(total)} au total`}>
        <path className="stocks__tendance-zone" d={`${chemin} L ${x(donnees.length - 1)} ${hauteur - marge} L ${x(0)} ${hauteur - marge} Z`} />
        <path className="stocks__tendance-ligne" d={chemin} />
        {donnees.map((point, index) => (
          <circle key={point.cle} cx={x(index)} cy={y(point.valeurOz)} r="3" />
        ))}
      </svg>
      <ul aria-label="Valeurs mensuelles des entrées">
        {donnees.map((point) => (
          <li key={point.cle}><span>{point.libelle}</span><b>{onces.format(point.valeurOz)}</b></li>
        ))}
      </ul>
    </figure>
  );
}

export function InventoryManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMine = Boolean(user?.mining_company_id);
  const [stock, setStock] = useState<StockNational>(STOCK_VIDE);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [posteOuvert, setPosteOuvert] = useState<PosteStock | null>(null);

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

  // Le socle est le registre opérationnel courant. Les flux de transport et
  // les créances restent visibles séparément : les additionner fabriquerait
  // un « total » susceptible de compter deux fois le même lot.
  const socle = stock.totalOz;

  const postes = useMemo(
    () => [
      {
        cle: 'disponible' as const,
        libelle: 'Disponible à la vente',
        icone: Coins,
        valeur: stock.disponibleOz,
        detail: 'Mobilisable',
      },
      {
        cle: 'alloue' as const,
        libelle: 'Alloué à des ventes',
        icone: Wallet,
        valeur: stock.allloueOz,
        detail: 'Réservé',
      },
      {
        cle: 'raffinerie' as const,
        libelle: 'Chez la raffinerie',
        icone: Truck,
        valeur: stock.enRouteOz,
        detail: 'En traitement',
      },
      {
        cle: 'reintegrer' as const,
        libelle: 'Raffiné, à réintégrer',
        icone: PackageCheck,
        valeur: stock.aReintegrerOz,
        detail: stock.aReintegrerLots > 0
          ? `${stock.aReintegrerLots} lot(s) à saisir`
          : 'Aucun lot',
        alerte: stock.aReintegrerOz > 0,
      },
      {
        cle: 'aeroport' as const,
        libelle: 'À l’aéroport',
        icone: Plane,
        valeur: stock.aeroportOz,
        detail: 'Prêt à expédier',
      },
    ],
    [stock]
  );
  const posteSelectionne = postes.find((poste) => poste.cle === posteOuvert) || null;
  const historiqueSelectionne = posteOuvert
    ? stock.historique.filter((ligne) => ligne.poste === posteOuvert)
    : [];
  const transitActifOz = stock.transit.reduce((total, ligne) => total + ligne.quantiteOz, 0);

  return (
    <NationalDashboardLayout>
      <div className="sn-page stocks">
        <PageHeader
          icon={Boxes}
          title={isMine ? 'Stocks d’or de la mine' : 'Suivi des stocks'}
          subtitle={isMine
            ? "Vue consolidée de votre mine : coffres, transit, aéroport et créances."
            : "Position opérationnelle : disponibilités, raffinage, transit, ventes et alimentation de la réserve."}
          breadcrumb={isMine
            ? [{ label: 'Stocks de la mine' }, { label: 'Position consolidée' }]
            : [{ label: 'Raffinage & stocks' }, { label: 'Suivi du stock d’or' }, { label: 'Position opérationnelle' }]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger(true)} disabled={actualisation}>
                <RefreshCw className={actualisation ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              {!isMine && (
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/inventory/add')}>
                  <Plus aria-hidden="true" /> Nouvelle entrée
                </button>
              )}
            </>
          }
        />

        {!isMine && (
          <nav className="stocks__domain-switch" aria-label="Domaines de gestion de l’or">
            <button type="button" className="is-active" aria-current="page">
              <span><Boxes aria-hidden="true" /></span>
              <span><strong>Stock opérationnel</strong><small>Or disponible, alloué, raffiné ou en transit</small></span>
              <Badge tone="success">Position courante</Badge>
            </button>
            <button type="button" onClick={() => navigate('/national-reserve')}>
              <span><Landmark aria-hidden="true" /></span>
              <span><strong>Réserve nationale</strong><small>Patrimoine affecté, rapproché et activé</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          </nav>
        )}

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        {stock.indisponibles.length > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            Vue partielle : impossible de charger {stock.indisponibles.join(', ')}.
          </Note>
        )}

        {chargement ? (
          <p className="stocks__chargement">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du suivi des stocks…
          </p>
        ) : (
          <div className="stocks__grille">
            <div className="stocks__principal">
              {/* Les politiques RLS limitent ce socle à la mine connectée. */}
              <section className="stocks__socle" aria-label={isMine ? 'Stock de la mine' : 'Stock opérationnel national'}>
                <div className="stocks__socle-apercu">
                  <header>
                    <span className="stocks__socle-icone" aria-hidden="true"><Landmark /></span>
                    <div>
                      <p>{isMine ? 'Position consolidée' : 'Position opérationnelle nationale'}</p>
                      <strong>{formatOz(socle)}</strong>
                      <small>{formatKg(socle)} sous suivi</small>
                    </div>
                    <span className="stocks__statut"><Activity aria-hidden="true" /> Données à jour</span>
                  </header>

                  <dl className="stocks__socle-detail">
                    <div>
                      <dt>Disponible</dt>
                      <dd>{formatOz(stock.disponibleOz)}</dd>
                      <span>{formatKg(stock.disponibleOz)}</span>
                    </div>
                    <div>
                      <dt>Alloué</dt>
                      <dd>{formatOz(stock.allloueOz)}</dd>
                      <span>{formatKg(stock.allloueOz)}</span>
                    </div>
                    <div>
                      <dt>Transféré à la réserve</dt>
                      <dd>{formatOz(stock.reserveOz)}</dd>
                      <span>{formatKg(stock.reserveOz)}</span>
                    </div>
                    <div>
                      <dt>Stock opérationnel</dt>
                      <dd>{formatOz(stock.totalOz)}</dd>
                      <span>{formatKg(stock.totalOz)}</span>
                    </div>
                  </dl>
                </div>
                <StockTrend points={stock.tendance} />
              </section>

              {/* --- Postes --- */}
              <section className="stocks__postes" aria-label="Répartition du stock">
                {postes.map((poste) => {
                  const Icone = poste.icone;
                  const pourcentage = ['disponible', 'alloue'].includes(poste.cle)
                    ? part(poste.valeur, socle)
                    : null;
                  return (
                    <button
                      type="button"
                      key={poste.cle}
                      className={`stocks__poste${'alerte' in poste && poste.alerte ? ' est-en-attente' : ''}`}
                      onClick={() => setPosteOuvert(poste.cle)}
                      aria-haspopup="dialog"
                      aria-label={`Voir l’historique : ${poste.libelle}, ${formatOz(poste.valeur)}`}
                    >
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
                        aria-label={`Part de ${poste.libelle} dans le stock opérationnel`}
                      >
                        <span style={{ width: `${Math.min(pourcentage || 0, 100)}%` }} />
                      </div>
                      <footer>
                        <small>
                          {pourcentage === null ? '—' : `${entier.format(Math.round(pourcentage))} %`} · {poste.detail}
                        </small>
                        <ChevronRight aria-hidden="true" />
                      </footer>
                    </button>
                  );
                })}
              </section>

              {/* --- Origine de la matière ---
                  Le socle national ne compte que de l'or raffiné rattaché à une
                  mine industrielle : `gold_inventory` n'offre aucun autre
                  rattachement. L'or acheté aux artisans se compte donc à part,
                  pour ce qu'il est — une matière détenue, en attente de fonte. */}
              {!isMine && (
                <Section
                  id="origines"
                  icon={FlaskConical}
                  tone="blue"
                  title="Origine de la matière"
                  description="D’où vient l’or que la SONASP détient."
                >
                  <div className="stocks__origines">
                  <article>
                    <header>
                      <span aria-hidden="true"><Building2 /></span>
                      <h4>Mines industrielles</h4>
                    </header>
                    <strong>{formatOz(stock.totalOz)}</strong>
                    <p>{formatKg(stock.totalOz)}</p>
                    <small>
                      Or raffiné revenu de la raffinerie et porté au stock {isMine ? 'de la mine' : 'national'},
                      sur {entier.format(stock.parMine.length)} société(s).
                    </small>
                  </article>

                  <article className={stock.artisanalGrammes > 0 ? 'est-en-attente' : undefined}>
                    <header>
                      <span aria-hidden="true"><Pickaxe /></span>
                      <h4>Collecte artisanale</h4>
                    </header>
                    <strong>{formatG(stock.artisanalGrammes)}</strong>
                    <p>
                      {formatG(stock.artisanalFinGrammes)} d’or fin ·{' '}
                      {formatOz(grammesEnOz(stock.artisanalFinGrammes))}
                    </p>
                    <small>
                      {entier.format(stock.artisanalLots)} lot(s) achetés aux artisans, détenus en
                      l’état. Cette matière n’entre au stock national qu’une fois fondue et
                      raffinée : la fonte n’est pas encore outillée.
                    </small>
                    <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/ventes-or')}>
                      Voir la collecte
                    </button>
                  </article>

                  <article>
                    <header>
                      <span aria-hidden="true"><PackageCheck /></span>
                      <h4>Retours de raffinage</h4>
                    </header>
                    <strong>{formatOz(stock.aReintegrerOz)}</strong>
                    <p>{formatKg(stock.aReintegrerOz)}</p>
                    <small>
                      {stock.aReintegrerLots > 0
                        ? `${entier.format(stock.aReintegrerLots)} lot(s) raffinés attendent leur saisie d’entrée en stock.`
                        : 'Aucun lot raffiné n’attend de saisie.'}
                    </small>
                    {stock.aReintegrerLots > 0 && (
                      <button type="button" className="sn-btn" onClick={() => navigate('/inventory/add')}>
                        Saisir une entrée
                      </button>
                    )}
                  </article>
                  </div>
                </Section>
              )}

              {/* --- Stock par mine --- */}
              <Section
                id="par-mine"
                icon={Building2}
                title={isMine ? 'Détail du stock de votre mine' : `Stock par société minière (${stock.parMine.length})`}
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
                          <th className="sn-table__num">Entrées</th>
                          <th className="sn-table__num">Total (oz)</th>
                          <th className="sn-table__num">Disponible (oz)</th>
                          <th className="sn-table__num">Alloué (oz)</th>
                          <th className="sn-table__num">Réserve (oz)</th>
                          <th className="sn-table__num">Vendu (oz)</th>
                          <th className="sn-table__num">Part</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.parMine.map((mine) => {
                          const pourcentage = part(mine.totalOz, stock.totalOz);
                          return (
                            <tr key={mine.id}>
                              <td><strong>{mine.nom}</strong></td>
                              <td className="sn-table__num">{entier.format(mine.lignes)}</td>
                              <td className="sn-table__num">{onces.format(mine.totalOz)}</td>
                              <td className="sn-table__num">{onces.format(mine.disponibleOz)}</td>
                              <td className="sn-table__num">{onces.format(mine.allloueOz)}</td>
                              <td className="sn-table__num">{onces.format(mine.reserveOz)}</td>
                              <td className="sn-table__num">{onces.format(mine.venduOz)}</td>
                              <td className="sn-table__num">
                                {pourcentage === null ? '—' : `${entier.format(Math.round(pourcentage))} %`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          <td className="sn-table__num">
                            {entier.format(stock.parMine.reduce((somme, mine) => somme + mine.lignes, 0))}
                          </td>
                          <td className="sn-table__num">{onces.format(stock.totalOz)}</td>
                          <td className="sn-table__num">{onces.format(stock.disponibleOz)}</td>
                          <td className="sn-table__num">{onces.format(stock.allloueOz)}</td>
                          <td className="sn-table__num">{onces.format(stock.reserveOz)}</td>
                          <td className="sn-table__num">{onces.format(stock.venduOz)}</td>
                          <td className="sn-table__num">100 %</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            {/* --- Volet de droite --- */}
            <aside className="stocks__volet" aria-label="Engagements et acheminements">
              <section className="stocks__carte stocks__creances">
                <header><span>Créances ouvertes</span><Wallet aria-hidden="true" /></header>
                <p className="stocks__creances-valeur">{formatOz(stock.venduNonPayeOz)}</p>
                <p className="stocks__creances-montant">
                  {stock.venduNonPayeDevise
                    ? `${entier.format(Math.round(stock.venduNonPayeMontant))} ${stock.venduNonPayeDevise}`
                    : 'Devises multiples'}
                </p>
                <button type="button" className="sn-btn" onClick={() => navigate('/payments')}>
                  Paiements <ChevronRight aria-hidden="true" />
                </button>
              </section>

              <section className="stocks__carte">
                <header><span>En transit</span><Truck aria-hidden="true" /></header>
                <div className="stocks__carte-kpis">
                  <strong>{stock.transit.length}</strong><span>expédition(s)</span>
                  <b>{formatOz(transitActifOz)}</b>
                </div>
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
                          <Badge tone="neutral">{formatStatusFr(ligne.statut)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="sn-btn" onClick={() => navigate('/freight')}>
                  Expéditions <ChevronRight aria-hidden="true" />
                </button>
              </section>

              <section className="stocks__carte">
                <header><span>À l’aéroport</span><Plane aria-hidden="true" /></header>
                <p className="stocks__creances-valeur">{formatOz(stock.aeroportOz)}</p>
                <p className="stocks__carte-note">Prêt pour dédouanement ou embarquement.</p>
                <button type="button" className="sn-btn" onClick={() => navigate('/shipping/preparation')}>
                  Préparations <ChevronRight aria-hidden="true" />
                </button>
              </section>
            </aside>
          </div>
        )}
        {posteSelectionne && (
          <StockHistoryDialog
            titre={posteSelectionne.libelle}
            totalOz={posteSelectionne.valeur}
            lignes={historiqueSelectionne}
            onClose={() => setPosteOuvert(null)}
          />
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default InventoryManagement;
