# États de lecture Sites — parcours navigateur local

7 septembre 2026. Banc isolé `127.0.0.1:5188`, composants applicatifs Vue d'ensemble, Production et Détails, vrai hook de lecture et calculs applicatifs. Seuls Auth, les données et leur transport sont simulés en mémoire. Le bandeau du banc l'indique. Aucun appel à la base distante et aucune preuve de persistance ne sont attribués à ces essais.

## Parcours exécutés par le pilote

- **Vue d'ensemble** : lecture réussie du site fictif, refus de relecture, disparition des compteurs/cartes/tableau et affichage de l'erreur avec reprise ; reprise retardée de cinq secondes avec état de chargement exclusif ; retour du contenu après succès ; réponse vide confirmée.
- **Production** : données initiales, actualisation retardée avec masquage des résultats, refus avec message explicite et bouton Réessayer, puis reprise. Les ventes de la fixture sont volontairement vides ; cela ne constitue pas un contrôle de montants de production réels.
- **Détails** : fiche disponible avec photos, refus d'Actualiser, disparition de la fiche et du lien de modification, affichage Retour aux sites + Réessayer ; reprise réussie rétablissant la fiche, le lien de modification et les deux photos. `10-detail-repris.txt` décrit cet état.
- **Conformité sans note** : la première réponse vide a révélé une jauge 0/100 injustifiée (`04-overview-vide.txt`). Après correction du helper et rechargement du banc, la même situation affiche **Non évalué**, sans jauge (`11-overview-non-evalue.*`). Les deux preuves sont conservées dans leur ordre, sans requalifier l'état antérieur.
- **Mobile 390 × 844** : ouverture de l'erreur sur les trois pages, messages et reprise présents. Mesure DOM sur Overview et Détails : document de largeur 390 px. Overview : panneau principal 390 px, `scrollWidth` 390 px. La surcharge de viewport a été réinitialisée après les captures.

## Portée des preuves

Les fichiers `.jpg` sont des captures natives de viewport. Les fichiers `.txt` sont des lectures DOM séparées, pas des extractions de l'image. Une capture de viewport ne prouve pas une page entière. Le pilote a inspecté directement l'état « Non évalué » et l'erreur Overview mobile ; les autres pixels font l'objet d'une revue indépendante distincte.

La navigation initiale a nécessité un second chargement après la préparation des nouvelles dépendances du serveur Vite du banc. Il ne s'agit pas du serveur statique de recette 5192. Aucune fiabilité de démarrage du build intégré n'est déduite du banc.

Une interrogation de rôle « bouton Modifier la fiche » a retourné zéro : l'action est un **lien**, présent dans le DOM après reprise. Ce résultat n'est pas une preuve de disparition après réussite. Les états ci-dessus sont fondés sur le DOM complet, la séquence d'actions et les captures, pas sur cette interrogation mal typée.

Le chargement, l'échec initial, les changements de contexte et les réponses tardives sont également contrôlés par le rejeu indépendant de 97 tests. Cela ne remplace pas une recette de permissions réelles avec plusieurs comptes ni les contrôles de persistance R02.

## Fichiers

Les numéros 01–10 couvrent les états de lecture avant le complément de conformité ; 11 couvre la correction Non évalué ; 12–14 couvrent les erreurs mobiles. Les captures peuvent montrer le panneau de commandes du banc. Les empreintes conservées après capture figurent dans `manifest.json` ; elles n'établissent pas un horodatage atomique du build et du navigateur.

Après la réserve de l'auditeur sur la capture 07, une nouvelle capture 15 montre l'erreur de Production sur ordinateur avec le panneau du banc fermé : le bouton Réessayer est visible. Le pilote a inspecté directement cette capture ; les neuf captures de la revue indépendante initiale restent identifiées dans `../../audit/REVUE_PIXELS_LECTURES_SITES.md`.
