import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShoppingCart,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Field, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { useCoursOr } from '@/hooks/useCoursOr';
import { errorMessage } from '@/lib/errorMessage';
import {
  LIBELLES_STATUT_ACHAT,
  TAXE_DEV_COMM_TAUX_DEFAUT,
  TVA_TAUX_DEFAUT,
  achatMineService,
  validerAchat,
  valoriser,
  type AchatMine,
  type StatutAchat,
  type StockMine,
} from '@/services/achatMineService';
import './achats-mines.css';

const entier = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fcfa = (valeur: number) => `${entier.format(Math.round(valeur || 0))} FCFA`;
export const onces = (valeur: number) => `${decimal.format(valeur || 0)} oz`;

const TONS_STATUT: Record<StatutAchat, 'neutral' | 'warning' | 'success' | 'danger'> = {
  en_attente: 'warning',
  validee: 'success',
  payee: 'success',
  annulee: 'danger',
};

/** Mois écoulé : la SONASP arrête ses achats en fin de mois. */
export function periodeMoisPrecedent(aujourdhui = new Date()): { debut: string; fin: string } {
  const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1);
  const fin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { debut: iso(debut), fin: iso(fin) };
}

export default function AchatsMines() {
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();
  const { prixGrammeFcfa } = useCoursOr();

  const [periode, setPeriode] = useState(periodeMoisPrecedent());
  const [stocks, setStocks] = useState<StockMine[]>([]);
  const [achats, setAchats] = useState<AchatMine[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const [formOuvert, setFormOuvert] = useState(false);
  const [societeId, setSocieteId] = useState('');
  const [quantite, setQuantite] = useState('');
  const [prixOnce, setPrixOnce] = useState('');
  const [observations, setObservations] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [listeStocks, listeAchats] = await Promise.all([
        achatMineService.stocksParSociete(periode.debut, periode.fin),
        achatMineService.lister(),
      ]);
      setStocks(listeStocks);
      setAchats(listeAchats);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les stocks et les achats.'));
      setStocks([]);
      setAchats([]);
    } finally {
      setChargement(false);
    }
  }, [periode.debut, periode.fin]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Le cours du marché donne le prix de référence à l'once, converti du gramme. */
  const prixOnceMarche = prixGrammeFcfa === null ? null : prixGrammeFcfa * 31.1034768;

  useEffect(() => {
    if (!formOuvert || prixOnceMarche === null) return;
    setPrixOnce((courant) => courant || String(Math.round(prixOnceMarche)));
  }, [formOuvert, prixOnceMarche]);

  const stockRetenu = useMemo(
    () => stocks.find((stock) => stock.mining_company_id === societeId) || null,
    [stocks, societeId]
  );

  const quantiteOz = Number(String(quantite).replace(',', '.')) || 0;
  const prix = Number(String(prixOnce).replace(',', '.')) || 0;
  const valorisation = valoriser(quantiteOz, prix);

  const messageValidation = validerAchat(
    {
      mining_company_id: societeId,
      periode_debut: periode.debut,
      periode_fin: periode.fin,
      quantite_oz: quantiteOz,
      prix_once_fcfa: prix,
    },
    stockRetenu ? stockRetenu.disponibleOz : null
  );

  const cumuls = useMemo(() => {
    const produit = stocks.reduce((total, stock) => total + stock.produitOz, 0);
    const achete = stocks.reduce((total, stock) => total + stock.acheteOz, 0);
    const disponible = stocks.reduce((total, stock) => total + stock.disponibleOz, 0);
    const engage = achats
      .filter((achat) => achat.statut !== 'annulee')
      .reduce((total, achat) => total + Number(achat.montant_total_fcfa || 0), 0);
    return { produit, achete, disponible, engage };
  }, [stocks, achats]);

  const reinitialiser = () => {
    setSocieteId('');
    setQuantite('');
    setPrixOnce('');
    setObservations('');
  };

  const soumettre = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (messageValidation) {
      showError(messageValidation);
      return;
    }

    setEnregistrement(true);
    try {
      await achatMineService.creer({
        mining_company_id: societeId,
        periode_debut: periode.debut,
        periode_fin: periode.fin,
        date_achat: new Date().toISOString().slice(0, 10),
        quantite_oz: quantiteOz,
        prix_once_fcfa: prix,
        montant_brut_fcfa: valorisation.montantBrut,
        tva_taux: TVA_TAUX_DEFAUT,
        tva_montant_fcfa: valorisation.tva,
        taxe_dev_comm_taux: TAXE_DEV_COMM_TAUX_DEFAUT,
        taxe_dev_comm_montant_fcfa: valorisation.taxeDevComm,
        montant_total_fcfa: valorisation.montantTotal,
        statut: 'en_attente',
        observations: observations || null,
      });

      showSuccess('Achat enregistré.');
      setFormOuvert(false);
      reinitialiser();
      await charger();
    } catch (raison) {
      showError(errorMessage(raison, 'Impossible d’enregistrer l’achat.'));
    } finally {
      setEnregistrement(false);
    }
  };

  const changerStatut = async (achat: AchatMine, statut: StatutAchat) => {
    try {
      await achatMineService.changerStatut(achat.id as string, statut);
      showSuccess(`Achat ${LIBELLES_STATUT_ACHAT[statut].toLowerCase()}.`);
      await charger();
    } catch (raison) {
      showError(errorMessage(raison, 'Le changement de statut a échoué.'));
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-mines">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={ShoppingCart}
          title="Achats aux mines industrielles"
          subtitle="La SONASP achète tout ou partie du stock de production déclaré par chaque société."
          breadcrumb={[{ label: 'Mines industrielles' }, { label: 'Achats aux mines' }]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              {formOuvert ? (
                <button type="button" className="sn-btn" onClick={() => setFormOuvert(false)}>
                  <X aria-hidden="true" /> Fermer
                </button>
              ) : (
                <button type="button" className="sn-btn sn-btn--primary" onClick={() => setFormOuvert(true)}>
                  <Plus aria-hidden="true" /> Nouvel achat
                </button>
              )}
            </>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <section className="sn-card achats-mines__periode" aria-label="Période d’achat">
          <label className="sn-field">
            <span className="sn-field__label">Production du</span>
            <input
              type="date"
              value={periode.debut}
              max={periode.fin}
              onChange={(event) => setPeriode((courant) => ({ ...courant, debut: event.target.value }))}
            />
          </label>
          <label className="sn-field">
            <span className="sn-field__label">au</span>
            <input
              type="date"
              value={periode.fin}
              min={periode.debut}
              onChange={(event) => setPeriode((courant) => ({ ...courant, fin: event.target.value }))}
            />
          </label>
          <p className="achats-mines__periode-note">
            Le stock mobilisable est celui déclaré sur cette période, diminué des achats déjà engagés.
          </p>
        </section>

        <StatGrid
          sober
          ariaLabel="Stocks de production"
          items={[
            { label: 'Production déclarée', value: onces(cumuls.produit), icon: Building2, tone: 'neutral' },
            { label: 'Déjà acheté', value: onces(cumuls.achete), icon: ShoppingCart, tone: 'gold' },
            { label: 'Mobilisable', value: onces(cumuls.disponible), icon: Coins, tone: 'green' },
            { label: 'Engagé (toutes périodes)', value: fcfa(cumuls.engage), icon: Calculator, tone: 'neutral' },
          ]}
        />

        {formOuvert && (
          <Section
            id="achat"
            icon={Plus}
            title="Nouvel achat"
            description="Quantité prélevée sur le stock de la société, valorisée au prix négocié."
          >
            <form onSubmit={soumettre}>
              <div className="achats-mines__ligne">
                <Field label="Société minière" required>
                  <select value={societeId} onChange={(event) => setSocieteId(event.target.value)} required>
                    <option value="">Sélectionner une société</option>
                    {stocks.map((stock) => (
                      <option key={stock.mining_company_id} value={stock.mining_company_id}>
                        {stock.nom} — {decimal.format(stock.disponibleOz)} oz disponibles
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Quantité achetée (oz)"
                  required
                  hint={stockRetenu ? `${decimal.format(stockRetenu.disponibleOz)} oz mobilisables` : 'Choisissez d’abord une société'}
                >
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={quantite}
                    onChange={(event) => setQuantite(event.target.value)}
                    required
                  />
                </Field>

                <Field
                  label="Prix à l’once (FCFA)"
                  required
                  hint={
                    prixOnceMarche === null
                      ? 'Cours du marché indisponible : saisissez le prix négocié.'
                      : `Cours du marché : ${entier.format(Math.round(prixOnceMarche))} FCFA/oz`
                  }
                >
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={prixOnce}
                    onChange={(event) => setPrixOnce(event.target.value)}
                    required
                  />
                </Field>
              </div>

              {/* Raccourci disponible dès la société choisie : c'est quantité vide qu'il sert. */}
              {stockRetenu && stockRetenu.disponibleOz > 0 && (
                <button
                  type="button"
                  className="sn-btn achats-mines__tout"
                  onClick={() => setQuantite(String(stockRetenu.disponibleOz))}
                >
                  Acheter tout le stock ({decimal.format(stockRetenu.disponibleOz)} oz)
                </button>
              )}

              <Field label="Observations" wide>
                <textarea
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
                  placeholder="Conditions de l’achat, référence de la décision…"
                />
              </Field>

              <dl className="achats-mines__valorisation">
                <div>
                  <dt>Montant brut</dt>
                  <dd>{fcfa(valorisation.montantBrut)}</dd>
                </div>
                <div>
                  <dt>TVA ({TVA_TAUX_DEFAUT} %)</dt>
                  <dd>{fcfa(valorisation.tva)}</dd>
                </div>
                <div>
                  <dt>Taxe de développement communal ({TAXE_DEV_COMM_TAUX_DEFAUT} %)</dt>
                  <dd>{fcfa(valorisation.taxeDevComm)}</dd>
                </div>
                <div className="is-total">
                  <dt>Montant total</dt>
                  <dd>{fcfa(valorisation.montantTotal)}</dd>
                </div>
              </dl>

              <footer className="sn-form-actions">
                {messageValidation && <span className="achats-mines__blocage">{messageValidation}</span>}
                <button type="button" className="sn-btn" onClick={() => setFormOuvert(false)}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="sn-btn sn-btn--primary"
                  disabled={enregistrement || Boolean(messageValidation)}
                >
                  {enregistrement ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {enregistrement ? 'Enregistrement…' : 'Enregistrer l’achat'}
                </button>
              </footer>
            </form>
          </Section>
        )}

        <Section
          id="stocks"
          icon={Building2}
          title={`Stock par société (${stocks.length})`}
          description="Production déclarée sur la période, part déjà achetée et reste mobilisable."
        >
          {chargement ? (
            <p className="achats-mines__chargement">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement…
            </p>
          ) : stocks.length === 0 ? (
            <EmptyState
              title="Aucune production déclarée"
              description="Aucune société minière n’a déclaré de production sur cette période."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th>Société minière</th>
                    <th className="sn-table__num">Déclarations</th>
                    <th className="sn-table__num">Production</th>
                    <th className="sn-table__num">Acheté</th>
                    <th className="sn-table__num">Mobilisable</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => (
                    <tr key={stock.mining_company_id}>
                      <td>
                        <strong>{stock.nom}</strong>
                      </td>
                      <td className="sn-table__num">{entier.format(stock.declarations)}</td>
                      <td className="sn-table__num">{onces(stock.produitOz)}</td>
                      <td className="sn-table__num">{onces(stock.acheteOz)}</td>
                      <td className="sn-table__num">
                        <strong>{onces(stock.disponibleOz)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          id="achats"
          icon={ShoppingCart}
          title={`Achats enregistrés (${achats.length})`}
          description="Chaque achat prélève sur le stock de la société et alimente celui de la SONASP."
        >
          {achats.length === 0 ? (
            <EmptyState title="Aucun achat" description="Aucun achat n’a encore été enregistré." />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th>N° d’achat</th>
                    <th>Société</th>
                    <th>Période</th>
                    <th className="sn-table__num">Quantité</th>
                    <th className="sn-table__num">Montant total</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {achats.map((achat) => (
                    <tr key={achat.id}>
                      <td>
                        <strong>{achat.numero_achat || '—'}</strong>
                      </td>
                      <td>{achat.mining_company?.name || '—'}</td>
                      <td>
                        {new Date(achat.periode_debut).toLocaleDateString('fr-FR')} –{' '}
                        {new Date(achat.periode_fin).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="sn-table__num">{onces(achat.quantite_oz)}</td>
                      <td className="sn-table__num">{fcfa(achat.montant_total_fcfa)}</td>
                      <td>
                        <Badge tone={TONS_STATUT[achat.statut]}>{LIBELLES_STATUT_ACHAT[achat.statut]}</Badge>
                      </td>
                      <td>
                        {achat.statut === 'en_attente' && (
                          <button
                            type="button"
                            className="sn-btn sn-btn--sm"
                            onClick={() => void changerStatut(achat, 'validee')}
                          >
                            <CheckCircle2 aria-hidden="true" /> Valider
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
