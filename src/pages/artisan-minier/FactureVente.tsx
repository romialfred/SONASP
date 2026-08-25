import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlertTriangle, ArrowLeft, BadgeCheck, Loader2, Printer, ShieldAlert } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Infobulle, Note, PageHeader } from '@/components/ui/sn';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanMinierService } from '@/services/artisanMinierService';
import { artisanFullName } from '@/utils/artisanIdentity';
import { errorMessage } from '@/lib/errorMessage';
import { composerFacture, type Facture, type PartieFacture } from '@/services/factureVenteService';
import artisanPaiementsService, { type FactureDefinitive } from '@/services/artisanPaiementsService';
import { useAuth } from '@/contexts/AuthContext';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import { useComptoirWorkspace } from '@/hooks/useComptoirWorkspace';
import './facture-vente.css';

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Identité de l'émetteur. Les mentions légales restent à confirmer par la DGI. */
export const VENDEUR_SONASP: PartieFacture = {
  raisonSociale: 'SONASP — Société Nationale des Substances Précieuses',
  adresse: 'Ouagadougou, Burkina Faso',
  ifu: 'À renseigner',
  rccm: 'À renseigner',
  regimeImposition: 'À renseigner',
  divisionFiscale: 'À renseigner',
};

export const formatDate = (valeur: string | null) => {
  if (!valeur) return '—';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

export function FactureVente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useComptoirWorkspace();
  const isComptoir = isComptoirScopedUser(user);

  const [vente, setVente] = useState<ArtisanGoldSale | null>(null);
  const [client, setClient] = useState<PartieFacture | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [factureDefinitive, setFactureDefinitive] = useState<FactureDefinitive | null>(null);
  const qrRef = useRef<string | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setChargement(true);
    setErreur(null);
    try {
      const donnees = await artisanGoldSalesService.getById(id);
      setVente(donnees);
      try {
        const definitive = await artisanPaiementsService.getFactureByVenteId(id);
        setFactureDefinitive(definitive);
      } catch {
        // La compatibilité avec un environnement qui n'a pas encore reçu la
        // migration DGI ne doit pas empêcher la consultation du spécimen.
        setFactureDefinitive(null);
      }

      if (donnees?.artisan_id) {
        try {
          const artisan = await artisanMinierService.getById(donnees.artisan_id);
          setClient(
            artisan
              ? {
                  raisonSociale: artisanFullName(artisan),
                  adresse: [artisan.commune, artisan.region].filter(Boolean).join(', ') || undefined,
                  telephone: artisan.telephone || undefined,
                  ifu: artisan.numero_carte || undefined,
                }
              : null
          );
        } catch {
          // L'identité du vendeur d'or n'est pas bloquante pour l'affichage.
          setClient(null);
        }
      }
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger la vente.'));
      setVente(null);
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const facture: Facture | null = useMemo(() => {
    if (!vente) return null;
    return composerFacture(vente, {
      vendeur: isComptoir
        ? client || { raisonSociale: 'Orpailleur non identifié' }
        : VENDEUR_SONASP,
      client: isComptoir
        ? { raisonSociale: workspace?.name || 'Comptoir d’or', adresse: 'Burkina Faso' }
        : client || { raisonSociale: 'Artisan minier non identifié' },
    });
  }, [vente, client, isComptoir, workspace?.name]);

  useEffect(() => {
    if (!facture) return;
    const contenu = facture.certification.contenuQr;
    if (qrRef.current === contenu) return;
    qrRef.current = contenu;
    QRCode.toDataURL(contenu, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [facture]);

  return (
    <NationalDashboardLayout>
      <div className="sn-page facture-page">
        <PageHeader
          icon={ShieldAlert}
          title={isComptoir ? "Facture DGI de l’achat" : 'Facture de vente'}
          subtitle={factureDefinitive?.certification_dgi_status === 'certified'
            ? `Certification DGI enregistrée — ${factureDefinitive.dgi_reference}`
            : 'Spécimen contrôlé tant que la certification DGI officielle n’est pas enregistrée.'}
          breadcrumb={[
            { label: isComptoir ? 'Achats d’or' : 'Ventes d’or', to: '/artisan-minier/ventes-or' },
            { label: 'Facture' },
          ]}
          actions={
            <>
              <button
                type="button"
                className="sn-btn"
                onClick={() => navigate(`/artisan-minier/ventes-or/${id}`)}
              >
                <ArrowLeft aria-hidden="true" /> Retour à la vente
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => window.print()} disabled={!facture}>
                <Printer aria-hidden="true" /> Imprimer le spécimen
              </button>
            </>
          }
        />

        {factureDefinitive?.certification_dgi_status === 'certified' ? (
          <Note tone="success" icon={BadgeCheck}>
            Certification DGI enregistrée sous la référence <strong>{factureDefinitive.dgi_reference}</strong>.
            Le justificatif DGI associé demeure la pièce fiscale de référence.
          </Note>
        ) : (
          <Note tone="danger" icon={AlertTriangle}>
            <strong>Spécimen sans valeur fiscale.</strong> Ni remise à un client, ni présentée à
            l’administration.
            <Infobulle titre="Pourquoi ce spécimen n’est pas une facture">
              Les éléments de certification (code SECeF, NIM MCF, ISF, compteurs, QR code) sont
              produits par le Module de Contrôle de Facturation, que la plateforme n’interroge pas
              encore ; la plateforme doit elle-même être homologuée comme système de facturation
              d’entreprise.
            </Infobulle>
          </Note>
        )}

        {factureDefinitive && factureDefinitive.certification_dgi_status !== 'certified' && (
          <Note tone="warning" icon={ShieldAlert}>
            La certification DGI est en lecture seule. Le paiement restera bloqué tant que le canal
            sécurisé de dépôt et de vérification DGI n’aura pas rattaché une preuve canonique.
          </Note>
        )}

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        {chargement ? (
          <p className="facture-page__chargement">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement de la vente…
          </p>
        ) : !facture ? (
          <Note tone="warning" icon={AlertTriangle}>
            Vente introuvable : la facture ne peut pas être composée.
          </Note>
        ) : (
          <article className="facture" aria-label={`Facture spécimen ${facture.numero}`}>
            {/* Le texte du filigrane vient de la feuille de style : il tourne dans un
                pseudo-element, sinon sa boite debordait de la facture. */}
            {factureDefinitive?.certification_dgi_status !== 'certified' && (
              <div className="facture__filigrane" aria-hidden="true" />
            )}

            <p className="facture__bandeau">
              {factureDefinitive?.certification_dgi_status === 'certified'
                ? `FACTURE CERTIFIÉE DGI — ${factureDefinitive.dgi_reference}`
                : 'SPÉCIMEN — FACTURE NON CERTIFIÉE — SANS VALEUR FISCALE'}
            </p>

            <header className="facture__tete">
              <div className="facture__emetteur">
                {!isComptoir && <img src="/sonasp_logo.png" alt="SONASP" />}
                <div>
                  <strong>{facture.vendeur.raisonSociale}</strong>
                  <span>{facture.vendeur.adresse}</span>
                  <span>IFU : {facture.vendeur.ifu} · RCCM : {facture.vendeur.rccm}</span>
                  <span>
                    Régime d’imposition : {facture.vendeur.regimeImposition} · Division fiscale :{' '}
                    {facture.vendeur.divisionFiscale}
                  </span>
                </div>
              </div>

              <div className="facture__identite">
                <h2>Facture N° {facture.numero}</h2>
                <dl>
                  <div>
                    <dt>Date</dt>
                    <dd>{formatDate(facture.date)}</dd>
                  </div>
                  <div>
                    <dt>Vente</dt>
                    <dd>{facture.numeroVente}</dd>
                  </div>
                  <div>
                    <dt>Échéance</dt>
                    <dd>{formatDate(facture.echeance)}</dd>
                  </div>
                </dl>
              </div>
            </header>

            <section className="facture__client" aria-label="Acheteur">
              <h3>Acheteur</h3>
              <p className="facture__client-nom">{facture.client.raisonSociale}</p>
              <p>{facture.client.adresse || 'Adresse non renseignée'}</p>
              <p>
                {isComptoir ? 'Établissement : ' : 'Carte professionnelle : '}{facture.client.ifu || workspace?.code || '—'}
                {facture.client.telephone ? ` · ${facture.client.telephone}` : ''}
              </p>
              <p className="facture__objet">
                <span>Objet :</span> {facture.objet}
              </p>
            </section>

            <table className="facture__lignes">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th className="is-num">Qté</th>
                  <th className="is-num">P.U.</th>
                  <th className="is-num">Remise</th>
                  <th className="is-num">Montant HT</th>
                  <th className="is-centre">Groupe</th>
                </tr>
              </thead>
              <tbody>
                {facture.lignes.map((ligne) => (
                  <tr key={`${ligne.reference}-${ligne.designation}`}>
                    <td>{ligne.reference}</td>
                    <td>{ligne.designation}</td>
                    <td className="is-num">
                      {decimal.format(ligne.quantite)} {ligne.unite}
                    </td>
                    <td className="is-num">{fcfa.format(ligne.prixUnitaire)}</td>
                    <td className="is-num">{ligne.remise ? fcfa.format(ligne.remise) : '—'}</td>
                    <td className="is-num">{fcfa.format(ligne.montantHt)}</td>
                    <td className="is-centre">{ligne.groupe}</td>
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
                    {facture.recapGroupes.map((groupe) => (
                      <tr key={groupe.groupe}>
                        <td>{groupe.groupe}</td>
                        <td>{groupe.libelle}</td>
                        <td className="is-num">{fcfa.format(groupe.baseHt)}</td>
                        <td className="is-num">{decimal.format(groupe.taux)} %</td>
                        <td className="is-num">{fcfa.format(groupe.montantTva)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="facture__reglement">
                  <span>Mode de règlement :</span> {facture.modeReglement}
                </p>
              </div>

              <dl className="facture__totaux">
                <div>
                  <dt>Total HT</dt>
                  <dd>{fcfa.format(facture.totalHt)}</dd>
                </div>
                <div>
                  <dt>Total TVA</dt>
                  <dd>{fcfa.format(facture.totalTva)}</dd>
                </div>
                {/* Chaque taxe figure sur une ligne nommée : la facture de référence
                    laissait 3 300 FCFA d'écart entre le TTC et le net à payer sans
                    qu'aucun poste ne l'explique. */}
                {facture.autresTaxes.map((taxe) => (
                  <div key={taxe.libelle}>
                    <dt>{taxe.libelle}</dt>
                    <dd>{fcfa.format(taxe.montant)}</dd>
                  </div>
                ))}
                <div className="is-sous-total">
                  <dt>Total TTC</dt>
                  <dd>{fcfa.format(facture.totalTtc)}</dd>
                </div>
                <div>
                  <dt>Acompte versé</dt>
                  <dd>{fcfa.format(facture.acompte)}</dd>
                </div>
                <div className="is-net">
                  <dt>Net à payer</dt>
                  <dd>{fcfa.format(facture.netAPayer)} FCFA</dd>
                </div>
              </dl>
            </section>

            <p className="facture__lettres">
              Arrêtée la présente facture à la somme de{' '}
              <strong>{facture.montantEnLettres}</strong>.
            </p>

            <section className="facture__certification" aria-label="Certification">
              <div>
                <h3>
                  <ShieldAlert aria-hidden="true" /> Certification DGI — non raccordée
                </h3>
                <dl>
                  <div>
                    <dt>Code SECeF</dt>
                    <dd>{facture.certification.codeSecef}</dd>
                  </div>
                  <div>
                    <dt>NIM MCF</dt>
                    <dd>{facture.certification.nimMcf}</dd>
                  </div>
                  <div>
                    <dt>ISF</dt>
                    <dd>{facture.certification.isf}</dd>
                  </div>
                  <div>
                    <dt>Compteur</dt>
                    <dd>{facture.certification.compteur}</dd>
                  </div>
                  <div>
                    <dt>Date de certification</dt>
                    <dd>{facture.certification.dateCertification}</dd>
                  </div>
                </dl>
                <p>
                  Ces éléments sont délivrés par le Module de Contrôle de Facturation, acquis auprès
                  de la Chambre de Commerce et d’Industrie, après homologation de la plateforme comme
                  système de facturation d’entreprise (note n°2025-0885/MEF/SG/DGI du 29 décembre
                  2025). Aucun n’est produit ici.
                </p>
              </div>

              <figure className="facture__qr">
                {qr ? <img src={qr} alt="QR code du spécimen" /> : <span>QR indisponible</span>}
                <figcaption>Le QR renvoie la mention « spécimen », non une certification.</figcaption>
              </figure>
            </section>

            <footer className="facture__pied">
              Document produit par la plateforme SONASP à des fins de démonstration. Une facture
              électronique certifiée est émise conformément à l’article 564 du CGI et à l’arrêté
              n°2025-0047/MEF/SG/DGI du 05 février 2025 — ce qui n’est pas le cas de la présente
              pièce.
            </footer>
          </article>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default FactureVente;
