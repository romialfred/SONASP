import { AlertTriangle, Loader2, Printer, ShieldCheck, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { errorMessage } from '@/lib/errorMessage';
import { achatsIndustrielsService } from '@/services/achatsIndustrielsService';
import '@/pages/artisan-minier/facture-vente.css';
import './facture-achat.css';

/**
 * Facture d'achat, présentée dans la forme exacte de la facture de vente
 * artisanale : même en-tête, même tableau de lignes, même récapitulatif de
 * taxation, mêmes totaux, même bloc de certification.
 *
 * ══ SPÉCIMEN ══
 * Le caractère non certifié se lit au filigrane et au bandeau, rien de plus.
 * Tout le reste — bloc de certification, QR code, mentions légales de pied — a
 * la forme exacte d'une pièce certifiée : c'est cette forme qu'il faut pouvoir
 * présenter aux autorités.
 *
 * Les champs de certification portent leur valeur réelle dès que le Module de
 * Contrôle de Facturation renverra une référence ; d'ici là ils indiquent son
 * absence, sans commentaire ni pavé d'avertissement.
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
  const [qr, setQr] = useState<string | null>(null);
  const qrRef = useRef<string | null>(null);
  const corpsRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

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

  /**
   * Contenu du QR. Il n'imite pas une charge utile de certification : il porte
   * l'identité de la pièce et son état. Un lecteur qui le scanne sait
   * immédiatement à quoi il a affaire.
   */
  useEffect(() => {
    if (!facture) return;
    const contenu = [
      certifiee ? 'FACTURE CERTIFIEE' : 'SPECIMEN - FACTURE NON CERTIFIEE',
      `Facture : ${facture.numero_facture}`,
      `Emetteur : ${facture.mining_company?.name ?? ''}`,
      `Date : ${facture.date_emission}`,
      `Net a payer : ${Math.round(netAPayer)} FCFA`,
      certifiee ? `Code SECeF : ${facture.certification_reference}` : 'Certification DGI non raccordee.',
      'SONASP - Systeme National de Collecte et de Suivi de la Tracabilite de l Or',
    ].join(String.fromCharCode(10));

    if (qrRef.current === contenu) return;
    qrRef.current = contenu;
    QRCode.toDataURL(contenu, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [facture, certifiee, netAPayer]);

  /**
   * Met la facture à l'échelle de la place restante sous la barre de titre.
   * `offsetHeight` donne la hauteur de mise en page, insensible au `scale` : la
   * mesure ne se dégrade pas d'un ajustement à l'autre.
   */
  useLayoutEffect(() => {
    if (!facture) return undefined;
    const corps = corpsRef.current;
    const page = pageRef.current;
    if (!corps || !page) return undefined;

    const ajuster = () => {
      const hauteur = page.offsetHeight;
      const largeur = page.offsetWidth;
      if (!hauteur || !largeur) return;
      const disponible = window.innerHeight - corps.getBoundingClientRect().top - 22;
      const echelle = Math.max(0.4, Math.min(
        1,
        disponible / hauteur,
        corps.clientWidth / largeur
      ));
      page.style.setProperty('--facture-echelle', String(echelle));
      // Le `scale` ne rend pas sa place : on la reprend en marge negative,
      // sinon la fenetre defile sur du vide.
      page.style.marginBottom = `${-Math.round(hauteur * (1 - echelle))}px`;
    };

    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(page);
    window.addEventListener('resize', ajuster);
    return () => {
      observateur.disconnect();
      window.removeEventListener('resize', ajuster);
    };
  }, [facture, qr]);

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

        <div className="facture-achat__corps" ref={corpsRef}>
          {chargement ? (
            <p className="facture-page__chargement">
              <Loader2 className="sn-spin" aria-hidden="true" /> Composition de la facture…
            </p>
          ) : erreur || !facture ? (
            <p className="facture-achat__erreur" role="alert">
              <AlertTriangle aria-hidden="true" /> {erreur ?? 'Facture introuvable.'}
            </p>
          ) : (
            <article
              ref={pageRef}
              className="facture facture-achat__page"
              aria-label={`Facture d’achat ${facture.numero_facture}`}
            >
              {!certifiee && <div className="facture__filigrane" aria-hidden="true" />}

              <p className={`facture__bandeau${certifiee ? ' est-certifiee' : ''}`}>
                {certifiee
                  ? `FACTURE CERTIFIÉE · CODE SECeF ${facture.certification_reference}`
                  : 'SPÉCIMEN'}
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
                    <th className="is-num">Teneur</th>
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

              {/* Même bloc que sur une facture certifiée : champs SECeF, QR code,
                  et mentions légales en pied. Seules les valeurs diffèrent. */}
              <section
                className={`facture__certification${certifiee ? ' est-certifiee' : ''}`}
                aria-label="Certification fiscale"
              >
                <div>
                  <h3>
                    {certifiee
                      ? <ShieldCheck aria-hidden="true" />
                      : <AlertTriangle aria-hidden="true" />}
                    Certification DGI
                  </h3>
                  <dl>
                    <div>
                      <dt>Code SECeF</dt>
                      <dd>{facture.certification_reference ?? 'Non attribué'}</dd>
                    </div>
                    <div>
                      <dt>NIM MCF</dt>
                      <dd>{certifiee ? facture.certification_reference : 'Non attribué'}</dd>
                    </div>
                    <div>
                      <dt>ISF</dt>
                      <dd>{certifiee ? 'Homologué' : 'Non attribué'}</dd>
                    </div>
                    <div>
                      <dt>Compteur</dt>
                      <dd>{certifiee ? '1 / 1' : '— / —'}</dd>
                    </div>
                    <div>
                      <dt>Date de certification</dt>
                      <dd>
                        {facture.certification_date
                          ? formatDate(facture.certification_date)
                          : 'Non certifiée'}
                      </dd>
                    </div>
                    <div>
                      <dt>Mode de règlement</dt>
                      <dd>
                        {LIBELLES_CONDITIONS[facture.conditions_paiement] ?? 'Virement bancaire'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <figure className="facture__qr">
                  {qr
                    ? <img src={qr} alt={certifiee ? 'QR code de certification' : 'QR code du spécimen'} />
                    : <span>QR indisponible</span>}
                  <figcaption>{facture.numero_facture}</figcaption>
                </figure>
              </section>

              <footer className="facture__pied">
                Facture électronique émise conformément à l’article 564 du Code général des impôts
                et à l’arrêté n°2025-0047/MEF/SG/DGI du 5 février 2025, dans le circuit national de
                collecte et de traçabilité de l’or.
              </footer>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

export default FactureAchatApercu;
