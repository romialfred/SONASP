import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Building2, Clock, RefreshCw, Scale } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  achatsIndustrielsService,
  LIBELLES_STATUT_FACTURE,
  type FactureAchat,
  type LigneBalanceAgee,
  type LigneReleve,
  type SituationSociete,
  type Societe,
} from '@/services/achatsIndustrielsService';
import { LIBELLES_TRANCHE, TRANCHES } from '@/services/achatsIndustrielsCalculs';
import { francs } from './PlansAchatPage';
import { formaterDate } from './DemandesAchatPage';
import './achats.css';

/**
 * Compte de chaque société minière : balance âgée, relevé et factures.
 *
 * La convention comptable est celle de la SONASP, qui est ici le débiteur : une
 * facture augmente ce qu'elle doit, un règlement le diminue. Le solde progressif
 * du relevé se lit donc « ce que la SONASP doit encore ».
 *
 * Tous les montants viennent des fonctions de la base — `snp_balance_agee`,
 * `snp_releve_societe`, `snp_situation_societe` — pour qu'un même solde ne soit
 * pas calculé différemment d'un écran à l'autre.
 */

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ComptesMinesPage() {
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [societeChoisie, setSocieteChoisie] = useState<string>('all');
  const [balance, setBalance] = useState<LigneBalanceAgee[]>([]);
  const [situation, setSituation] = useState<SituationSociete | null>(null);
  const [releve, setReleve] = useState<LigneReleve[]>([]);
  const [factures, setFactures] = useState<FactureAchat[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [listeSocietes, balanceChargee] = await Promise.all([
        achatsIndustrielsService.societesProductrices(),
        achatsIndustrielsService.balanceAgee(societeChoisie),
      ]);
      setSocietes(listeSocietes);
      setBalance(balanceChargee);

      if (societeChoisie !== 'all') {
        const [situationChargee, releveCharge, facturesChargees] = await Promise.all([
          achatsIndustrielsService.situation(societeChoisie),
          achatsIndustrielsService.releve(societeChoisie),
          achatsIndustrielsService.listerFactures({ societe: societeChoisie }),
        ]);
        setSituation(situationChargee);
        setReleve(releveCharge);
        setFactures(facturesChargees);
      } else {
        setSituation(null);
        setReleve([]);
        setFactures([]);
      }
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les comptes des sociétés minières.'));
    } finally {
      setChargement(false);
    }
  }, [societeChoisie]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const totauxBalance = useMemo(() => {
    const cumul = TRANCHES.reduce(
      (accumulateur, tranche) => ({ ...accumulateur, [tranche]: 0 }),
      {} as Record<string, number>
    );
    let total = 0;
    let nbFactures = 0;
    balance.forEach((ligne) => {
      TRANCHES.forEach((tranche) => {
        cumul[tranche] += Number((ligne as unknown as Record<string, number>)[tranche] || 0);
      });
      total += Number(ligne.total || 0);
      nbFactures += Number(ligne.nb_factures || 0);
    });
    return { cumul, total, nbFactures };
  }, [balance]);

  const nomSociete = societes.find((societe) => societe.id === societeChoisie)?.name;

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-page">
        <PageHeader
          icon={Building2}
          title="Comptes des sociétés minières"
          subtitle="Ce que la SONASP doit à chaque mine, son ancienneté et le détail des mouvements."
          breadcrumb={[{ label: 'Achats industriels' }, { label: 'Comptes des mines' }]}
          info={{
            titre: 'Sens de lecture du relevé',
            contenu:
              'La SONASP est le débiteur : une facture augmente ce qu’elle doit, un règlement le diminue. Le solde progressif se lit donc comme la dette restante envers la mine.',
          }}
          actions={
            <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
              <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
            </button>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}

        <div className="sn-grid sn-grid--3" style={{ marginTop: 12 }}>
          <label className="sn-field">
            <span className="sn-field__label">Société minière</span>
            <select value={societeChoisie} onChange={(evenement) => setSocieteChoisie(evenement.target.value)}>
              <option value="all">Toutes les sociétés</option>
              {societes.map((societe) => (
                <option key={societe.id} value={societe.id}>{societe.name}</option>
              ))}
            </select>
          </label>
        </div>

        {situation && (
          <StatGrid
            sober
            ariaLabel={`Situation de ${nomSociete}`}
            items={[
              { label: 'Facturé', value: francs(situation.facture_total), icon: BookOpen, tone: 'neutral' },
              { label: 'Réglé', value: francs(situation.facture_payee), icon: Scale, tone: 'green' },
              { label: 'Reste dû', value: francs(situation.reste_du), icon: AlertTriangle, tone: 'gold' },
              { label: 'Dette échue', value: francs(situation.dette_echue), icon: Clock, tone: 'red' },
              {
                label: 'Ancienneté moyenne',
                value: situation.anciennete_moyenne === null
                  ? '—' : `${decimal.format(Number(situation.anciennete_moyenne))} j`,
                hint: situation.plus_ancienne_echeance
                  ? `Plus ancienne échéance : ${formaterDate(situation.plus_ancienne_echeance)}`
                  : undefined,
                icon: Clock,
                tone: 'neutral',
              },
            ]}
          />
        )}

        {situation && Number(situation.non_affecte || 0) > 0.005 && (
          <Note tone="warning" icon={AlertTriangle}>
            {francs(situation.non_affecte)} versés à cette société ne sont imputés sur aucune facture.
          </Note>
        )}

        {/* --------------------------------------------------- Balance âgée -- */}
        <Section
          id="balance"
          icon={Scale}
          title="Balance âgée"
          description="Ancienneté calculée depuis la date d’échéance. Le non-échu forme une tranche à part."
        >
          {chargement ? (
            <p className="production-page__loading">Chargement de la balance…</p>
          ) : balance.length === 0 ? (
            <EmptyState
              title="Aucune dette ouverte"
              description="Toutes les factures d’achat sont soldées."
            />
          ) : (
            <div className="sn-table-wrap achats-balance">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Société</th>
                    {TRANCHES.map((tranche) => (
                      <th key={tranche} scope="col" className="is-right">{LIBELLES_TRANCHE[tranche]}</th>
                    ))}
                    <th scope="col" className="is-right">Total dû</th>
                    <th scope="col" className="is-right">Factures</th>
                    <th scope="col">Plus ancienne</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.map((ligne) => (
                    <tr key={`${ligne.mining_company_id}-${ligne.devise}`}>
                      <td><strong>{ligne.societe}</strong></td>
                      {TRANCHES.map((tranche) => {
                        const valeur = Number((ligne as unknown as Record<string, number>)[tranche] || 0);
                        return (
                          <td
                            key={tranche}
                            className={`is-right ${valeur <= 0 ? 'est-vide' : tranche === 'plus_180' ? 'est-critique' : ''}`}
                          >
                            {valeur > 0 ? francs(valeur) : '—'}
                          </td>
                        );
                      })}
                      <td className="is-right"><strong>{francs(ligne.total)}</strong></td>
                      <td className="is-right">{ligne.nb_factures}</td>
                      <td>{formaterDate(ligne.plus_ancienne)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    {TRANCHES.map((tranche) => (
                      <td key={tranche} className="is-right">
                        {totauxBalance.cumul[tranche] > 0 ? francs(totauxBalance.cumul[tranche]) : '—'}
                      </td>
                    ))}
                    <td className="is-right"><strong>{francs(totauxBalance.total)}</strong></td>
                    <td className="is-right">{totauxBalance.nbFactures}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {/* ------------------------------------------------------- Factures -- */}
        {societeChoisie !== 'all' && (
          <Section
            id="factures"
            icon={BookOpen}
            title={`Factures — ${nomSociete ?? ''}`}
            description="Factures d’achat émises par la mine, avec leur reste dû."
          >
            {factures.length === 0 ? (
              <EmptyState title="Aucune facture" description="Cette société n’a pas encore facturé la SONASP." />
            ) : (
              <div className="sn-table-wrap">
                <table className="sn-table">
                  <thead>
                    <tr>
                      <th scope="col">Facture</th>
                      <th scope="col">Émission</th>
                      <th scope="col">Échéance</th>
                      <th scope="col" className="is-right">Quantité</th>
                      <th scope="col" className="is-right">Montant TTC</th>
                      <th scope="col" className="is-right">Réglé</th>
                      <th scope="col" className="is-right">Reste dû</th>
                      <th scope="col">État</th>
                      <th scope="col">Certification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factures.map((facture) => (
                      <tr key={facture.id}>
                        <td><strong>{facture.numero_facture}</strong></td>
                        <td>{formaterDate(facture.date_emission)}</td>
                        <td>{formaterDate(facture.date_echeance)}</td>
                        <td className="is-right">{decimal.format(Number(facture.quantite_oz))} oz</td>
                        <td className="is-right">{francs(facture.montant_ttc_fcfa)}</td>
                        <td className="is-right">{francs(facture.montant_paye_fcfa)}</td>
                        <td className="is-right"><strong>{francs(facture.reste_du_fcfa)}</strong></td>
                        <td>
                          <Badge tone={
                            facture.statut === 'payee' ? 'success'
                              : facture.statut === 'partiellement_payee' ? 'warning'
                                : facture.statut === 'annulee' ? 'danger' : 'info'
                          }>
                            {LIBELLES_STATUT_FACTURE[facture.statut]}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={
                            facture.statut_certification === 'certifiee' ? 'success'
                              : facture.statut_certification === 'echec' ? 'danger' : 'warning'
                          }>
                            {facture.statut_certification === 'certifiee' ? 'Certifiée'
                              : facture.statut_certification === 'echec' ? 'Échec'
                                : 'En attente'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* -------------------------------------------------------- Relevé -- */}
        {societeChoisie !== 'all' && (
          <Section
            id="releve"
            icon={BookOpen}
            tone="blue"
            title={`Relevé de compte — ${nomSociete ?? ''}`}
            description="Mouvements chronologiques et solde progressif de la dette."
          >
            {releve.length === 0 ? (
              <EmptyState title="Aucun mouvement" description="Le compte de cette société est vierge." />
            ) : (
              <div className="sn-table-wrap achats-releve">
                <table className="sn-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Opération</th>
                      <th scope="col">Référence</th>
                      <th scope="col">Libellé</th>
                      <th scope="col" className="is-right">Débit</th>
                      <th scope="col" className="is-right">Crédit</th>
                      <th scope="col" className="is-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releve.map((ligne, index) => (
                      <tr key={`${ligne.reference}-${index}`}>
                        <td>{formaterDate(ligne.ligne_date)}</td>
                        <td>
                          {ligne.type_operation === 'facture' ? 'Facture'
                            : ligne.type_operation === 'reglement' ? 'Règlement' : 'Avoir'}
                        </td>
                        <td>{ligne.reference}</td>
                        <td>{ligne.libelle}</td>
                        <td className="is-right est-debit">
                          {Number(ligne.debit) > 0 ? francs(ligne.debit) : '—'}
                        </td>
                        <td className="is-right est-credit">
                          {Number(ligne.credit) > 0 ? francs(ligne.credit) : '—'}
                        </td>
                        <td className="is-right"><strong>{francs(ligne.solde)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default ComptesMinesPage;
