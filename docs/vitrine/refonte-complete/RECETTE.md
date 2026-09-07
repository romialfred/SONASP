# Refonte complète de la vitrine FASO SANAMA

La route publique `/` a été refondue dans l’application React/Vite existante. Le périmètre couvre le bandeau présidentiel, le header, les neuf sections centrales et le footer. Les formulaires et portails authentifiés n’ont pas été redessinés.

Référence : dossier `FASO_SANAMA_Refonte_Vitrine_Complete_Codex`, notamment `COMMENCER_ICI.md`, le prompt maître et les spécifications 01 à 04. La [capture fournie](reference-fournie.png) est conservée pour les prochaines revues. Les exceptions expressément demandées sont appliquées : Public Sans, trois diapositives IA et cinq catégories de statistiques.

## Bilan des onze zones

| Zone | Réalisation et vérification | Fichiers principaux |
|---|---|---|
| 1. Bandeau et header | Présidence du Faso, drapeau, logo existant, quatre ancres, assistance, accès commun `/login`. Menu mobile testé, fermeture après sélection, Échap et boucle de focus. Français seul, conformément aux langues effectivement activées. | `PublicLayout.tsx`, `faso-vitrine.css` |
| 2. Hero | Trois textes et trois images IA fournis, un H1, hauteur stable, boutons nommés, progression, intervalle de 8 s, fondu de 450 ms. Pause au survol, focus et onglet masqué ; choix manuel arrêté jusqu’à reprise explicite ; réduction des animations respectée. Drone et hologrammes visibles. | `FasoHero.tsx`, `content/hero-content.fr.json`, `public/vitrine/ia/` |
| 3. Repères nationaux | Cinq catégories présentes, état indisponible explicite, volet des définitions, sources et dates. Tests d’une valeur positive, d’un vrai zéro et d’une valeur absente. | `PublicHomePage.tsx`, `content/sectorIndicators.ts` |
| 4. Missions | Trois colonnes éditoriales avec icônes, numérotation et séparateurs ; recomposition verticale sur téléphone. Objectifs présentés comme tels. | `PublicHomePage.tsx`, `faso-vitrine.css` |
| 5. Portails | Sept entrées dans l’ordre demandé. Chaque sélection change titre, contenu et aperçu ; liens vers l’entrée sécurisée existante. Les sept panneaux ont été ouverts sur mobile. Flèches, Début/Fin et tabulation testés. | `PublicHomePage.tsx`, `fasoVitrineContent.ts` |
| 6. Traçabilité | Huit étapes, grille de quatre colonnes puis deux, panneau avec image, titre et trois informations. Les huit états ont été ouverts dans le navigateur. Aucune transaction ou validation métier déclenchée. | `PublicHomePage.tsx`, `fasoVitrineContent.ts` |
| 7. Impact national | Bandeau vert, titre et quatre bénéfices, séparateurs fins. Aucun rendement fiscal présenté comme acquis. | `PublicHomePage.tsx`, `faso-vitrine.css` |
| 8. Gouvernance | Accès maîtrisés, décisions historisées, documents protégés. Le lien ouvre la page `/securite` existante. | `PublicHomePage.tsx` |
| 9. Institutions | Cinq dénominations existantes, alignement centré et retour à la ligne sur mobile. Typographie secondaire contrôlée également à 768 px. | `PublicHomePage.tsx`, `faso-vitrine.css` |
| 10. Appel final | Accès aux espaces et accompagnement, liens `/login` et `/assistance`, actions replacées sous le texte sur téléphone. | `PublicHomePage.tsx` |
| 11. Footer | Présidence, marque, trois colonnes de liens, mentions légales, confidentialité, conditions d’utilisation, copyright et support existants. Pages cibles ouvertes et contrôlées dans le navigateur. | `PublicLayout.tsx`, `faso-vitrine.css` |

## Données, fonctions et sources

- Les services publics consultés gèrent les publications et l’assistance. Aucun agrégat national réunissant une valeur validée, sa date et son périmètre pour les cinq catégories demandées n’a été identifié. Les cinq valeurs sont donc `null`, affichées « — / Donnée non disponible ». Aucun compte privé n’est interrogé et aucun total d’inscrits n’est présenté comme un total national.
- Le contrat `SectorIndicator` conserve la définition, la population, le périmètre, la date, la source, la référence URL, la mise à jour et le caractère estimatif. Une valeur n’est publiable que si sa provenance minimale est renseignée. Le zéro documenté reste distinct d’une absence.
- La projection « +15 à +35 % » reste une hypothèse non validée du porteur du projet. Sa qualification est visible sur ordinateur et téléphone. Les références, période de base, horizon et modèle demeurent `null` dans le JSON fourni, conservé intégralement.
- Les aperçus des portails sont explicitement illustratifs. Ils présentent les fonctions déjà décrites dans le projet, sans chiffre, société, document privé ni point minier fictif. Le contour du Burkina Faso provient du fond géographique déjà présent dans `src/data/artisanalSitesData.ts`.
- Le rôle d’un visiteur n’est jamais changé par un onglet. Les CTA utilisent `/login` ; l’authentification existante conserve le choix du périmètre habilité. Le lien « Retour à la vitrine » de la connexion a également été testé.
- Public Sans est auto-hébergée, avec sa licence et sa provenance dans `public/fonts/public-sans/`. Source primaire : [dépôt USWDS Public Sans](https://github.com/uswds/public-sans). Le fichier variable original est converti en WOFF2, sans changement de dessin. Les styles sont limités à `.faso-public`.
- Les trois PNG IA sont des copies identiques à celles fournies : empreintes SHA-256 vérifiées. Les variantes WebP, de mêmes dimensions 1672 × 941, allègent le chargement sans ajouter d’effets. Voir [manifeste des ressources](assets-manifest.json). Le premier visuel est prioritaire, les suivants différés. Aucun ancien visuel sans IA n’est employé dans le carrousel.

## Vérifications et preuves

Les contrôles navigateur portent sur 1440, 1024, 768 et 390 px, plus un contrôle à 320 px. Les neuf sections centrales restent présentes, Public Sans est chargée et aucun débordement horizontal de page n’a été relevé. Le défilement horizontal des onglets de portail est local et intentionnel. Les commandes contrôlées mesurent au moins 44 px de hauteur. Les ancres mobiles restent sous le header.

Captures natives de l’application exécutée dans Chrome :

- [Page entière — ordinateur 1440 px](desktop-1440.png)
- [Page entière — téléphone 390 px](mobile-390.png)
- [Contrôle intégral 1024 px](page-1024.png)
- [Contrôle intégral 768 px](page-768.png)
- [Hero — recettes fiscales](hero-01-recettes.png)
- [Hero — contrôle des flux](hero-02-controle.png)
- [Hero — traçabilité et drone](hero-03-tracabilite.png)
- [Portail Collecteurs sur mobile](portail-collecteurs-mobile.png)
- [Étape Fiscalité](trace-fiscalite.png)

Les captures intégrales utilisent une hauteur de viewport calée sur le bas du footer, après les contrôles aux dimensions d’écran usuelles. Cette capture native évite les duplications de fragments produites par l’assemblage automatique du navigateur de contrôle. Il n’y a ni montage d’images ni reconstruction de la page.

Les détails des interactions, chemins et mesures sont conservés dans [browser-checks.json](browser-checks.json). Les tests ciblent notamment les risques du carrousel, les états des indicateurs, les panneaux, les liens et le focus ; ils ne remplacent pas la revue visuelle.

## Écarts explicités

1. Les cinq statistiques nationales sont indisponibles, sans substitution par des valeurs de démonstration. La section est développée et vérifiée ; seules les données validées restent à fournir.
2. Le visuel de détail de la traçabilité emploie le recadrage prévu en solution de repli : premier visuel fourni sans IA, centré sur l’or au premier plan. Aucun gros plan supplémentaire n’a été généré.
3. La photo du hero conserve son format intégral afin de préserver visages, hologrammes et drone. La hauteur de la zone de texte reste stable entre diapositives ; le cadrage est plus large que dans l’ancienne maquette à hero unique.
4. Les aperçus privés sont remplacés par des présentations fonctionnelles neutres et marquées « Aperçu illustratif ». Aucun indicateur confidentiel ou inventé n’est exposé.

Les résultats finaux des commandes et l’état de publication sont consignés dans le compte rendu de livraison.

## Résultats des contrôles — 7 septembre 2026

| Contrôle | Résultat |
|---|---|
| `npm run lint` | Réussi, y compris le contrôle des libellés français. |
| `npm run typecheck` | Réussi, couverture du schéma et compilation TypeScript. |
| `npx vitest run --maxWorkers=6 --exclude ''backups/**''` | 347 fichiers, 2 541 tests réussis, aucun échec. Les sauvegardes locales ne font pas partie du code applicatif. |
| Tests publics et entrée vers les portails, après le dernier correctif clavier | 65 tests réussis, dont 36 scénarios de routage et d’autorisation. |
| `npm run build` | Réussi. Précache public corrigé pour correspondre au nom réel du CSS compilé. |
| `git diff --check` | Réussi. |
| Navigateur, version compilée sur `127.0.0.1:5180` | Public Sans chargée ; priorité du premier visuel vérifiée ; pause par Entrée fonctionnelle ; aucune erreur ni avertissement dans le nouvel onglet de contrôle. |

Le premier lancement général avait identifié un ancien sélecteur « Connexion » dans le test d’entrée et une copie de test dans les sauvegardes. Le sélecteur suit maintenant le libellé spécifié « Accéder à mon espace », avec toutes les assertions sur les profils conservées. Le contrôle navigateur a aussi révélé puis permis de corriger une interaction entre Entrée et la pause du carrousel. Le test ajouté vérifie pause et reprise. La suite générale a précédé ce dernier correctif ; les 65 tests ciblés ont été exécutés après.

Voir [résultats structurés](test-results.json). La préférence de réduction des animations est testée automatiquement ; elle n’a pas été modifiée dans les réglages système du poste.
