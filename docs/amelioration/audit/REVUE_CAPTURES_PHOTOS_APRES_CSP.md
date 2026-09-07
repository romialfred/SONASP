# Audit visuel — parcours photos après correction CSP

7 septembre 2026. Inspection indépendante de six fichiers existants avec `view_image`, accompagnée de la lecture de leurs textes accessibles et du code du banc. Aucun navigateur contrôlé par l’auditeur, aucune requête distante, aucun recadrage ou réencodage d’image.

## Acceptation bornée

Les nouvelles captures sont recevables pour montrer les états locaux indiqués ci-dessous. Elles portent toutes la bannière explicite **« BANC LOCAL — données fictives, Auth et Storage simulés, sauvegarde en mémoire uniquement »** et l’habillage DGMG. Cet habillage ne prouve aucune permission DGMG réelle ni aucun contrôle RLS/MFA.

| Capture sous `../lot-artisanat/photos-site/preview/captures/` | État directement observé |
| --- | --- |
| `desktop-partiel-apres-csp.png` — 1280 × 720 | Deux aperçus réussis conservés, un fichier illisible en échec avec Réessayer/Retirer. Le texte accessible confirme la consigne de reprendre ou retirer les échecs avant enregistrement. |
| `desktop-detail-apres-csp.png` — 1280 × 720 | Galerie du détail contenant trois images ; aperçu lisible et aligné. |
| `desktop-lecture-partielle.png` — 1280 × 720 | Première photo disponible, seconde remplacée par un état explicite d’aperçu indisponible et bouton Réessayer. La première n’est pas perdue. |
| `desktop-lecture-retablie.png` — 1280 × 720 | Les deux aperçus sont visibles ; l’état d’échec de la seconde a disparu. |
| `mobile-formulaire-apres-csp.png` — 390 × 844 | Photos sur une colonne, retrait visible, barre Annuler/Enregistrer accessible. Capture prise en milieu de défilement ; la bannière du banc coupe une partie du header. |
| `mobile-detail-apres-csp.png` — 390 × 844 | Galerie sur une colonne et première photo lisible ; le panneau de commandes QA superposé occupe une partie de l’image suivante. |

Sur ces zones, aucun débordement horizontal ni erreur de rendu de la galerie n’est visible. Cela n’équivaut pas à une mesure DOM de toute la page. La capture mobile du formulaire ne doit pas servir de preuve de qualité du header ; les captures sont des **viewports**, pas des pages intégrales.

## Parcours rapporté et limites de preuve

Root rapporte la sélection native d’un fichier valide et d’un fichier corrompu, le refus de sauvegarde tant qu’un fichier reste en échec, un refus simulé de dépôt suivi de reprise, une sauvegarde en mémoire puis le détail, et une lecture partielle suivie de reprise. Les captures et textes accessibles sont cohérents avec ces états. Ils ne suffisent pas, seuls, à prouver chaque geste antérieur, le nombre exact d’appels de reprise ou l’absence de toute répétition de sauvegarde. Aucun journal détaillé des appels du banc n’a été trouvé parmi les captures remises à cet audit.

Le bouton Enregistrer apparaît encore disponible sur la capture d’échec partiel ; le blocage est porté par le gestionnaire de soumission et son alerte, pas par un état `disabled` visible. Ne pas décrire cette preuve comme « bouton désactivé ».

Le banc remplace Auth, le client Supabase, le service Sites et le service AEA par des doubles. Le service photo réel est exécuté avec un transport Storage en mémoire ; les URL d’objets absents ont aussi une image de fixture de secours. La navigation vers le détail constitue donc une sauvegarde simulée. Elle ne prouve ni persistance distante, ni politique RLS, ni signature d’URL réelle, ni conservation des octets dans un bucket distant.

`console-apres-correction.json` contient `[]`. Cela signifie seulement qu’aucune entrée n’a été fournie par ce relevé ; le fichier seul ne délimite pas sa fenêtre de collecte. Il ne permet pas d’affirmer qu’aucune erreur n’est apparue pendant l’ensemble de la session.

## Conditionnement des preuves

Le manifeste indépendant `photos-preview-captures-independent.evidence.json` conserve les SHA des six images, leurs dimensions lues dans les octets, les textes accessibles, la console et les fichiers du banc. Les images sont des **JPEG natifs malgré leur extension `.png`**. Elles ont été inspectées normalement, sans les renommer ni les modifier ; ce décalage de format doit rester documenté pour les lecteurs et exports ultérieurs.

Les anciens `etat-verification-interface.md` et `captures/sha256.json` ne décrivent que l’étape avant la correction CSP et deux anciennes captures. Leur phrase « Aucune nouvelle capture après ce correctif » est désormais historique. Le présent audit constitue le complément daté ; il ne transforme pas rétrospectivement l’ancien échec de dépôt en succès.

**Avis : états visuels locaux recevables dans leur périmètre. Réussite du dépôt/sauvegarde/lecture en base et Storage réels, autres profils, compensation réelle et capture intégrale restent non validés.**
