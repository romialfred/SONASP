# Refonte du dossier artisan — 6 septembre 2026

## Analyse vérifiée avant modification

Le parcours existant utilise `ArtisanMinierListe` / `ArtisanMinierEdit`, le composant partagé `ArtisanMinierForm`, puis `artisanMinierService` et les tables `snp_artisans_miniers`, `snp_artisan_documents`. La relecture passe par `getById`, `normaliserArtisan` et `ArtisanMinierDetails`. Les moyens de paiement et les cartes ont leurs services et règles indépendants, à conserver.

La lecture du schéma distant, sans lecture des dossiers ni mutation, confirme le 6 septembre : quatre rôles historiques (sans aide exploitant), aucune relation responsable de société, contrainte documentaire incompatible avec la valeur `piece_identite` envoyée par le formulaire, et absence du bucket `artisan-documents` attendu par le service. La création déclenche une carte `en_cours` ; une prévisualisation n'est pas une délivrance. La numérotation actuelle doit être sérialisée pour éviter des collisions concurrentes.

Le formulaire ne conserve pas l'identifiant créé lors d'un échec partiel de dépôt. Il mélange l'état civil et les champs société dans le même payload. Sa jauge mesure des champs facultatifs et non les seules obligations du parcours. Le nettoyage des données synthétiques est géré par une autre session ; cette refonte ne supprime ni ne reclasse les dossiers existants.

## Matrice de réalisation

| Exigence | Interface | API | Stockage | Validation | Preuve attendue |
|---|---|---|---|---|---|
| Qualité et rôle indépendants | Profil, quatre choix, rôle historique conservé | Payload conditionnel | Domaine étendu sans retirer Collecteur | Rejet de rôle inconnu | 8 combinaisons + historique |
| Personne physique | Identité, contacts et WhatsApp | Sauvegarde du dossier | Colonnes existantes + WhatsApp | Majorité existante, dates, contacts | Création / édition / relecture |
| Société et responsable | Société, siège distinct, responsable | Transaction unique | Responsable 1:1, RCCM, IFU, siège | Obligations conditionnelles côté serveur | Responsable incomplet rejeté |
| Aide exploitant | Recherche bornée, site hérité | Recherche filtrée et sauvegarde | FK parent exploitant | Existence, périmètre, rôle, auto-lien, dépendants | Appels directs négatifs |
| Documents multiples | Propriétaire, type, titre, état, reprise | Gateway de dépôt existant | Bucket privé, métadonnées et responsable FK | Taille, MIME, signature, droits | CRUD, rejet, reprise sans doublon |
| Enregistrement robuste | Erreurs ciblées, rester sur échec partiel | Atomicité et identifiant stable | Contrôle de concurrence | Version attendue, double soumission | Échecs et répétition |
| Suivi ergonomique | Sections numérotées, sommaire, progression réelle | Sans nouvel appel décoratif | Sans persistance de brouillon personnel | Obligations partagées avec formulaire | Clavier, desktop, mobile |
| Compatibilité | Liste, fiche, aperçu, paiements | Services existants conservés | IDs, cartes et historiques préservés | Aucun compte utilisateur implicite | Tests de zone |

Ordre : contrat du dossier et migration additive ; service transactionnel et documents privés ; formulaire partagé et détails ; tests SQL isolés, tests de zone, compilation et comparaison visuelle. Les résultats et limites seront complétés après exécution des contrôles.

## Réalisation

Le formulaire partagé de création et modification est maintenant composé de `ArtisanMinierForm`, `ArtisanDossierFields` et `ArtisanDocuments`. Le contrat `src/lib/artisanDossier.ts` porte les branches, les obligations et la progression réelle. La fiche détaillée restitue les champs dans `ArtisanDossierSummary`. Les listes, statistiques, aperçu de carte et documents du portail collecteur prennent en compte les nouvelles données.

Les quatre rôles sont disponibles pour les deux qualités juridiques. La société possède son siège, son RCCM, son IFU et un responsable séparé. Les coordonnées WhatsApp sont indépendantes, sauf sélection explicite de « Identique au téléphone ». Les brouillons de chaque branche restent en mémoire pendant la saisie. Un avertissement précède l’abandon de pièces d’une branche inactive ; les retours, liens et fermeture du formulaire protègent la saisie.

L’aide choisit un exploitant actif par recherche serveur bornée à 20 résultats. Son site est hérité, sans duplication. Les autres rôles disposent d’un sélecteur de sites avec recherche et peuvent rester non rattachés. Les changements de rôle ou d’exploitant sont confirmés dans le formulaire ; les dépendances des exploitants ayant des aides sont vérifiées en base.

`snp_save_artisan_dossier` enregistre les données structurées dans une transaction. L’identifiant de création est stable en cas de répétition ; la version attendue protège les modifications concurrentes. Les pièces passent par le profil `artisan-document` du gateway existant : contrôle du contenu, bucket privé, accès institutionnel, reprise par identifiant et compensation des suppressions interrompues. Les appels historiques du service ne publient plus les nouvelles pièces par URL publique.

L’attribution des ventes à leur site est conservée dans `snp_artisan_vente_site_origins`. Le changement de site ou d’exploitant ne déplace donc pas rétroactivement la production déclarée. Les opérations financières existantes ne sont pas réécrites.

L’aperçu de carte convertit maintenant les PDF en images avec le worker local PDF.js, au lieu de transmettre un PDF à une balise image. La carte société indique sa raison sociale et ne comporte plus de photo personnelle. Les dates ne chevauchent plus la photo. Le nom de signataire codé en dur et le sceau décoratif, non issus d’une validation, ont été retirés. L’aperçu indique qu’il ne vaut pas délivrance.

Les dossiers historiques restent lisibles, y compris Collecteur. Leur complétion demande les informations effectivement manquantes. La qualité juridique d’un dossier enregistré est verrouillée : aucune conversion de personne physique en société ne transforme ses dépendances existantes.

## Vérifications exécutées

Relevé synthétique : [artisan-module-validation-2026-09-06.json](audits/artisan-module-validation-2026-09-06.json).

- PostgreSQL isolé : **50 contrôles réussis**, dont les huit combinaisons, modifications du responsable, duplication, reprise de création, concurrence optimiste, champs de branche incompatibles, aide invalide, historique Collecteur, attribution du site et droits documentaires.
- Dernière suite ciblée : **39 tests réussis dans 6 fichiers**, comprenant formulaire, restitution société, contrats de saisie, téléphone international, sortie sans perte et dépôt documentaire.
- Gateway : `deno check --no-config --no-lock supabase/functions/sensitive-upload/index.ts` réussi.
- Compilation de production : `npm run build` réussie.
- Qualité : `npm run lint` réussi ; aucun libellé français interdit.
- Migrations : catalogue comparé avant remplacement, aucun checksum antérieur modifié ; vérification réussie et **10 tests d’intégrité réussis**.
- Rendu : captures des parcours physique et société inspectées dans le navigateur à 1 265 px et dans une fenêtre de contenu à 360 px. Formulaire réel monté dans un banc local avec services simulés, fermé et retiré après contrôle. Aucun dossier de production n’a été créé pour ces captures.
- Suite générale finale : **2 393 tests réussis dans 329 fichiers**, aucun échec ni fichier manquant par rapport à l’inventaire de collecte. Les quatre écarts de traduction/inventaire documentaire repérés au premier passage ont été corrigés avant cette exécution.
- Aperçu de carte ajouté ensuite : **3 tests supplémentaires réussis**, avec conversion PDF vers canevas réellement vérifiée dans le navigateur pour personne physique et société.
- Typage : `npm run typecheck` réussi, y compris couverture des relations Supabase.

Le scénario SQL utilise PGlite avec une structure de départ issue du schéma observé, des identités dédiées et des fonctions d’autorisation simulées. Il exécute le SQL réel de la migration ; il ne remplace pas un test complet Auth / PostgREST / Storage sur une instance Supabase. Les tests du gateway simulent le réseau et vérifient notamment les réponses perdues, contenus différents sous un même identifiant et restauration après échec de suppression.

## Installation de cette refonte

Cette refonte dépend de la migration additive `supabase/migrations/20260906111030_refonte_dossier_artisan.sql` (checksum SHA-256 normalisé `29e774d4d48084f48bff8e9c14932d11ad6595040b87f76bbcc1934e0024f954`) et de la nouvelle version du gateway. Le relevé de validation ci-dessus décrit la préparation locale ; la publication commune des sites et artisans est décrite dans [publication-sites-artisans.md](publication-sites-artisans.md).

Ordre de mise en ligne :

1. Vérifier le projet cible, sauvegarder le schéma concerné et confirmer que le nettoyage des données ne modifie pas simultanément ces structures.
2. Installer uniquement la migration artisan revue, après la migration du registre minier `20260906093115`, avec inscription atomique dans l’historique des migrations. L’historique ancien présente déjà des versions ambiguës : ne pas lancer une réparation ou un `db push` global pour ce lot.
3. Déployer `sensitive-upload` avec ses fichiers partagés ; conserver la vérification JWT et les contrôles de session.
4. Déployer le frontend issu du build vérifié, depuis une sélection des changements revus dans cet espace de travail partagé.
5. Vérifier les parcours authentifiés DGMG / administrateur : création, relecture, modification, responsable, pièces privées et reprise réseau. Contrôler aussi un compte hors périmètre.

Le 6 septembre à 12 h 30 UTC, la migration a été appliquée après une répétition annulée : les 11 tables métier contrôlées conservent leurs données. La vérification confirme 64 artisans et 41 ventes conservés, les 41 attributions historiques ajoutées séparément, le bucket privé et les refus d'accès anonymes. Le gateway `sensitive-upload` a été publié en version 6 ACTIVE. La livraison du frontend passe désormais par le commit Git commun, avec les tests des deux modules exécutés avant chaque compilation Vercel. Aucun formulaire artisan n'a été remanié pendant cette publication.
