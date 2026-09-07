# Revue locale — Collecteurs et Comptoirs

Date : 7 septembre 2026. Périmètre : listes, fiches, formulaires, services, pièces jointes et gardes d’accès existants. Revue en lecture seule du code applicatif ; aucune requête distante, aucune écriture métier, aucune migration. Aucun parcours Chrome ni stockage réel n’est validé par ce rapport.

## Résultat des tests exécutés

**87 tests réussis sur 87, dans 10 fichiers ; sortie du processus 0.** Preuves : `tests.json`, `tests.log` et `evidence.json`.

La commande exacte et les empreintes des sources relues sont consignées dans `evidence.json`. Les tests de formulaires simulent les services : leur réussite couvre les interactions React et les contrats simulés, pas l’API, Auth/MFA, Storage ni la persistance distante. Les tests de portail/gardes sont distingués des tests de formulaires.

## Constats à traiter

| Référence | Priorité | Constat et déclencheur | Preuve locale et portée |
| --- | --- | --- | --- |
| COLL-READ-001 | P1 | Si le chargement des collecteurs échoue dès l’ouverture, l’alerte apparaît mais la liste affiche aussi des compteurs à zéro et un résultat vide. Sur une URL de fiche, le même échec produit « Collecteur introuvable dans votre périmètre ». Une erreur de lecture ne permet pas de conclure à l’absence du dossier. | `CollectorsPage.tsx`, chargement lignes 56–68, sélection ligne 73 et branches de rendu lignes 230–300. Confirmé par le chemin de code, non reproduit dans Chrome dans ce lot. |
| COLL-READ-002 | P1 sous volumétrie | `snp_list_collectors` retourne un ensemble de lignes JSON. Le service l’appelle une seule fois sans pagination ni détection du plafond REST. Liste, compteurs, fiche et formulaire d’édition utilisent ensuite cet ensemble comme s’il était complet. Un collecteur au-delà du plafond du serveur peut donc être présenté comme introuvable. | `collectorService.ts` ligne 97 ; migration `20260906145430_collecteurs_comptoirs_ventes.sql` lignes 75–95 ; `CollectorForm.tsx` chargement initial et recherche par ID. Plafond effectif de la cible et scénario volumétrique non mesurés dans cet audit. Ne pas appliquer ce constat au service Comptoirs : son RPC renvoie un seul agrégat JSON et sa lecture de fiche filtre `p_id`. |
| CPT-READ-001 | P2 | La liste Comptoirs explique correctement son indisponibilité dans le tableau, mais ses statistiques restent à zéro après un premier échec, ou présentent les valeurs précédentes après un échec d’actualisation, sans les qualifier d’anciennes. | `ComptoirsPage.tsx` lignes 38–57 et 195–225. Confirmé statiquement ; aucune fausse absence n’est annoncée dans le tableau lui-même. |
| COLL-CONTRACT-001 | P2, défense de contrat | La frontière RPC Collecteurs ne contrôle pas la forme de `data`. Une réponse sans erreur mais `null` ou mal formée atteint `.find`, `.filter` ou `identity` hors du `try` de chargement et peut provoquer une erreur de rendu. | `collectorService.ts` lignes 79–90 et `CollectorsPage.tsx` lignes 73–90. Scénario de réponse invalide, pas un incident distant attesté. Le service Comptoirs valide déjà ses réponses avec Zod. |

Correction minimale proposée pour le prochain lot autorisé : état de lecture explicite distinct de la liste vide vérifiée ; neutraliser les indicateurs/faux « introuvable » sur erreur ; relance visible ; ne jamais présenter un résultat incomplet comme exhaustif. La pagination Collecteurs doit respecter le périmètre du RPC existant et un ordre stable ; elle ne justifie aucun élargissement des droits. Si un nouveau contrat SQL est nécessaire, le préparer localement et attendre le Go de migration.

## Sauvegardes et pièces jointes

- **Collecteur** : identifiant de création stable, contrôle de version, validation avant sauvegarde, pièces enregistrées séparément et état de reprise par pièce. Un échec de dépôt affiche explicitement que le dossier est déjà enregistré et conserve les fichiers échoués pour reprise sans recréer le parent. Ces scénarios sont couverts par les tests existants réussis. Le serveur localement décrit impose personne physique, organisme actif SONASP/comptoir et au moins un site existant.
- **Comptoir** : validation structurée des réponses, clé de reprise stable pour un contenu identique, contrôle de version et de date de modification, refus d’ID de pièce/organisme/type ne correspondant pas au dépôt. Après sauvegarde et dépôts réussis, le formulaire relit la fiche avant navigation. Les tests couvrent notamment réponse différée, perte de réponse, reprise de pièces, refus des formats/taille et lecture seule.
- Les formulaires distinguent la sauvegarde du dossier du dépôt de fichiers ; ils ne forment pas une transaction unique avec Storage. Les erreurs partielles sont signalées. Les tests ne prouvent pas les octets, les droits d’accès Storage ni le nettoyage d’un éventuel dépôt orphelin distant.
- Point secondaire de restitution : les échecs de résolution d’aperçu photo/logo sont silencieux dans certains effets (`CollectorForm.tsx` et `ComptoirForm.tsx`). Les actions explicites d’ouverture de pièce du comptoir gèrent en revanche leur erreur. Prévoir un état « aperçu indisponible », sans assimiler cela à une absence de document.

## Permissions et périmètres

`routeAccessRegistry.ts` réserve la création/modification Collecteurs et tout le registre Comptoirs aux rôles/types de compte Owner, Administrateur et DGMG. La consultation des Collecteurs est plus large mais le RPC utilise `snp_collector_visible`. Le bouton de délégation exige à la fois une capacité sensible du compte et `can_delegate_payment` renvoyé par le serveur.

Les migrations locales décrivent des RPC avec `SECURITY DEFINER`, chemin de recherche vide, contrôles de session/profil et helpers de périmètre. Le helper fort Collecteurs contrôle explicitement MFA ; le registre Comptoirs utilise `snp_comptoir_registry_allowed` puis `snp_peut_gerer_sites_artisanaux`. Aucun défaut d’élargissement de permissions n’a été confirmé dans ce périmètre. **Ceci est une lecture des sources canoniques, pas une attestation du schéma live ni une recette multi-profils.**

L’ancienne erreur JavaScript « reading rest » n’est pas ouverte dans cette revue : les deux services conservent le contexte Supabase via `.rpc.bind(supabase)`.

## Limites et couverture manquante

Les dix fichiers exécutés ne comprennent pas de test spécifique des pages parentes `CollectorsPage`/`ComptoirsPage`, ni de contrat runtime direct de `collectorService`/`comptoirService`. Les tests réussis du composant `CollectorDetails` sur les erreurs d’activité ne couvrent pas l’échec préalable de chargement du dossier dans la page parente.

Les conclusions P1/P2 ci-dessus sont des constats de source avec chemins précis. Les reproductions d’erreur de liste, de plafond REST, les autorisations réelles multi-profils et la création/dépôt/relecture en base restent à exécuter avant déclaration de validation complète de ces deux modules. Aucune refonte ni correction applicative n’a été effectuée par cet audit.
