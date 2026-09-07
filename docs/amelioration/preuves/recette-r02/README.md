# Recette réelle R02 — création vérifiée et données nettoyées

7 septembre 2026. Compte de test administrateur connecté par l'utilisateur sur
`http://127.0.0.1:5192`. Aucun mot de passe, jeton ni code MFA extrait. Base de test
existante, aucune migration et aucune publication distante pendant ce run.

## Parcours effectivement exécuté

1. Chargement de la candidate locale `local-mtr6cnno`, compilation vérifiée.
2. Navigation Sites artisanaux → Vue d'ensemble → Enregistrer un site.
3. Saisie du dossier `QA20260907-R02-SITE`, non formalisé et planifié, avec les
   valeurs du fichier `site-creation-attendu.json`, les deux responsables et
   leurs coordonnées fictives. Les trois fichiers PNG du dossier `fixtures`
   sont des documents de test créés pour la recette ; aucun n'a encore été
   déposé sur le stockage réel.
4. Enregistrement par le bouton du formulaire ; la fiche affiche la confirmation
   et l'UUID `d9f7160a-aadd-41d9-ad4d-c9f886d41e0c`.
5. Retour à la liste par son lien, sans action de rechargement pendant ce retour,
   puis recherche du préfixe QA. Le nom du site, sa catégorie et sa capacité
   apparaissent. L'onglet Non formalisés a également été sélectionné.
6. Réouverture de la fiche et de l'onglet Conformité : « Non évalué — site
   planifié », règles explicites sans pénalités appliquées.
7. Lecture SQL du seul UUID, dans une transaction READ ONLY terminée par
   ROLLBACK : 18 champs parent et deux responsables conformes aux attentes.
   Résultat indépendant dans `../../audit/AUDIT_R02_SITE_CREATION.md`.

## Traçabilité et limites des captures

Les actions ci-dessus ont été observées par le pilote. Les fichiers PNG/AX sont
des instantanés distincts, pas une vidéo ni une capture atomique de l'action et
de la réponse. Le PNG `site-03-liste-sans-rechargement.png` représente l'onglet
Tous ; son fichier AX représente ensuite Non formalisés. Ils prouvent chacun la
présence du même site, sans prouver une simultanéité entre pixels et AX. Le nom
du fichier ne suffit pas à attester l'absence de rechargement ; cette information
provient de la séquence d'actions du pilote.

Le build a été vérifié au serveur et chargé avant la création. Aucun manifeste
automatique avant/après n'a empreinté chaque capture au moment précis de sa
prise ; ne pas présenter cette preuve intermédiaire comme une certification
complète d'une version de publication. Les contrôles SQL et leur reçu horodaté
sont conservés sous `../../environnement/reprise-r02/`.

## Suite restant à effectuer

La session du navigateur est revenue sur la connexion pendant la préparation
de la candidate photo. Une reconnexion a été demandée à l'utilisateur. La
modification du site, les pièces AEA, les photos sur le Storage réel et les autres
formulaires ne sont pas déclarés validés.

Le manifeste `manifest-donnees.json` conserve les identifiants historiques des
trois lignes de recette désormais supprimées. Aucun autre dossier n'entre dans
le nettoyage. Les essais photo sur le banc 5188
utilisent un transport en mémoire et font l'objet d'un rapport séparé.

## Nettoyage vérifié

La première tentative a échoué avant les DELETE : une expression de contrôle
supposait `id` sur une table dont la clé est `vente_id`. La relecture a confirmé
les trois lignes intactes. Le candidat V2 corrige uniquement l'ordre des
agrégats par contenu JSON ; ses expressions et son postflight ont d'abord été
exécutés intégralement en lecture seule.

Après revue séparée du candidat V2, l'exécution unique de 16:00 UTC a supprimé
exactement les deux responsables et le seul site QA. Le postflight confirme les
trois UUID absents, les données hors manifeste des 14 tables contrôlées, le
schéma et les métadonnées Storage préservés. Aucun fichier distant n'avait été
déposé. Les changements tiers restent présents. Voir
`../../environnement/reprise-r02/cleanup-verification-v2.json`.

Le nettoyage clôt le parcours de création exécuté ; il ne valide pas les
parcours de modification ou de documents qui nécessitent une nouvelle session
de recette. Aucune migration n'a été appliquée.

## Comparaison de la base partagée

La comparaison en lecture seule du 7 septembre à 13:09 UTC retrouve les trois
ajouts du manifeste, sans disparition sur les dix tables suivies. Elle observe
aussi une modification d'artisan et deux ajouts (artisan et carte) qui ne sont
pas attribuables à cette recette. Il serait donc incorrect d'affirmer que toute
la base est restée inchangée en dehors de notre site. L'audit indépendant a
recalculé cette comparaison et les métadonnées Storage restent stables.

Ces changements hors manifeste sont préservés, sans attribution de cause et
sans nettoyage. Le contrôle des 18 champs et des deux responsables du seul
site R02 demeure conforme. Voir
`../../audit/r02-baseline-comparison-independent.evidence.json` et
`../../environnement/reprise-r02/comparaison-baseline-apres-creation-r02.json`.
