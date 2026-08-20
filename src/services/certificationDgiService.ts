import { supabase } from '@/lib/supabase';

/**
 * Certification fiscale des factures d'achat — point de raccordement à la DGI.
 *
 * ══ CE QUI EXISTE ET CE QUI MANQUE ══
 *
 * La note de service n°2025-0885/MEF/SG/DGI du 29 décembre 2025 réserve les
 * éléments de certification — code SECeF, NIM MCF, compteurs, QR code — au
 * **Module de Contrôle de Facturation**, appareil acquis auprès de la Chambre de
 * Commerce et d'Industrie. La plateforme, en tant que système de facturation
 * d'entreprise, doit en outre être homologuée et recevoir un ISF.
 *
 * Aucune de ces deux conditions n'est remplie dans cet environnement. Ce service
 * en tire la seule conséquence honnête : **il ne certifie rien**. Il compose la
 * requête, la soumet au point d'accès configuré, et enregistre ce qui revient.
 * Sans point d'accès configuré, il inscrit un échec motivé.
 *
 * Fabriquer un code d'apparence officielle serait une falsification de document
 * fiscal. La contrainte `snp_facture_certification_prouvee`, en base, interdit
 * d'ailleurs qu'une facture se dise certifiée sans porter la référence et la
 * date renvoyées par le service : même une erreur de programmation ici ne
 * pourrait pas produire une fausse certification.
 *
 * ══ CE QU'IL RESTE À CONFIGURER ══
 *   VITE_DGI_SECEF_URL   point d'accès du service de certification
 *   VITE_DGI_SECEF_NIM   numéro d'identification du module (NIM MCF)
 *   VITE_DGI_SECEF_ISF   identifiant du système de facturation homologué
 *
 * Le reste du module fonctionne sans : une facture non certifiée reste
 * exigible, se règle et s'impute normalement. Seule sa valeur fiscale est
 * suspendue, et l'écran le dit.
 */

export type ResultatCertification =
  | { statut: 'certifiee'; reference: string; certifieeLe: string; message: string }
  | { statut: 'echec'; code: string; message: string };

interface ConfigurationDgi {
  url: string | null;
  nim: string | null;
  isf: string | null;
}

/** Lecture de la configuration. Aucune valeur par défaut : l'absence doit se voir. */
export function lireConfiguration(): ConfigurationDgi {
  const environnement = import.meta.env as Record<string, string | undefined>;
  return {
    url: environnement.VITE_DGI_SECEF_URL?.trim() || null,
    nim: environnement.VITE_DGI_SECEF_NIM?.trim() || null,
    isf: environnement.VITE_DGI_SECEF_ISF?.trim() || null,
  };
}

export function estRaccordee(): boolean {
  const configuration = lireConfiguration();
  return Boolean(configuration.url && configuration.nim && configuration.isf);
}

export const MOTIF_NON_RACCORDEE =
  'Le module de contrôle de facturation de la DGI n’est pas raccordé : ' +
  'point d’accès, NIM et ISF ne sont pas configurés.';

/**
 * Empreinte de la requête, et non son contenu.
 * Le journal de certification est consultable ; y déposer les montants et les
 * identifiants fiscaux en clair serait une fuite inutile. L'empreinte suffit à
 * prouver, en cas de contrôle, que la requête soumise est bien celle-ci.
 */
export async function empreinte(charge: unknown): Promise<string> {
  const texte = JSON.stringify(charge);
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Environnement sans WebCrypto : on préfère l'absence d'empreinte à une
    // empreinte faible qui donnerait une fausse assurance.
    return `len:${texte.length}`;
  }
  const condensat = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(condensat))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('');
}

interface FactureACertifier {
  id: string;
  numero_facture: string;
  date_emission: string;
  montant_ht_fcfa: number;
  tva_montant_fcfa: number;
  montant_ttc_fcfa: number;
  devise: string;
}

const prochaineTentative = async (factureId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('snp_factures_certification')
    .select('tentative')
    .eq('facture_id', factureId)
    .order('tentative', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.tentative ?? 0) + 1;
};

/**
 * Demande la certification d'une facture.
 *
 * Chaque tentative laisse une trace, réussie ou non : c'est cette trace qui
 * permettra, le jour du raccordement, de reprendre les factures restées en
 * attente et de justifier les délais auprès de l'administration.
 */
export async function certifier(facture: FactureACertifier): Promise<ResultatCertification> {
  const configuration = lireConfiguration();
  const tentative = await prochaineTentative(facture.id);

  const charge = {
    numero: facture.numero_facture,
    date: facture.date_emission,
    ht: facture.montant_ht_fcfa,
    tva: facture.tva_montant_fcfa,
    ttc: facture.montant_ttc_fcfa,
    devise: facture.devise,
    nim: configuration.nim,
    isf: configuration.isf,
  };
  const trace = await empreinte(charge);

  const journaliser = async (
    code: string, message: string, reference?: string, certifieeLe?: string, erreur?: string
  ) => {
    const { data: session } = await supabase.auth.getUser();
    await supabase.from('snp_factures_certification').insert([{
      facture_id: facture.id,
      tentative,
      fournisseur: 'DGI-SECeF',
      requete_empreinte: trace,
      reponse_code: code,
      reponse_message: message,
      certification_reference: reference ?? null,
      certifiee_le: certifieeLe ?? null,
      erreur_technique: erreur ?? null,
      declenche_par: session?.user?.id ?? null,
    }]);
  };

  if (!estRaccordee()) {
    await journaliser('NON_RACCORDEE', MOTIF_NON_RACCORDEE);
    await supabase
      .from('snp_factures_achat')
      .update({ statut_certification: 'echec' })
      .eq('id', facture.id);
    return { statut: 'echec', code: 'NON_RACCORDEE', message: MOTIF_NON_RACCORDEE };
  }

  try {
    const reponse = await fetch(configuration.url as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(charge),
    });

    const corps = (await reponse.json().catch(() => null)) as
      | { reference?: string; certifie_le?: string; message?: string; code?: string }
      | null;

    // Une réponse sans référence n'est pas une certification, quel que soit son
    // code : la facture reste non certifiée.
    if (!reponse.ok || !corps?.reference) {
      const message = corps?.message || `Réponse ${reponse.status} du service de certification.`;
      await journaliser(corps?.code || String(reponse.status), message);
      await supabase
        .from('snp_factures_achat')
        .update({ statut_certification: 'echec' })
        .eq('id', facture.id);
      return { statut: 'echec', code: corps?.code || String(reponse.status), message };
    }

    const certifieeLe = corps.certifie_le || new Date().toISOString();
    await journaliser('OK', corps.message || 'Facture certifiée.', corps.reference, certifieeLe);
    await supabase
      .from('snp_factures_achat')
      .update({
        statut_certification: 'certifiee',
        certification_reference: corps.reference,
        certification_date: certifieeLe,
        statut: 'certifiee',
      })
      .eq('id', facture.id);

    return {
      statut: 'certifiee',
      reference: corps.reference,
      certifieeLe,
      message: corps.message || 'Facture certifiée par le service fiscal.',
    };
  } catch (raison) {
    const message = raison instanceof Error ? raison.message : 'Service de certification injoignable.';
    await journaliser('ERREUR_TECHNIQUE', 'Service de certification injoignable.', undefined, undefined, message);
    await supabase
      .from('snp_factures_achat')
      .update({ statut_certification: 'echec' })
      .eq('id', facture.id);
    return { statut: 'echec', code: 'ERREUR_TECHNIQUE', message };
  }
}

/** Historique des tentatives d'une facture, pour l'écran de suivi et l'audit. */
export async function tentatives(factureId: string) {
  const { data, error } = await supabase
    .from('snp_factures_certification')
    .select('*')
    .eq('facture_id', factureId)
    .order('tentative', { ascending: false });
  if (error) throw error;
  return data || [];
}

export const certificationDgiService = { certifier, tentatives, estRaccordee, lireConfiguration };
