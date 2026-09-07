# Recette navigateur après correction CSP

7 septembre 2026, observations du pilote principal. Banc local `http://127.0.0.1:5188`, composants React du formulaire et du détail de site, identité et transport Storage **simulés en mémoire**. Ces essais ne prouvent ni Supabase Auth/MFA, ni les politiques RLS, ni un dépôt dans le Storage distant.

## Parcours observés

1. Ouverture du formulaire comportant deux références historiques. Retrait de la seconde du brouillon, sans suppression de son objet historique.
2. Sélection par le sélecteur natif de fichiers de `photo-site.png` et `image-illisible.png`, fixtures R02. Le fichier valide est compressé et déposé dans le transport mémoire ; le fichier illisible reste en échec individuel. Les références déjà réussies sont conservées.
3. Clic sur Enregistrer : la sauvegarde est bloquée par le gestionnaire, la route reste celle du formulaire et une alerte demande de traiter le fichier échoué. Retrait explicite de ce seul fichier.
4. Activation du refus de dépôt dans les commandes du banc, puis nouvel ajout d'une image valide : échec visible. Désactivation du refus, puis clic sur le bouton de reprise de ce fichier. Le dépôt aboutit ; les deux dépôts simulés réussis ne sont pas rejoués ensemble. Le brouillon contient trois photos.
5. Enregistrement dans le stockage mémoire et ouverture du détail : confirmation et trois photos chargées. Les dimensions naturelles des trois images ont été contrôlées dans le DOM.
6. Vérification à 1280 × 720 puis à 390 × 844. Sur mobile, largeur du document 390 px et panneau principal 375 px sans débordement horizontal. Les photos sont chargées dans le détail et dans l'édition. La surcharge de viewport a ensuite été réinitialisée.
7. Rechargement du banc, qui réinitialise volontairement les données mémoire. Activation du refus de lecture de la seconde référence, ouverture du détail : première photo visible et seconde en erreur avec reprise individuelle. Désactivation du refus et clic sur Réessayer : les deux images sont chargées.
8. Lecture de la console du banc après ces parcours : aucune entrée de niveau erreur ou avertissement retournée. Ce contrôle concerne ce banc et cette session uniquement.

## Captures

Les fichiers sont dans `captures/`. Ce sont des **captures de viewport**, parfois de segments d'un panneau à défilement interne, et non des captures de page entière. Les fichiers texte DOM sont des lectures distinctes des pixels. Les horodatages de fichiers et empreintes du manifeste décrivent leur conservation, pas une capture atomique du code et de chaque action.

| Fichier | État représenté |
| --- | --- |
| `desktop-partiel-apres-csp.png` | Succès partiel de l'ajout et erreur individuelle |
| `desktop-detail-apres-csp.png` | Détail après sauvegarde mémoire |
| `mobile-detail-apres-csp.png` | Segment du détail à 390 px |
| `mobile-formulaire-apres-csp.png` | Segment de l'édition à 390 px |
| `desktop-lecture-partielle.png` | Une lecture disponible et une lecture refusée |
| `desktop-lecture-retablie.png` | Lecture rétablie après reprise individuelle |
| `console-apres-correction.json` | Résultat du contrôle console décrit ci-dessus |

La revue indépendante des pixels est consignée séparément par l'auditeur. L'en-tête DGMG visible sur ce banc peut servir à examiner cette identité graphique ; le corps de page ne constitue pas une preuve du tableau de bord DGMG.

## Limites et suite

Les anciens instantanés pris avant correction CSP restent conservés ; leurs limites ne sont pas réécrites en succès. Ces nouveaux essais ferment la vérification du dépôt mémoire après CSP et ajoutent le mobile. Les contrôles de persistance réelle des références privées, de lecture après reconnexion, de suppression compensatoire distante et de permissions avec comptes distincts restent à effectuer. Aucun nouveau dossier ni objet n'a été créé dans la base distante par ce banc.
