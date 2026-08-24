import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { coquille, echapper, faits as bloqueFaits, bouton, paragraphe } from './gabarit.ts';
import { reponseJson, reponsePrevol } from '../_shared/cors.ts';
import { niveauAssurance } from '../_shared/assurance.ts';
import { origineApplication } from '../_shared/application-url.ts';
import {
  normalizeMailAction,
  requiredCapabilityForMailAction,
} from '../_shared/mail-action-policy.ts';

/**
 * Envoi des courriels de la plateforme SONASP.
 *
 * ══ POURQUOI UNE FONCTION DE BORD ══
 *
 * Medicore envoie ses courriels depuis ses routes Next.js, avec nodemailer.
 * SONASP n'a pas de serveur : le navigateur parle directement à PostgREST. Un
 * mot de passe SMTP placé dans le paquet du navigateur serait lisible par
 * n'importe quel visiteur, et nodemailer ne fonctionne de toute façon pas dans
 * un navigateur — il lui faut une socket TCP.
 *
 * Cette fonction s'exécute sur Deno, côté Supabase, avec la clé de service.
 * C'est le seul endroit de la plateforme où le secret SMTP est lisible.
 *
 * ══ DEUX USAGES ══
 *
 *   { action: 'file' }            vide la file d'attente des notifications ;
 *   { action: 'test', to: '…' }   éprouve la configuration et rend l'erreur SMTP
 *                                 telle quelle, pour qu'on puisse la corriger.
 *
 * L'appel est réservé aux agents habilités : le jeton de l'appelant est vérifié
 * avant tout envoi. Sans cela, n'importe qui pourrait faire partir des courriels
 * au nom de l'Administration SONASP.
 */

const URL_APPLICATION = origineApplication(Deno.env.get('SONASP_APP_URL'));

interface ConfigurationCourriel {
  uid: string | null;
  hote: string;
  port: number;
  securise: boolean;
  identifiant: string;
  motDePasse: string;
  expediteurCourriel: string;
  expediteurNom: string;
}

/**
 * Configuration effective : le jeu ACTIF de la table d'abord, les variables
 * d'environnement en repli.
 *
 * La table permet de corriger un serveur depuis l'écran d'administration sans
 * redéployer, et d'en préparer un second sans couper le premier. Les variables
 * d'environnement permettent de démarrer avant qu'aucun jeu ne soit saisi.
 *
 * `snp_configuration_courriel_active` ne rend que des jeux complets : un jeu
 * sans mot de passe ne remonte pas, et l'on retombe alors sur l'environnement
 * plutôt que d'échouer à la connexion.
 */
async function chargerConfiguration(
  admin: ReturnType<typeof createClient>,
): Promise<ConfigurationCourriel | null> {
  let ligne: Record<string, unknown> | null = null;
  try {
    const { data } = await admin.rpc('snp_configuration_courriel_active');
    ligne = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  } catch {
    // Fonction absente : on retombe sur l'environnement.
  }

  const hote = (ligne?.hote as string) || Deno.env.get('SONASP_SMTP_HOST') || '';
  const identifiant = (ligne?.identifiant as string) || Deno.env.get('SONASP_SMTP_USER') || '';
  const motDePasse = (ligne?.mot_de_passe as string) || Deno.env.get('SONASP_SMTP_PASS') || '';
  const port = Number(ligne?.port ?? Deno.env.get('SONASP_SMTP_PORT') ?? 465);
  const securise = ligne?.securise ?? (Deno.env.get('SONASP_SMTP_SECURE') ?? 'true') !== 'false';
  const expediteurCourriel = (ligne?.expediteur_courriel as string)
    || Deno.env.get('SONASP_SMTP_FROM_EMAIL') || identifiant;
  // L'expéditeur affiché est celui que la SONASP présente à ses partenaires.
  const expediteurNom = (ligne?.expediteur_nom as string)
    || Deno.env.get('SONASP_SMTP_FROM_NAME') || 'Administration SONASP';

  if (!hote || !identifiant || !motDePasse) return null;
  return {
    uid: (ligne?.uid as string) ?? null,
    hote, port, securise: Boolean(securise), identifiant, motDePasse,
    expediteurCourriel, expediteurNom,
  };
}

/**
 * Client SMTP borné dans le temps.
 *
 * Sans délai, un serveur simplement lent — pas en erreur — ferait expirer la
 * fonction après l'écriture en base : la file resterait marquée « en attente »
 * pour des messages peut-être partis. La borne rend l'échec net et rejouable.
 */
async function ouvrirClient(cfg: ConfigurationCourriel): Promise<SMTPClient> {
  const client = new SMTPClient({
    connection: {
      hostname: cfg.hote,
      port: cfg.port,
      tls: cfg.securise,
      auth: { username: cfg.identifiant, password: cfg.motDePasse },
    },
    debug: { encodeLB: true },
  });
  return client;
}

function adresseExpediteur(cfg: ConfigurationCourriel): string {
  return `${cfg.expediteurNom} <${cfg.expediteurCourriel}>`;
}

function lienRecuperationValide(valeur: string): boolean {
  try {
    const url = new URL(valeur);
    return url.origin === URL_APPLICATION
      && url.pathname === '/modifier-mot-de-passe'
      && url.searchParams.get('type') === 'recovery'
      && Boolean(url.searchParams.get('token_hash'));
  } catch {
    return false;
  }
}

interface Courriel {
  destinataire: string;
  objet: string;
  titre: string;
  corps: string;
  faits?: { label: string; valeur: string }[];
  cheminAction?: string | null;
  libelleAction?: string;
}

function composer(courriel: Courriel): { html: string; texte: string } {
  const url = courriel.cheminAction
    ? (courriel.cheminAction.startsWith('http')
      ? courriel.cheminAction
      : `${URL_APPLICATION}${courriel.cheminAction}`)
    : null;

  const faitsTexte = (courriel.faits ?? [])
    .map((f) => `${f.label} : ${f.valeur}`).join('\n');

  const texte = [
    courriel.titre,
    '',
    courriel.corps,
    faitsTexte ? `\n${faitsTexte}` : '',
    url ? `\n${courriel.libelleAction ?? 'Ouvrir dans la plateforme'} : ${url}` : '',
    '\nCe message vous est adressé automatiquement par la plateforme nationale de collecte et de traçabilité de l’or.',
    '\nAdministration SONASP',
  ].filter(Boolean).join('\n');

  const corpsHtml = [
    paragraphe(courriel.corps),
    bloqueFaits(courriel.faits ?? []),
    url ? bouton(url, courriel.libelleAction ?? 'Ouvrir dans la plateforme') : '',
  ].filter(Boolean).join('');

  return {
    html: coquille({
      titre: echapper(courriel.titre),
      corps: corpsHtml,
      origineApplication: URL_APPLICATION,
    }),
    texte,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return reponsePrevol(req);
  if (req.method !== 'POST') return reponseJson(req, { erreur: 'Méthode non autorisée.' }, 405);

  const json = (corps: unknown, statut = 200) => reponseJson(req, corps, statut);

  try {
    const urlSupabase = Deno.env.get('SUPABASE_URL')!;
    const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cleAnon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!urlSupabase || !cleService || !cleAnon) {
      return json({ erreur: 'Le service de messagerie est indisponible.' }, 503);
    }
    const admin = createClient(urlSupabase, cleService);

    // L'appelant doit être un agent habilité. Sans ce contrôle, n'importe qui
    // ferait partir des courriels au nom de l'Administration SONASP.
    const autorisation = req.headers.get('Authorization') ?? '';
    const jeton = autorisation.replace(/^Bearer\s+/i, '');
    if (!jeton) return json({ erreur: 'Session absente.' }, 401);

    const { data: utilisateur } = await admin.auth.getUser(jeton);
    if (!utilisateur?.user) return json({ erreur: 'Session invalide.' }, 401);

    const requete = await req.json().catch(() => ({}));
    const action = normalizeMailAction(requete?.action);
    if (!action) return json({ erreur: 'Action de messagerie inconnue.' }, 400);

    const { data: profil } = await admin
      .from('user_profiles')
      .select('is_active, mining_company_id, mfa_enrolled_at')
      .eq('id', utilisateur.user.id)
      .maybeSingle();

    const habilite = profil?.is_active
      && profil?.mining_company_id === null
      && Boolean(profil?.mfa_enrolled_at)
      && niveauAssurance(jeton) === 'aal2';
    if (!habilite) return json({ erreur: 'Habilitation insuffisante.' }, 403);

    const clientActeur = createClient(urlSupabase, cleAnon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: autorisation } },
    });
    const capaciteRequise = requiredCapabilityForMailAction(action);
    const { data: possedeCapacite, error: erreurCapacite } = await clientActeur
      .rpc('snp_actor_has_capability', { p_capability_code: capaciteRequise });
    if (erreurCapacite) {
      console.error('[envoyer-courriel] Capacité indisponible.', erreurCapacite.message);
      return json({ erreur: 'La vérification des habilitations est indisponible.' }, 503);
    }
    if (possedeCapacite !== true) return json({ erreur: 'Habilitation insuffisante.' }, 403);

    const cfg = await chargerConfiguration(admin);
    if (!cfg) {
      return json({
        erreur: 'La messagerie n’est pas configurée : serveur, identifiant ou mot de passe manquant.',
      }, 400);
    }

    /* --------------------------------------------------------- Bienvenue -- */
    if (action === 'bienvenue') {
      const destinataire = String(requete?.to ?? '').trim().toLowerCase();
      const nomComplet = String(requete?.nom_complet ?? '').trim().slice(0, 160);
      const lienActivation = String(requete?.lien_activation ?? '').trim();
      const role = String(requete?.role ?? '').trim().slice(0, 40);
      if (!destinataire || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
        return json({ erreur: 'Adresse de destination invalide.' }, 400);
      }

      // Le bouton d'activation doit toujours revenir du serveur Auth SONASP.
      // Un administrateur ne peut ainsi transformer cette fonction en relais
      // de hameçonnage vers une adresse arbitraire.
      if (!lienRecuperationValide(lienActivation)) {
        return json({ erreur: 'Lien d’activation non reconnu.' }, 400);
      }

      const libellesRole: Record<string, string> = {
        owner: 'Propriétaire', admin: 'Administrateur', management: 'Direction',
        manager: 'Responsable', mine: 'Société minière', factory: 'Usine',
        airport: 'Aéroport', refinery: 'Raffinerie', customer: 'Client',
        comptoir: 'Comptoir d’achat',
      };
      const client = await ouvrirClient(cfg);
      try {
        const { html, texte } = composer({
          destinataire,
          objet: 'Votre accès à la plateforme SONASP',
          titre: 'Bienvenue sur la plateforme SONASP',
          corps: `Bonjour ${nomComplet || destinataire}, votre compte a été préparé. Définissez maintenant votre mot de passe personnel à l’aide du lien sécurisé ci-dessous. L’enrôlement du second facteur sera ensuite obligatoire avant tout accès aux données.`,
          faits: [
            { label: 'Identifiant', valeur: destinataire },
            { label: 'Profil', valeur: libellesRole[role] ?? role },
            { label: 'Sécurité', valeur: 'Mot de passe personnel puis authentification à deux facteurs' },
          ],
          cheminAction: lienActivation,
          libelleAction: 'Définir mon mot de passe',
        });
        await client.send({
          from: adresseExpediteur(cfg), to: destinataire,
          subject: 'Votre accès à la plateforme SONASP',
          content: texte, html,
        });
        await client.close();
        return json({ envoye: true, destinataire });
      } catch (erreur) {
        await client.close().catch(() => {});
        const message = erreur instanceof Error ? erreur.message : 'échec SMTP';
        console.error('[envoyer-courriel] Bienvenue non envoyée.', message);
        return json({ envoye: false, erreur: 'Le courriel de bienvenue n’a pas pu être envoyé.' }, 502);
      }
    }

    /* ----------------------------------------------- Réinitialisation -- */
    if (action === 'reinitialisation') {
      const destinataire = String(requete?.to ?? '').trim().toLowerCase();
      const nomComplet = String(requete?.nom_complet ?? '').trim().slice(0, 160);
      const lienActivation = String(requete?.lien_activation ?? '').trim();
      if (!destinataire || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
        return json({ erreur: 'Adresse de destination invalide.' }, 400);
      }
      if (!lienRecuperationValide(lienActivation)) {
        return json({ erreur: 'Lien de récupération non reconnu.' }, 400);
      }

      const client = await ouvrirClient(cfg);
      try {
        const { html, texte } = composer({
          destinataire,
          objet: 'Réinitialisation de votre accès SONASP',
          titre: 'Définissez un nouveau mot de passe',
          corps: `Bonjour ${nomComplet || destinataire}, un administrateur a ouvert une procédure de récupération pour votre compte. Utilisez le lien sécurisé ci-dessous. Si vous n’attendiez pas ce message, contactez immédiatement l’administration SONASP.`,
          faits: [
            { label: 'Compte', valeur: destinataire },
            { label: 'Protection', valeur: 'Lien temporaire à usage limité' },
            { label: 'Étape suivante', valeur: 'Vérification du second facteur obligatoire' },
          ],
          cheminAction: lienActivation,
          libelleAction: 'Choisir un nouveau mot de passe',
        });
        await client.send({
          from: adresseExpediteur(cfg), to: destinataire,
          subject: 'Réinitialisation de votre accès SONASP',
          content: texte, html,
        });
        await client.close();
        return json({ envoye: true, destinataire });
      } catch (erreur) {
        await client.close().catch(() => {});
        console.error('[envoyer-courriel] Récupération non envoyée.', erreur instanceof Error ? erreur.message : erreur);
        return json({ envoye: false, erreur: 'Le courriel de récupération n’a pas pu être envoyé.' }, 502);
      }
    }

    /* ------------------------------------------------------------- Essai -- */
    if (action === 'test') {
      const destinataire = String(requete?.to ?? utilisateur.user.email ?? '');
      if (!destinataire) return json({ erreur: 'Destinataire manquant.' }, 400);

      const client = await ouvrirClient(cfg);
      try {
        const { html, texte } = composer({
          destinataire,
          objet: 'Vérification de la messagerie SONASP',
          titre: 'La messagerie fonctionne',
          corps: 'Ce message confirme que la plateforme peut adresser des courriels depuis ce serveur.',
          faits: [
            { label: 'Serveur', valeur: `${cfg.hote}:${cfg.port}` },
            { label: 'Expéditeur', valeur: adresseExpediteur(cfg) },
          ],
        });
        await client.send({
          from: adresseExpediteur(cfg), to: destinataire,
          subject: 'Vérification de la messagerie SONASP',
          content: texte, html,
        });
        await client.close();
        if (cfg.uid) {
          await admin.rpc('snp_consigner_verification_courriel', {
            p_uid: cfg.uid, p_reussi: true, p_erreur: null,
          });
        }
        return json({ envoye: true, destinataire });
      } catch (erreur) {
        await client.close().catch(() => {});
        const message = erreur instanceof Error ? erreur.message : 'échec SMTP';
        if (cfg.uid) {
          await admin.rpc('snp_consigner_verification_courriel', {
            p_uid: cfg.uid, p_reussi: false, p_erreur: message,
          });
        }
        return json({ envoye: false, erreur: message }, 502);
      }
    }

    /* -------------------------------------------------- File d'attente -- */
    const limite = Number(requete?.limite ?? 50);
    const { data: aEnvoyer, error } = await admin.rpc('snp_courriels_a_envoyer', {
      p_limite: limite,
    });
    if (error) return json({ erreur: error.message }, 500);

    const file = (aEnvoyer ?? []) as Array<{
      livraison_id: string; notification_id: string; destinataire: string;
      titre: string; message: string; gravite: string; chemin: string | null;
      faits: { label: string; valeur: string }[] | null;
    }>;

    if (file.length === 0) return json({ traites: 0, envoyes: 0, echecs: 0 });

    // Une seule connexion pour toute la file : une poignée de main TLS par
    // message ferait expirer la fonction dès la vingtième notification.
    const client = await ouvrirClient(cfg);
    let envoyes = 0;
    let echecs = 0;

    for (const ligne of file) {
      try {
        const { html, texte } = composer({
          destinataire: ligne.destinataire,
          objet: ligne.titre,
          titre: ligne.titre,
          corps: ligne.message,
          faits: ligne.faits ?? [],
          cheminAction: ligne.chemin,
        });
        await client.send({
          from: adresseExpediteur(cfg), to: ligne.destinataire,
          // L'objet est repris tel quel : l'expéditeur affiche déjà
          // « Administration SONASP », un préfixe alourdirait la boîte.
          subject: ligne.titre,
          content: texte, html,
        });
        await admin.rpc('snp_consigner_envoi_courriel', {
          p_livraison_id: ligne.livraison_id, p_reussi: true, p_erreur: null,
        });
        envoyes += 1;
      } catch (erreur) {
        const message = erreur instanceof Error ? erreur.message : 'échec d’envoi';
        await admin.rpc('snp_consigner_envoi_courriel', {
          p_livraison_id: ligne.livraison_id, p_reussi: false, p_erreur: message,
        });
        echecs += 1;
      }
    }

    await client.close().catch(() => {});
    return json({ traites: file.length, envoyes, echecs });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'erreur inattendue';
    console.error('[envoyer-courriel]', message);
    return json({ erreur: message }, 500);
  }
});
