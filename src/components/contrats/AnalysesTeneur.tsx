import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Plus, Scale } from 'lucide-react';
import { Badge, EmptyState, Note, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  analysesTeneurService,
  ecartEnPoints,
  ETATS_A_TRAITER,
  LIBELLES_DECISION,
  LIBELLES_ORIGINE,
  LIBELLES_STATUT_ANALYSE,
  TONS_STATUT_ANALYSE,
  type AnalyseTeneur,
  type LigneSynthese,
} from '@/services/analysesTeneurService';
import './analyses-teneur.css';

/**
 * Instruction contradictoire de la teneur d'un lot.
 *
 * ══ CE QUE CE BLOC MONTRE ══
 *
 * La teneur déclarée par la mine, puis chaque résultat de laboratoire dans sa
 * ligne, avec son écart à la déclaration. Rien ne s'y écrase : un résultat faux
 * se corrige en enregistrant le suivant, et la base refuse toute modification.
 *
 * La décision — accepter, contre-analyser, saisir le laboratoire indépendant,
 * ouvrir une non-conformité — vient des règles du contrat. Elle s'affiche telle
 * que la base l'a tranchée, avec son explication.
 */

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

const pourcent = (valeur: number | null | undefined) =>
  valeur === null || valeur === undefined ? '—' : `${Number(valeur).toFixed(3)} %`;

/** Un écart se lit avec son signe : au-dessus ou en dessous de la déclaration. */
export const formaterEcart = (points: number) =>
  `${points > 0 ? '+' : ''}${points.toFixed(3)} pt`;

interface Props {
  contratId?: string;
  requisitionId?: string;
  miningCompanyId?: string | null;
  /** Teneur annoncée par la mine, proposée à l'ouverture d'une instruction. */
  teneurDeclareeProposee?: number | null;
}

export function AnalysesTeneur({
  contratId, requisitionId, miningCompanyId, teneurDeclareeProposee,
}: Props) {
  const [analyses, setAnalyses] = useState<AnalyseTeneur[]>([]);
  const [syntheses, setSyntheses] = useState<Record<string, LigneSynthese[]>>({});
  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [ouverture, setOuverture] = useState<{
    teneur: string; echantillon: string; datePrelevement: string; masse: string;
  } | null>(null);
  const [resultat, setResultat] = useState<{
    analyseId: string; laboratoire: string; teneur: string; certificat: string;
    methode: string; independant: boolean;
  } | null>(null);
  const [arbitrage, setArbitrage] = useState<{
    analyseId: string; teneur: string; justification: string;
  } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const liste = await analysesTeneurService.lister({ contratId, requisitionId });
      setAnalyses(liste);
      const paires = await Promise.all(liste.map(async (analyse) => [
        analyse.id, await analysesTeneurService.synthese(analyse.id),
      ] as const));
      setSyntheses(Object.fromEntries(paires));
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les analyses.'));
    } finally {
      setChargement(false);
    }
  }, [contratId, requisitionId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const executer = async (nom: string, operation: () => Promise<string>) => {
    setAction(nom);
    setErreur(null);
    setMessage(null);
    try {
      setMessage(await operation());
      await charger();
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’opération a échoué.'));
    } finally {
      setAction(null);
    }
  };

  const ouvrirInstruction = () =>
    executer('ouvrir', async () => {
      if (!ouverture) throw new Error('Rien à ouvrir.');
      const teneur = Number(ouverture.teneur);
      if (!(teneur > 0 && teneur <= 100)) {
        throw new Error('La teneur déclarée doit être comprise entre 0 et 100 %.');
      }
      const analyse = await analysesTeneurService.ouvrir({
        // Le déclencheur serveur attribue la référence séquentielle lorsqu'elle
        // est vide ; la propriété reste obligatoire dans le contrat TypeScript.
        reference: '',
        contrat_id: contratId ?? null,
        requisition_id: requisitionId ?? null,
        mining_company_id: miningCompanyId ?? null,
        teneur_declaree_pct: teneur,
        numero_echantillon: ouverture.echantillon || null,
        date_prelevement: ouverture.datePrelevement || null,
        masse_echantillon_g: Number(ouverture.masse) || null,
      });
      setOuverture(null);
      return `Instruction ${analyse.reference} ouverte sur une teneur déclarée de ${pourcent(teneur)}.`;
    });

  const enregistrerResultat = () =>
    executer('resultat', async () => {
      if (!resultat) throw new Error('Rien à enregistrer.');
      await analysesTeneurService.enregistrerResultat({
        analyseId: resultat.analyseId,
        laboratoire: resultat.laboratoire,
        teneurPct: Number(resultat.teneur),
        certificat: resultat.certificat || null,
        methode: resultat.methode || null,
        laboratoireIndependant: resultat.independant,
      });
      setResultat(null);
      return 'Résultat enregistré. Il ne se modifie plus : le suivant le complétera.';
    });

  const trancher = () =>
    executer('trancher', async () => {
      if (!arbitrage) throw new Error('Rien à trancher.');
      await analysesTeneurService.trancher(
        arbitrage.analyseId, Number(arbitrage.teneur), arbitrage.justification
      );
      setArbitrage(null);
      return 'Teneur arrêtée. C’est elle qui servira à facturer.';
    });

  const aTraiter = analyses.filter((analyse) => ETATS_A_TRAITER.includes(analyse.statut));

  return (
    <Section
      id="analyses"
      icon={FlaskConical}
      tone="blue"
      title={`Analyses de teneur (${analyses.length})`}
      description="Déclaration de la mine, résultats successifs, teneur finalement retenue."
      info={{
        titre: 'Pourquoi rien ne s’écrase',
        contenu:
          'Chaque résultat de laboratoire vit dans sa ligne, avec sa date, son certificat et son auteur. La base refuse toute modification ou suppression : un résultat faux se corrige en enregistrant le suivant, jamais en effaçant le précédent. C’est ce qui permet de défendre une facturation contestée.',
      }}
    >
      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
      {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

      <div className="analyses__gestes">
        <button
          type="button" className="sn-btn"
          onClick={() => setOuverture({
            teneur: teneurDeclareeProposee?.toString() ?? '',
            echantillon: '',
            datePrelevement: '',
            masse: '',
          })}
          disabled={action !== null}
        >
          <Plus aria-hidden="true" /> Ouvrir une instruction
        </button>
      </div>

      {ouverture && (
        <div className="analyses__formulaire">
          <div className="analyses__champs">
            <label className="sn-field">
              <span className="sn-field__label">Teneur déclarée par la mine (%)</span>
              <input
                type="number" min={0} max={100} step={0.001} value={ouverture.teneur}
                onChange={(evenement) => setOuverture({ ...ouverture, teneur: evenement.target.value })}
              />
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Numéro d’échantillon</span>
              <input
                value={ouverture.echantillon}
                onChange={(evenement) => setOuverture({ ...ouverture, echantillon: evenement.target.value })}
              />
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Date de prélèvement</span>
              <input
                type="date" value={ouverture.datePrelevement}
                onChange={(evenement) => setOuverture({ ...ouverture, datePrelevement: evenement.target.value })}
              />
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Masse de l’échantillon (g)</span>
              <input
                type="number" min={0} step={0.001} value={ouverture.masse}
                onChange={(evenement) => setOuverture({ ...ouverture, masse: evenement.target.value })}
              />
            </label>
          </div>
          <div className="analyses__boutons">
            <button type="button" className="sn-btn" onClick={() => setOuverture(null)}>Renoncer</button>
            <button
              type="button" className="sn-btn sn-btn--primary"
              onClick={() => void ouvrirInstruction()} disabled={action !== null}
            >
              Ouvrir
            </button>
          </div>
        </div>
      )}

      {chargement ? (
        <p className="production-page__loading">Chargement des analyses…</p>
      ) : analyses.length === 0 ? (
        <EmptyState
          title="Aucune instruction ouverte"
          description="Une instruction part de la teneur que la mine déclare, puis reçoit les résultats de laboratoire dans l’ordre où ils arrivent."
        />
      ) : (
        <ul className="analyses__liste">
          {analyses.map((analyse) => {
            const synthese = syntheses[analyse.id] ?? [];
            return (
              <li key={analyse.id} className={`analyses__fiche is-${analyse.statut}`}>
                <header>
                  <div>
                    <strong>{analyse.reference}</strong>
                    <em>
                      Déclarée à {pourcent(analyse.teneur_declaree_pct)}
                      {analyse.numero_echantillon && ` · échantillon ${analyse.numero_echantillon}`}
                      {analyse.date_prelevement && ` · prélevé le ${formaterDate(analyse.date_prelevement)}`}
                    </em>
                  </div>
                  <Badge tone={TONS_STATUT_ANALYSE[analyse.statut]}>
                    {LIBELLES_STATUT_ANALYSE[analyse.statut]}
                  </Badge>
                </header>

                {analyse.decision && (
                  <p className={`analyses__decision is-${analyse.decision}`}>
                    {LIBELLES_DECISION[analyse.decision]}
                  </p>
                )}

                {synthese.length === 0 ? (
                  <p className="analyses__vide">Aucun résultat de laboratoire enregistré.</p>
                ) : (
                  <div className="sn-table-wrap">
                    <table className="sn-table">
                      <thead>
                        <tr>
                          <th scope="col">Rang</th>
                          <th scope="col">Origine</th>
                          <th scope="col">Laboratoire</th>
                          <th scope="col" className="sn-table__num">Teneur (%)</th>
                          <th scope="col" className="sn-table__num">Écart</th>
                          <th scope="col">Certificat</th>
                          <th scope="col">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {synthese.map((ligne) => (
                          <tr key={ligne.rang}>
                            <td>{ligne.rang}</td>
                            <td>{LIBELLES_ORIGINE[ligne.origine]}</td>
                            <td>
                              {ligne.laboratoire}
                              {ligne.laboratoire_independant && (
                                <small className="analyses__independant">Indépendant</small>
                              )}
                            </td>
                            <td className="sn-table__num">{Number(ligne.teneur_pct).toFixed(3)}</td>
                            <td className={`sn-table__num analyses__ecart${
                              ligne.ecart_a_la_declaration < 0 ? ' est-negatif' : ''}`}>
                              {formaterEcart(Number(ligne.ecart_a_la_declaration))}
                            </td>
                            <td>{ligne.certificat_reference || '—'}</td>
                            <td>{formaterDate(ligne.date_analyse)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {analyse.statut === 'tranchee' ? (
                  <div className="analyses__retenue">
                    <div>
                      <span>Teneur retenue</span>
                      <strong>{pourcent(analyse.teneur_retenue_pct)}</strong>
                    </div>
                    <p>{analyse.justification_retenue}</p>
                    <small>
                      Arrêtée le {formaterDate(analyse.retenue_le)}. C’est elle qui sert à facturer.
                      {synthese.length > 0
                        && ` Écart à la déclaration : ${formaterEcart(ecartEnPoints(
                          Number(analyse.teneur_retenue_pct), Number(analyse.teneur_declaree_pct)
                        ))}.`}
                    </small>
                  </div>
                ) : analyse.statut !== 'annulee' && (
                  <div className="analyses__gestes">
                    <button
                      type="button" className="sn-btn"
                      onClick={() => setResultat({
                        analyseId: analyse.id, laboratoire: '', teneur: '',
                        certificat: '', methode: '',
                        independant: analyse.statut === 'laboratoire_independant_requis',
                      })}
                      disabled={action !== null}
                    >
                      <FlaskConical aria-hidden="true" /> Enregistrer un résultat
                    </button>
                    {synthese.length > 0 && (
                      <button
                        type="button" className="sn-btn sn-btn--primary"
                        onClick={() => setArbitrage({
                          analyseId: analyse.id,
                          teneur: String(synthese[synthese.length - 1].teneur_pct),
                          justification: '',
                        })}
                        disabled={action !== null}
                      >
                        <Scale aria-hidden="true" /> Arrêter la teneur
                      </button>
                    )}
                  </div>
                )}

                {resultat?.analyseId === analyse.id && (
                  <div className="analyses__formulaire">
                    <div className="analyses__champs">
                      <label className="sn-field">
                        <span className="sn-field__label">Laboratoire</span>
                        <input
                          value={resultat.laboratoire}
                          onChange={(evenement) =>
                            setResultat({ ...resultat, laboratoire: evenement.target.value })}
                        />
                      </label>
                      <label className="sn-field">
                        <span className="sn-field__label">Teneur mesurée (%)</span>
                        <input
                          type="number" min={0} max={100} step={0.001} value={resultat.teneur}
                          onChange={(evenement) =>
                            setResultat({ ...resultat, teneur: evenement.target.value })}
                        />
                      </label>
                      <label className="sn-field">
                        <span className="sn-field__label">Référence du certificat</span>
                        <input
                          value={resultat.certificat}
                          onChange={(evenement) =>
                            setResultat({ ...resultat, certificat: evenement.target.value })}
                        />
                      </label>
                      <label className="sn-field">
                        <span className="sn-field__label">Méthode</span>
                        <input
                          value={resultat.methode}
                          onChange={(evenement) =>
                            setResultat({ ...resultat, methode: evenement.target.value })}
                          placeholder="Coupellation, fluorescence X…"
                        />
                      </label>
                      <label className="analyses__bascule">
                        <input
                          type="checkbox" checked={resultat.independant}
                          onChange={(evenement) =>
                            setResultat({ ...resultat, independant: evenement.target.checked })}
                        />
                        <span>Ce résultat vient du laboratoire indépendant</span>
                      </label>
                    </div>
                    <div className="analyses__boutons">
                      <button type="button" className="sn-btn" onClick={() => setResultat(null)}>
                        Renoncer
                      </button>
                      <button
                        type="button" className="sn-btn sn-btn--primary"
                        onClick={() => void enregistrerResultat()}
                        disabled={action !== null
                          || resultat.laboratoire.trim().length === 0
                          || !(Number(resultat.teneur) > 0)}
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}

                {arbitrage?.analyseId === analyse.id && (
                  <div className="analyses__formulaire">
                    <div className="analyses__champs">
                      <label className="sn-field">
                        <span className="sn-field__label">Teneur retenue (%)</span>
                        <input
                          type="number" min={0} max={100} step={0.001} value={arbitrage.teneur}
                          onChange={(evenement) =>
                            setArbitrage({ ...arbitrage, teneur: evenement.target.value })}
                        />
                      </label>
                      <label className="sn-field is-large">
                        <span className="sn-field__label">Justification</span>
                        <textarea
                          rows={3} value={arbitrage.justification}
                          onChange={(evenement) =>
                            setArbitrage({ ...arbitrage, justification: evenement.target.value })}
                          placeholder="Pourquoi cette valeur, et non une autre"
                        />
                      </label>
                    </div>
                    <div className="analyses__boutons">
                      <button type="button" className="sn-btn" onClick={() => setArbitrage(null)}>
                        Renoncer
                      </button>
                      <button
                        type="button" className="sn-btn sn-btn--primary"
                        onClick={() => void trancher()}
                        disabled={action !== null
                          || arbitrage.justification.trim().length < 10
                          || !(Number(arbitrage.teneur) > 0)}
                      >
                        Arrêter la teneur
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aTraiter.length > 0 && (
        <Note tone="warning" icon={AlertTriangle}>
          {aTraiter.length} instruction(s) en attente d’arbitrage. Tant que la teneur n’est pas
          arrêtée, la facturation reste suspendue à son résultat.
        </Note>
      )}
    </Section>
  );
}

export default AnalysesTeneur;
