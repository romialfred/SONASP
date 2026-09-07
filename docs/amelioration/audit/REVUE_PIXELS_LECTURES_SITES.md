# Revue indépendante des captures des lectures Sites

7 septembre 2026. Relecture des preuves existantes dans `docs/amelioration/preuves/lecture-sites-ui`, sans navigateur, nouvelle exécution de tests, accès réseau ou modification applicative. Les anciens rapports, captures et DOM sont conservés tels quels.

## Avis

Les neuf captures demandées sont cohérentes avec les états de lecture décrits. Les messages d’erreur et d’attente remplacent les résultats ; le bloc de conformité vide présente désormais « Non évalué ». Les trois captures mobiles affichent une erreur lisible et le bouton de reprise dans le viewport.

Il n’y a pas d’anomalie applicative supplémentaire démontrée par ces pixels. Une réserve concerne la **preuve 07 sur ordinateur** : le panneau de commandes du banc masque la partie droite de l’alerte, donc le bouton « Réessayer » n’y est pas visible. Sa présence est attestée par `07-production-erreur.txt` et sa visibilité sur mobile par la capture 13. La capture 07 seule ne peut attester sa visibilité sur ordinateur.

Ces constats portent exclusivement sur le **banc local avec Auth, transport et stockage simulés en mémoire**. Le bandeau l’indique dans les neuf images. Aucun résultat de base de données, de permissions réelles, de MFA, de Storage distant ou de page complète n’est validé ici.

## Pixels examinés

| Capture | Dimensions réelles | Constat indépendant |
|---|---|---|
| 02 Overview — erreur | 1280 × 720 | Message explicite et reprise visibles ; aucun résultat ni tableau affiché. Actions du header conservées. |
| 03 Overview — attente | 1280 × 720 | État de chargement visible, résultats absents, Actualiser visuellement indisponible. |
| 06 Production — attente | 1280 × 720 | Message de chargement visible, absence des indicateurs, classements et tableaux ; panneau du banc superposé à droite. |
| 07 Production — erreur | 1280 × 720 | Message d’indisponibilité visible, résultats absents ; bouton de reprise masqué par le banc dans cette image. |
| 09 Détails — erreur | 1280 × 720 | Retour aux sites et Réessayer visibles ; identité du site, photos, onglets et modification absents. |
| 11 Overview — non évalué | 1280 × 720 | « Non évalué » et explication présents, sans jauge ni note 0/100. Capture défilée sur Vigilance ; haut de la carte coupé par le viewport, pas une page entière. |
| 12 Overview mobile — erreur | 390 × 844 | Titre et boutons répartis sur plusieurs lignes ; erreur et reprise lisibles sans débordement visible. |
| 13 Production mobile — erreur | 390 × 844 | Retour, titre, création et reprise lisibles ; résultats absents. |
| 14 Détails mobile — erreur | 390 × 844 | Retour et reprise lisibles, message sur deux lignes ; ancienne fiche et actions absentes. |

Les neuf fichiers sont réellement au format JPEG ; leur extension est cohérente. Aucun redimensionnement, recadrage, retouche ou remplacement n’a été effectué par l’auditeur. Sur mobile, le panneau de commandes replié reste au bas de la fenêtre et ne recouvre pas les messages ou les boutons de reprise examinés.

## Cohérence des traces et du rapport

- Le manifeste comporte **24 fichiers**. Leur taille et leur SHA256 concordent tous avec les octets présents. La vérification indépendante, les dimensions et les constats sont conservés dans `lecture-sites-ui-independent.evidence.json` ; le lecteur reproductible est `verify-lecture-sites-ui-evidence.mjs`.
- `04-overview-vide.txt` conserve bien l’ancien élément `Indice de conformité 0 sur 100`. `11-overview-non-evalue.txt` et ses pixels montrent la correction. L’ancien défaut n’est pas requalifié comme résultat conforme.
- Dans le DOM principal de 09, le message d’indisponibilité et la reprise remplacent la fiche. Dans 10, le lien **Modifier la fiche** et les deux éléments image sont rétablis. Il n’y a pas de capture de l’état 10 dans ce répertoire : le retour de ces éléments y est une preuve DOM, sans confirmation indépendante de leurs pixels à cet instant.
- Les trois DOM mobiles contiennent le bouton Réessayer dans la zone principale, conformément aux images. Le générique « 0 » hors zone principale ne représente pas un indicateur du module.
- Le README distingue correctement viewport et page entière, DOM et image, données fictives et persistance réelle. Les montants de production ne sont pas validés par une fixture sans vente.
- Les mesures de `scrollWidth` annoncées par le pilote ne sont pas exportées dans les fichiers DOM examinés. La présente revue confirme seulement l’absence de débordement **visible** dans les trois états mobiles capturés ; elle ne transforme pas cette observation en mesure DOM indépendante.
- Le manifeste est constitué après capture. Comme le README le précise, il ne lie pas atomiquement le build chargé et chaque image. Le rejeu technique de 97 tests et ses SHA reste une preuve séparée, décrite dans `REVUE_LECTURES_SITES_CONSOLIDEE.md`.

Les limites du README sont donc respectées, avec les réserves de visibilité et de trace indiquées ci-dessus. Aucune assertion de fidélité complète de toutes les pages ou de clôture de la recette réelle n’est déduite de cette inspection.
