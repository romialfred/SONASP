import { AlertTriangle, FileText, Loader2, Printer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errorMessage';
import { achatsIndustrielsService } from '@/services/achatsIndustrielsService';
import '@/pages/artisan-minier/facture-vente.css';
import './facture-achat.css';

/**
 * Facture d'achat, présentée dans la forme exacte de la facture de vente
 * artisanale : même en-tête, même tableau de lignes, même récapitulatif de
 * taxation, mêmes totaux, même bloc de certification.
 *
 * ══ SUR LA CERTIFICATION ══
 * La note n°2025-0885/MEF/SG/DGI réserve les éléments de certification au
 * Module de Contrôle de Facturation, appareil que la plateforme n'interroge pas
 * encore. Aucune facture ne peut donc porter aujourd'hui un code SECeF valide.
 *
 * Le bloc de certification affiche l'état réel : « certifiée » avec sa référence
 * lorsque le service l'aura renvoyée, « en attente » sinon. Composer un code
 * d'apparence officielle serait une falsification de document fiscal — la
 * contrainte `snp_facture_certification_prouvee`, en base, l'interdit d'ailleurs
 * indépendamment de cet écran.
 */

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

/* ------------------------------------------------------- Montant en lettres */

const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function centaine(nombre: number): string {
  if (nombre < 20) return UNITES[nombre];
  if (nombre < 100) {
    const dizaine = Math.floor(nombre / 10);
    const unite = nombre % 10;
    if (dizaine === 7 || dizaine === 9) {
      if (unite === 1 && dizaine === 7) return 'soixante-et-onze';
      return `${dizaine === 7 ? 'soixante' : 'quatre-vingt'}-${UNITES[10 + unite]}`;
    }
    if (unite === 0) return DIZAINES[dizaine] + (dizaine === 8 ? 's' : '');
    if (unite === 1 && dizaine !== 8) return `${DIZAINES[dizaine]}-et-un`;
    return `${DIZAINES[dizaine]}-${UNITES[unite]}`;
  }
  const cent = Math.floor(nombre / 100);
  const reste = nombre % 100;
  const tete = cent === 1 ? 'cent' : `${UNITES[cent]} cent${reste === 0 ? 's' : ''}`;
  return reste === 0 ? tete : `${tete} ${centaine(reste)}`;
}

function enLettres(valeur: number): string {
  const entier = Math.floor(Math.abs(Number(valeur) || 0));
  if (entier === 0) return 'ZÉRO FRANC CFA';
  const tranches = [
    { valeur: 1_000_000_000, un: 'milliard', plusieurs: 'milliards' },
    { valeur: 1_000_000, un: 'million', plusieurs: 'millions' },
    { valeur: 1_000, un: 'mille', plusieurs: 'mille' },
  ];
  let reste = entier;
  const morceaux: string[] = [];
  tranches.forEach((tranche) => {
    const compte = Math.floor(reste / tranche.valeur);
    if (compte === 0) return;
    reste %= tranche.valeur;
    morceaux.push(
      tranche.valeur === 1_000 && compte === 1 ? 'mille'
        : `${centaine(compte)} ${compte > 1 ? tranche.plusieurs : tranche.un}`
    );
  });
  if (reste > 0) morceaux.push(centaine(reste));
  return `${morceaux.join(' ')} franc${entier > 1 ? 's' : ''} CFA`.toUpperCase();
}

/* ------------------------------------------------------------------ Composant */

export interface FactureAchatResume {
  facture_id: string;
  numero_facture: string;
  achat_numero: string | null;
  periode_debut: string;
  periode_fin: string;
  date_emission: string;
  date_echeance: string;
  montant_ttc: number;
  montant_paye: number;
  montant_engage: number;
  reste_du: number;
  reste_a_affecter: number;
  statut: string;
  statut_certification: string;
}

interface LigneFacture {
  id: string;
  rang: number;
  designation: string;
  quantite: number;
  unite: string;
  titre_pct: number | null;
  prix_unitaire_fcfa: number;
  montant_ht_fcfa: number;
}

interface DetailFacture {
  numero_facture: string;
  date_emission: string;
  date_echeance: string;
  periode_debut: string;
  periode_fin: string;
  quantite_oz: number;
  titre_pct: number | null;
  prix_once_fcfa: number;
  montant_ht_fcfa: number;
  tva_taux: number;
  tva_montant_fcfa: number;
  taxe_dev_comm_taux: number;
  taxe_dev_comm_montant_fcfa: number;
  montant_ttc_fcfa: number;
  montant_paye_fcfa: number;
  conditions_paiement: string;
  statut: string;
  statut_certification: string;
  certification_reference: string | null;
  certification_date: string | null;
  mining_company?: { id: string; name: string; code?: string | null } | null;
}

const LIBELLES_CONDITIONS: Record<string, string> = {
  comptant: 'Comptant',
  differe_30j: 'Virement bancaire à 30 jours',
  differe_60j: 'Virement bancaire à 60 jours',
  differe_90j: 'Virement bancaire à 90 jours',
  echelonne: 'Virement bancaire échelonné',
};

export function FactureAchatApercu({ factureId, onFermer }: {
  factureId: string;
  onFermer: () => void;
}) {
  const [facture, setFacture] = useState<DetailFacture | null>(null);
  const [lignes, setLignes] = useState<LigneFacture[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const [detail, lignesChargees] = await Promise.all([
          achatsIndustrielsService.facture(factureId),
          achatsIndustrielsService.lignesFacture(factureId),
        ]);
        if (!vivant) return;
        setFacture(detail as unknown as DetailFacture);
        setLignes((lignesChargees || []) as LigneFacture[]);
      } catch (raison) {
        if (vivant) setErreur(errorMessage(raison, 'Impossible de composer la facture.'));
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => { vivant = false; };
  }, [factureId]);

  // Échap referme sans toucher à la saisie du formulaire appelant.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  const certifiee = facture?.statut_certification === 'certifiee';
  const netAPayer = facture ? Number(facture.montant_ttc_fcfa) - Number(facture.montant_paye_fcfa || 0) : 0;

  return (
    <div className="facture-achat__voile" role="dialog" aria-modal="true" aria-label="Facture d’achat">
      <div className="facture-achat__cadre">
        <header className="facture-achat__barre">
          <div>
            <h3>{facture?.numero_facture ?? 'Facture d’achat'}</h3>
            <p>
              {facture
                ? `${facture.mining_company?.name ?? ''} · période du ${formatDate(facture.periode_debut)} au ${formatDate(facture.periode_fin)}`
                : 'Chargement…'}
            </p>
          </div>
          <div className="facture-achat__barre-actions">
            <button type="button" className="sn-btn" onClick={() => window.print()} disabled={!facture}>
              <Printer aria-hidden="true" /> Imprimer
            </button>
            <button type="button" className="facture-achat__fermer" aria-label="Fermer la facture" onClick={onFermer}>
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="facture-achat__corps">
          {chargement ? (
            <p className="facture-page__chargement">
              <Loader2 className="sn-spin" aria-hidden="true" /> Composition de la facture…
            </p>
          ) : erreur || !facture ? (
            <p className="facture-achat__erreur" role="alert">
              <AlertTriangle aria-hidden="true" /> {erreur ?? 'Facture introuvable.'}
            </p>
          ) : (
            <article className="facture" aria-label={`Facture d’achat ${facture.numero_facture}`}>
              {!certifiee && <div className="facture__filigrane" aria-hidden="true" />}

              <p className={`facture__bandeau${certifiee ? ' est-certifiee' : ''}`}>
                {certifiee
                  ? `FACTURE CERTIFIÉE — RÉFÉRENCE ${facture.certification_reference}`
                  : 'SPÉCIMEN — FACTURE NON CERTIFIÉE — SANS VALEUR FISCALE'}
              </p>

              <header className="facture__tete">
                <div className="facture__emetteur">
                  <img src="/sonasp_logo.png" alt="SONASP" />
                  <div>
                    <strong>{facture.mining_company?.name ?? 'Société minière'}</strong>
                    <span>Burkina Faso</span>
                    <span>IFU : À renseigner · RCCM : À renseigner</span>
                    <span>Régime d’imposition : À renseigner · Division fiscale : À renseigner</span>
                  </div>
                </div>

                <div className="facture__identite">
                  <h2>Facture N° {facture.numero_facture}</h2>
                  <dl>
                    <div><dt>Date</dt><dd>{formatDate(facture.date_emission)}</dd></div>
                    <div><dt>Achat</dt><dd>{facture.numero_facture.replace('FA-', 'ACH-')}</dd></div>
                    <div><dt>Échéance</dt><dd>{formatDate(facture.date_echeance)}</dd></div>
                  </dl>
                </div>
              </header>

              <section className="facture__client" aria-label="Client">
                <h3>Doit</h3>
                <p className="facture__client-nom">SONASP — Société Nationale des Substances Précieuses</p>
                <p>Ouagadougou, Burkina Faso</p>
                <p>IFU : À renseigner · RCCM : À renseigner</p>
                <p className="facture__objet">
                  <span>Objet :</span> Achat d’or doré auprès d’une société minière industrielle
                </p>
              </section>

              <table className="facture__lignes">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th className="is-num">Qté</th>
                    <th className="is-num">Titre</th>
                    <th className="is-num">P.U.</th>
                    <th className="is-num">Montant HT</th>
                    <th className="is-centre">Groupe</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne) => (
                    <tr key={ligne.id}>
                      <td>{facture.numero_facture}</td>
                      <td>{ligne.designation}</td>
                      <td className="is-num">{decimal.format(Number(ligne.quantite))} {ligne.unite}</td>
                      <td className="is-num">
                        {ligne.titre_pct === null ? '—' : `${decimal.format(Number(ligne.titre_pct))} %`}
                      </td>
                      <td className="is-num">{fcfa.format(Number(ligne.prix_unitaire_fcfa))}</td>
                      <td className="is-num">{fcfa.format(Number(ligne.montant_ht_fcfa))}</td>
                      <td className="is-centre">B</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <section className="facture__bas">
                <div className="facture__colonne">
                  <table className="facture__recap" aria-label="Récapitulatif par groupe de taxation">
                    <thead>
                      <tr>
                        <th>Groupe</th>
                        <th>Régime</th>
                        <th className="is-num">Base HT</th>
                        <th className="is-num">Taux</th>
                        <th className="is-num">Montant TVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>B</td>
                        <td>TVA {decimal.format(Number(facture.tva_taux))} %</td>
                        <td className="is-num">{fcfa.format(Number(facture.montant_ht_fcfa))}</td>
                        <td className="is-num">{decimal.format(Number(facture.tva_taux))} %</td>
                        <td className="is-num">{fcfa.format(Number(facture.tva_montant_fcfa))}</td>
                      </tr>
                    </tbody>
                  </table>

                  <p className="facture__reglement">
                    <span>Mode de règlement :</span>{' '}
                    {LIBELLES_CONDITIONS[facture.conditions_paiement] ?? 'Virement bancaire'}
                  </p>
                </div>

                <dl className="facture__totaux">
                  <div>
                    <dt>Total HT</dt>
                    <dd>{fcfa.format(Number(facture.montant_ht_fcfa))}</dd>
                  </div>
                  <div>
                    <dt>Total TVA</dt>
                    <dd>{fcfa.format(Number(facture.tva_montant_fcfa))}</dd>
                  </div>
                  <div>
                    <dt>Taxe de développement communal ({decimal.format(Number(facture.taxe_dev_comm_taux))} %)</dt>
                    <dd>{fcfa.format(Number(facture.taxe_dev_comm_montant_fcfa))}</dd>
                  </div>
                  <div className="is-sous-total">
                    <dt>Total TTC</dt>
                    <dd>{fcfa.format(Number(facture.montant_ttc_fcfa))}</dd>
                  </div>
                  <div>
                    <dt>Déjà réglé</dt>
                    <dd>{fcfa.format(Number(facture.montant_paye_fcfa || 0))}</dd>
                  </div>
                  <div className="is-net">
                    <dt>Net à payer</dt>
                    <dd>{fcfa.format(netAPayer)} FCFA</dd>
                  </div>
                </dl>
              </section>

              <p className="facture__lettres">
                Arrêtée la présente facture à la somme de <strong>{enLettres(netAPayer)}</strong>.
              </p>

              <section className={`facture__certification${certifiee ? ' est-certifiee' : ''}`}>
                <h3>
                  <AlertTriangle aria-hidden="true" />
                  {certifiee ? 'Certification DGI' : 'Certification DGI — non raccordée'}
                </h3>
                <dl>
                  <div>
                    <dt>Code SECeF</dt>
                    <dd>{facture.certification_reference ?? 'En attente de certification'}</dd>
                  </div>
                  <div>
                    <dt>Date de certification</dt>
                    <dd>{facture.certification_date ? formatDate(facture.certification_date) : '—'}</dd>
                  </div>
                  <div>
                    <dt>État</dt>
                    <dd>
                      {facture.statut_certification === 'certifiee' ? 'Certifiée'
                        : facture.statut_certification === 'echec' ? 'Échec de certification'
                          : 'En attente de certification'}
                    </dd>
                  </div>
                </dl>
                {!certifiee && (
                  <p>
                    Les éléments de certification sont produits par le Module de Contrôle de
                    Facturation, que la plateforme n’interroge pas encore. Cette pièce ne peut être
                    ni remise à un tiers, ni présentée à l’administration.
                  </p>
                )}
              </section>

              <footer className="facture__pied">
                <span>
                  <FileText aria-hidden="true" /> Facture d’achat émise dans le circuit national de
                  traçabilité de l’or.
                </span>
              </footer>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

export default FactureAchatApercu;
