# Collecteurs et comptoirs — livraison du 6 septembre 2026

Le module ajoute **Artisans miniers → Collecteurs**, **Comptoirs** et **Ventes de collecte**. Le comptoir dispose aussi d’un accès à ses collecteurs et à leurs ventes dans son portail. La DGMG retrouve le registre des collecteurs dans son menu de supervision.

## Utilisation

1. La DGMG ou l’administration ouvre **Collecteurs → Nouveau collecteur**. Le formulaire comporte six sections : identité, coordonnées, sites, organisme, justificatifs, photo et observations.
2. Le titulaire est une personne physique. Sélectionner au moins un site existant et un organisme principal : un comptoir ou la SONASP. Plusieurs sites sont possibles. Un seul organisme porte la responsabilité des approbations et des paiements.
3. Enregistrer le dossier. La fiche s’ouvre immédiatement ; elle permet de modifier les rattachements. Les justificatifs sont déposés dans le stockage privé existant. Si un dépôt échoue après l’enregistrement du dossier, le bouton Enregistrer reprend uniquement les dépôts manquants.
4. Dans la gestion des accès, associer un compte de rôle Collecteur à cette personne et au même organisme. Attribuer la responsabilité `collector.operate` et les modules nécessaires. Le dossier métier et le compte de connexion restent distincts.
5. Le collecteur ouvre **Registre des collectes → Enregistrer une vente**. La liste propose les artisans actifs, affiliés pour la période courante et rattachés à ses sites. Le serveur vérifie ces conditions et calcule les montants avec les règles existantes.
6. La vente reste **À approuver**. Un agent habilité de l’organisme destinataire l’approuve ou la refuse avec justification. Le collecteur ne peut pas approuver sa propre soumission. L’approbation ne constate aucun paiement.
7. Le collecteur reçoit une notification dans son compte. Des courriels sont préparés pour le collecteur et l’artisan. Le tableau distingue envoi réussi, attente, échec et contact manquant. Le bouton de relance reprend les courriels en attente, sans recommencer la décision.
8. L’organisme habilité établit la facture, puis utilise le circuit de paiement existant. Pour déléguer l’exécution au collecteur, il fixe une échéance et une justification dans sa fiche ; l’administration doit également attribuer au compte la responsabilité explicite `collector.payments.execute`. Ces deux conditions restent obligatoires. Le contrôle du paiement est assuré par un autre agent.

## Données existantes et limites de la livraison

La lecture de la base distante a identifié 15 dossiers de collecteurs, dont 12 personnes physiques et 3 personnes morales. Aucune donnée distante n’a été modifiée. La migration conserve ces dossiers dans le registre avec un indicateur historique. Les personnes physiques peuvent compléter leur dossier en conservant leur identifiant. Les personnes morales restent consultables ; un dossier distinct de personne physique est nécessaire pour le nouveau circuit. Aucune affectation à un site ni autorisation financière n’est déduite automatiquement.

Le formulaire artisanal et le formulaire des sites n’ont pas été modifiés par cette livraison. Les changements de connexion déjà présents dans le répertoire de travail ont été conservés.

La finalisation d’un paiement conserve les exigences préexistantes : certification DGI et preuve canonique sécurisée. Cette livraison n’ajoute ni connecteur DGI ni passerelle de preuve de paiement artisanal ; elle ne contourne pas leur absence. La notification SMTP nécessite une configuration de messagerie active et une adresse valide. Une interruption après acceptation SMTP mais avant confirmation peut occasionner un doublon de courriel lors d’une reprise ; la décision métier est, elle, idempotente.

## Vérifications

- Suite générale Vitest : **2 439 tests réussis dans 337 fichiers**, aucun échec.
- `npm run test:collectors` : 67 contrats PostgreSQL isolés et 112 tests réussis (formulaire, décisions, routes, menus et handler de notifications).
- `npm run test:registry` : contrôle précédent réussi, puis 58 contrats SQL d’affiliation, 16 tests Node d’intégrité et 169 tests de protection des formulaires artisan/site et des cartes. Deux contrats SQL supplémentaires protègent les dates historiques et le rétablissement du trigger après migration.
- `npm run typecheck`, `npm run lint`, `npm run build` : réussis ; vérification Deno des fonctions `collection-notifications` et `create-user` réussie.
- Recette dans le navigateur avec le vrai habillage de la plateforme : création, modification des sites, soumission d’une vente, décision du comptoir, affichage des notifications ; contrôles à 360, 768, 1366, 1440 et 1920 pixels.

Les captures et le [compte rendu de recette](collector-qa/README.md) utilisent exclusivement des réponses locales de test. Elles vérifient le rendu et les interactions ; elles ne prouvent pas un envoi de courriel ni un paiement réel. Les tests SQL exécutent la nouvelle migration et les fonctions financières existantes dans PGlite, avec des utilisateurs, sessions et conditions d’affiliation de test. L’authentification Supabase réelle et les prestataires externes restent à vérifier sur l’environnement de recette.

Relancer la recette visuelle : `npm exec vite -- --config docs/collector-qa/vite.config.ts`, puis ouvrir `http://127.0.0.1:5183/artisan-minier/collecteurs/nouveau`. Le sélecteur **Profil de test** appartient exclusivement à cette recette et n’entre pas dans le build de production.

## Mise en service

La publication locale et en ligne a été autorisée le 6 septembre 2026, après la recette locale décrite ci-dessus. Le script `scripts/release/deploy-affiliations-collectors.mjs` applique uniquement les deux migrations de cartes et de collecteurs avec leur historique, après sauvegarde et répétition annulée. Il compare les empreintes de 15 tables métier et refuse toute modification de leurs données antérieures.

La première répétition annulée a révélé que le trigger de date de modification des cartes réagissait au remplissage des nouvelles métadonnées. La migration d’affiliation, encore absente du serveur, a été corrigée avant sa première application ; le mode initial du trigger est conservé. La deuxième répétition a réussi avec un schéma intégralement restauré et des données métier identiques. Aucune migration déjà appliquée n’a été réécrite.

Avant publication, appliquer en recette les migrations précédentes nécessaires, notamment celle des affiliations, puis `20260906145430_collecteurs_comptoirs_ventes.sql`. Déployer `collection-notifications` et la mise à jour de `create-user`, puis le frontend issu du même commit. Vérifier les modules et responsabilités des comptes, les rattachements et la configuration SMTP. Les anciennes migrations n’ont pas été réécrites ; le catalogue n’ajoute que la nouvelle migration.
