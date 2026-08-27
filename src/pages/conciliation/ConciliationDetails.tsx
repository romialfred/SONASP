import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Scale, AlertTriangle, ShieldCheck, FlaskConical, ArrowLeftRight, ArrowLeft,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  PageHeader, Section, Field, DataTable, Badge, Note, StatGrid, FormActions,
  type Column, type BadgeTone,
} from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { hasCapability, CAPABILITIES } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import { DossierComplet } from '@/components/dossier/DossierComplet';
import {
  conciliationService, LIBELLES_STATUTS_CONCILIATION, LIBELLES_PARAMETRES,
  type Conciliation, type EcartConciliation, type StatutConciliation,
} from '@/services/conciliationService';

const TONE_STATUT: Record<StatutConciliation, BadgeTone> = {
  en_attente_analyse: 'warning',
  analyse_recue: 'info',
  calculee: 'info',
  ecart_a_verifier: 'warning',
  en_attente_validation: 'warning',
  contestee: 'danger',
  validee: 'success',
  facture_definitive_generee: 'success',
  cloturee: 'neutral',
  annulee: 'neutral',
};

const ETATS_SAISIE: StatutConciliation[] = ['en_attente_analyse', 'analyse_recue', 'contestee'];
const ETATS_VALIDATION: StatutConciliation[] = ['analyse_recue', 'calculee', 'en_attente_validation', 'ecart_a_verifier'];

function nombre(valeur: number | null, decimales = 2): string {
  if (valeur === null) return '-';
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function ConciliationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dossier, setDossier] = useState<Conciliation | null>(null);
  const [ecarts, setEcarts] = useState<EcartConciliation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [poids, setPoids] = useState('');
  const [teneur, setTeneur] = useState('');
  const [prix, setPrix] = useState('');
  const [dateFixing, setDateFixing] = useState(new Date().toISOString().slice(0, 10));
  const [certificatId, setCertificatId] = useState('');

  const peutSaisir = hasCapability(user, CAPABILITIES.RECONCILIATION_EDIT);
  const peutValider = hasCapability(user, CAPABILITIES.RECONCILIATION_APPROVE);

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      setChargement(true);
      setErreur(null);
      const [fiche, lignes] = await Promise.all([
        conciliationService.parIdentifiant(id),
        conciliationService.ecarts(id),
      ]);
      setDossier(fiche);
      setEcarts(lignes);
      if (fiche) {
        setPoids(fiche.poids_final_g?.toString() ?? '');
        setTeneur(fiche.teneur_finale_pct?.toString() ?? '');
        setPrix(fiche.prix_final?.toString() ?? fiche.prix_initial?.toString() ?? '');
        setCertificatId(fiche.assay_certificate_id ?? '');
      }
    } catch (error) {
      setErreur(errorMessage(error, 'Le dossier n’a pas pu être chargé.'));
    } finally {
      setChargement(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const indicateurs = useMemo(() => {
    if (!dossier) return [];
    const ecart = dossier.ca_final !== null && dossier.ca_initial !== null
      ? dossier.ca_final - dossier.ca_initial
      : null;
    return [
      { label: 'Valeur déclarée', value: nombre(dossier.ca_initial), icon: ArrowLeftRight },
      { label: 'Valeur définitive', value: nombre(dossier.ca_final), icon: ShieldCheck },
      {
        label: 'Écart',
        value: ecart === null ? '-' : `${ecart > 0 ? '+' : ''}${nombre(ecart)}`,
        hint: ecart === null ? "en attente d'analyse" : ecart < 0 ? 'trop-perçu client' : ecart > 0 ? 'reliquat à recevoir' : 'aucun écart',
        icon: Scale,
        tone: (ecart === null ? 'neutral' : ecart < 0 ? 'red' : ecart > 0 ? 'green' : 'neutral') as const,
      },
      { label: "Or fin reconnu", value: dossier.or_fin_final_g === null ? '-' : `${nombre(dossier.or_fin_final_g, 4)} g`, icon: FlaskConical },
    ];
  }, [dossier]);

  const enregistrerAnalyse = async () => {
    if (!dossier) return;
    const p = Number(poids.replace(',', '.'));
    const t = Number(teneur.replace(',', '.'));
    const pr = Number(prix.replace(',', '.'));

    if (!Number.isFinite(p) || p <= 0) { setErreur('Le poids final doit être un nombre positif.'); return; }
    if (!Number.isFinite(t) || t <= 0 || t > 100) { setErreur('La teneur doit être comprise entre 0 et 100 %.'); return; }
    if (!Number.isFinite(pr) || pr <= 0) { setErreur('Le prix retenu doit être un nombre positif.'); return; }
    if (!certificatId.trim()) { setErreur('La référence du certificat d’analyse est requise : sans preuve, la validation sera refusée.'); return; }

    try {
      setEnCours(true);
      setErreur(null);
      const resultat = await conciliationService.enregistrerAnalyse({
        conciliationId: dossier.id,
        sourceType: 'certificat_acheteur',
        sourceId: certificatId.trim(),
        poidsFinalG: p,
        teneurFinalePct: t,
        prixFinal: pr,
        dateFixing,
      });
      setMessage(`Résultat enregistré : ${nombre(resultat.or_fin_final_g, 4)} g d’or fin, valeur définitive ${nombre(resultat.ca_final)}.`);
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'Le résultat n’a pas pu être enregistré.'));
    } finally {
      setEnCours(false);
    }
  };

  const valider = async () => {
    if (!dossier) return;
    try {
      setEnCours(true);
      setErreur(null);
      const resultat = await conciliationService.valider(dossier.id);
      const sansRegle = resultat.taxes_sans_regle ?? [];
      setMessage(
        `Dossier ${resultat.reference} validé. Écart commercial : ${nombre(resultat.ecart_commercial)}.` +
        (sansRegle.length > 0
          ? ` Aucune règle en vigueur pour : ${sansRegle.join(', ')} — ces taxes n’ont pas été ajustées.`
          : '') +
        (resultat.sans_second_regard
          ? ' Vous avez préparé et validé ce dossier : la validation est enregistrée sans second regard.'
          : ''),
      );
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'La validation a été refusée.'));
    } finally {
      setEnCours(false);
    }
  };

  const colonnesEcarts: Column<EcartConciliation>[] = [
    {
      key: 'parametre',
      header: 'Paramètre',
      render: (e) => (
        <div>
          <div style={{ fontWeight: 600 }}>{LIBELLES_PARAMETRES[e.parametre] ?? e.parametre}</div>
          {e.code_taxe && <div className="sn-muted" style={{ fontSize: 12 }}>{e.code_taxe}</div>}
        </div>
      ),
    },
    { key: 'valeur_initiale', header: 'Déclaré', numeric: true, render: (e) => nombre(e.valeur_initiale) },
    { key: 'valeur_definitive', header: 'Définitif', numeric: true, render: (e) => nombre(e.valeur_definitive) },
    {
      key: 'ecart_absolu',
      header: 'Écart',
      numeric: true,
      render: (e) => {
        if (e.ecart_absolu === null) return '-';
        const positif = e.ecart_absolu > 0;
        return (
          <span style={{ color: e.ecart_absolu === 0 ? undefined : positif ? 'var(--sn-success, #0f7a56)' : 'var(--sn-danger, #b3261e)', fontWeight: 600 }}>
            {positif ? '+' : ''}{nombre(e.ecart_absolu)}
          </span>
        );
      },
    },
    {
      key: 'depasse_seuil',
      header: 'Seuil',
      render: (e) => e.depasse_seuil
        ? <Badge tone="danger">dépassé</Badge>
        : <span className="sn-muted">dans la tolérance</span>,
    },
  ];

  if (!chargement && !dossier) {
    return (
      <NationalDashboardLayout>
        <PageHeader title="Dossier introuvable" icon={Scale} breadcrumb={[{ label: 'Conciliation', to: '/conciliation' }]} />
        <Note tone="danger" icon={AlertTriangle}>Ce dossier de conciliation n’existe pas ou ne vous est pas accessible.</Note>
      </NationalDashboardLayout>
    );
  }

  const saisiePossible = dossier ? ETATS_SAISIE.includes(dossier.statut) : false;
  const validationPossible = dossier ? ETATS_VALIDATION.includes(dossier.statut) && dossier.ca_final !== null : false;

  return (
    <NationalDashboardLayout>
      <PageHeader
        title={dossier?.reference ?? 'Conciliation'}
        subtitle={dossier ? LIBELLES_STATUTS_CONCILIATION[dossier.statut] : 'Chargement…'}
        icon={Scale}
        breadcrumb={[{ label: 'Conciliation', to: '/conciliation' }, { label: dossier?.reference ?? '…' }]}
        actions={(
          <button type="button" className="sn-btn sn-btn--ghost" onClick={() => navigate('/conciliation')}>
            <ArrowLeft aria-hidden="true" /> Retour à la liste
          </button>
        )}
        aside={dossier ? <Badge tone={TONE_STATUT[dossier.statut]}>{LIBELLES_STATUTS_CONCILIATION[dossier.statut]}</Badge> : undefined}
      />

      {indicateurs.length > 0 && <StatGrid items={indicateurs} ariaLabel="Synthèse du dossier" sober />}

      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
      {message && <Note tone="success">{message}</Note>}

      <Section
        id="donnees-initiales"
        icon={ArrowLeftRight}
        title="Valeurs déclarées"
        description="Reprises de la vente à l’ouverture du dossier. Elles ne se ressaisissent pas."
      >
        <div className="sn-grid sn-grid--3">
          <Field label="Prix retenu à la vente"><input className="sn-input" value={nombre(dossier?.prix_initial ?? null)} readOnly /></Field>
          <Field label="Devise"><input className="sn-input" value={dossier?.devise_initiale ?? '-'} readOnly /></Field>
          <Field label="Chiffre d’affaires déclaré"><input className="sn-input" value={nombre(dossier?.ca_initial ?? null)} readOnly /></Field>
        </div>
      </Section>

      {peutSaisir && saisiePossible && (
        <Section
          id="resultat-acheteur"
          icon={FlaskConical}
          title="Résultat de l’acheteur"
          description="L’or fin se déduit du poids et de la teneur ; la valeur définitive s’en déduit au cours retenu, converti à l’once troy."
        >
          <div className="sn-grid sn-grid--2">
            <Field label="Poids final" required hint="En grammes, tel que mesuré par le laboratoire.">
              <input className="sn-input" inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} placeholder="3110,35" />
            </Field>
            <Field label="Teneur finale" required hint="En pourcentage, entre 0 et 100.">
              <input className="sn-input" inputMode="decimal" value={teneur} onChange={(e) => setTeneur(e.target.value)} placeholder="88" />
            </Field>
            <Field label="Prix retenu" required hint="Par once troy, selon la méthode prévue au contrat.">
              <input className="sn-input" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="2000" />
            </Field>
            <Field label="Date de fixing" required>
              <input type="date" className="sn-input" value={dateFixing} onChange={(e) => setDateFixing(e.target.value)} />
            </Field>
            <Field label="Certificat d’analyse" required wide hint="Référence du certificat déposé. Sans preuve, la validation est refusée.">
              <input className="sn-input" value={certificatId} onChange={(e) => setCertificatId(e.target.value)} placeholder="Identifiant du certificat" />
            </Field>
          </div>
          <FormActions>
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void enregistrerAnalyse()} disabled={enCours}>
              {enCours ? 'Enregistrement…' : 'Enregistrer le résultat'}
            </button>
          </FormActions>
        </Section>
      )}

      <Section
        id="ecarts"
        icon={Scale}
        title="Comparaison"
        description="Les écarts sont établis à la validation, taxe par taxe lorsqu’un barème est en vigueur."
      >
        {ecarts.length === 0 ? (
          <Note tone="info">
            Aucun écart calculé pour l’instant. Ils sont produits par la validation du dossier.
          </Note>
        ) : (
          <DataTable columns={colonnesEcarts} rows={ecarts} caption="Écarts constatés" empty="Aucun écart" />
        )}
      </Section>

      {peutValider && validationPossible && (
        <Section
          id="validation"
          icon={ShieldCheck}
          title="Validation"
          description="En une seule opération : l’ajustement commercial, les ajustements fiscaux et la trace d’audit. Un échec annule l’ensemble."
        >
          <Note tone="warning" icon={AlertTriangle}>
            La validation revient à un autre acteur que celui qui a préparé le dossier. Une fois validé,
            il ne se modifie plus : toute correction ouvre une nouvelle version.
          </Note>
          <FormActions>
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void valider()} disabled={enCours}>
              {enCours ? 'Validation…' : 'Valider les valeurs définitives'}
            </button>
          </FormActions>
        </Section>
      )}
      {id && <DossierComplet type="conciliation" id={id} />}

    </NationalDashboardLayout>
  );
}

export default ConciliationDetails;
