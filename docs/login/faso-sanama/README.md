# Page de connexion Faso SANAMA — vérification du 6 septembre 2026

## État de livraison

Refonte intégrée et vérifiée localement sur `/login`. **La fidélité graphique finale reste en attente du logo original Faso SANAMA** cité dans le document de conception (`23cfbf74-46af-45dc-8a5c-385739c94e11.png`). Ce fichier n'a pas été retrouvé dans le projet ni parmi les ressources locales consultées. Le PDF des cartes contient une image de carte aplatie, pas le logo séparé. Le PNG « Faso SANAM » des téléchargements correspond à une autre identité (« Faso Sanem Digital ») et n'a pas été utilisé.

Le composant attend `public/login-faso/faso-sanama.png`. En cas d'image indisponible, un simple texte « Faso SANAMA » préserve la lisibilité de la marque. Ce texte constitue un repli explicite, pas une reproduction du logo. Il faut intégrer l'original, vérifier son cadrage et reprendre les captures avant de déclarer la livraison graphique achevée. Aucune publication de ce lot ni aucun commit/push n'a été effectué.

## Périmètre

- `src/pages/Login.tsx` : structure, cinq institutions, textes exacts, métadonnées propres à la connexion, verrou contre les soumissions simultanées et repli de marque.
- `src/pages/Login.css` : thème local `.faso-login`, typographie, décor séparé, carte et mise en page selon la largeur et la hauteur disponibles.
- `src/i18n/locales/{fr,en}/common.json` : uniquement le bloc `login`. Le français reste la seule langue activée ; l'anglais reste signalé comme indisponible.
- `src/pages/Login.component.test.tsx` : conservation des contrats de connexion et protection de la nouvelle présentation.
- `public/login-faso/` : ressources locales de la page.

Les formulaires sites et artisans, les portails, les permissions, les migrations et les services métier n'ont pas été modifiés. L'explication du rôle économique de la SONASP ne s'est pas traduite par des changements de workflows.

## Parcours d'authentification conservé

`App` → `PrivateApp` → `MandatoryMfaGate` → `PublicRoute` → `Login` → `AuthContext.signIn` → Supabase Auth → profil autoritatif/session serveur → redirection contrôlée vers le portail autorisé.

Le libellé « Nom d’utilisateur » est préservé. Le service continue à normaliser l'adresse électronique avant `signInWithPassword`. Les contrôles du profil actif, du second facteur, de la session, de la persistance limitée à l'onglet et des portails restent ceux de l'application. Les erreurs connues sont traduites et les erreurs techniques inattendues ne sont pas affichées.

Les liens utilisent `/`, `/recuperer-acces`, `/assistance#incident`, `/assistance` et `/confidentialite`.

## Ressources et provenance

| Ressource | Origine et traitement |
| --- | --- |
| `reference.png` | Copie de la maquette jointe par l'utilisateur, réservée à la comparaison. Jamais utilisée comme fond de l'application. |
| Logo Faso SANAMA | **Original manquant** ; emplacement attendu indiqué ci-dessus. Aucun logo redessiné ou généré. |
| Logo SONASP | Fichier existant `public/sonasp_logo.png`, proportions préservées. |
| `armoiries.png` | [Armoiries publiées par la Présidence du Faso](https://www.presidencedufaso.bf/les-armoiries/), [fichier source](https://www.presidencedufaso.bf/wp-content/uploads/2025/05/armoiries-1.png). Réduction proportionnelle à 400 × 470 pixels maximum. |
| `bumigeb.png` | [Site officiel du BUMIGEB](https://www.bumigeb.bf/), [fichier de logo](https://www.bumigeb.bf/storage/images/logo.png), fichier conservé sans déformation. |
| `mine-sunrise.avif` et `.webp` | Décor reconstitué avec l'outil intégré de génération d'images, puis encodé en deux formats. Aucun texte, logo ou contrôle dans cette image. |
| `roboto-latin.woff2` | Police variable Roboto issue du dépôt officiel Google Fonts, caractères latins et ponctuation française. Licence `Roboto-OFL.txt` conservée. |
| `contours.svg` | Motif décoratif vectoriel local, sans contenu fonctionnel. |

Les armoiries officielles récupérées possèdent un cadre et le logo officiel BUMIGEB est ovale : ils diffèrent des représentations stylisées de la maquette. Leurs proportions originales ont été conservées conformément à la priorité donnée aux originaux. Pour une reproduction des emblèmes strictement identique à la maquette, les fichiers graphiques correspondants sont également nécessaires.

### Prompt du décor généré

Outil intégré `image_gen`, sans API externe ni génération de logo. Original conservé dans le dossier de génération Codex, copie optimisée dans le projet :

> Use case: photorealistic-natural. Asset type: standalone decorative photographic background for the left side of a national mining portal login page. Input reference: supplied complete UI image, ONLY its lower-left mining landscape is the visual reference. Generate JUST the photographic backdrop, no interface, no lettering, no logos, no institutions, no ornament lines, no borders. Landscape ratio 3:2. Recreate reference composition closely: sweeping terraced open pit gold mine across the lower half and left, pale dusty Burkina Faso hills, small yellow mining truck at extreme lower left, warm sunrise at the right horizon near 70% image height, impressive realistically textured shining irregular GOLD NUGGETS in the immediate lower right foreground (occupying rightmost 25% and bottom 30%). Upper half is very pale ivory sky with delicate warm clouds, ample nearly white negative space to overlay live text later. Horizon and golden landscape softly fade into the ivory upper sky, left middle stays pale enough for dark title overlay. Elegant, realistic, sharp terraced geology, photographic detail, premium natural sunrise light. The final image must extend edge to edge as a complete landscape, no framing or website elements.

## Contrôles

- Suite complète Vitest : **330 fichiers, 2 401 tests réussis**. Après ajout du repli en cas de logo indisponible, les **18 tests ciblés de connexion** passent également.
- `npm run typecheck`, `npm run lint`, `npm run build` et `git diff --check` : réussis.
- Navigateur, vraie application compilée : formulaire vide et focus, masquage/affichage du mot de passe, récupération d'accès, assistance et confidentialité vérifiés. Aucun message d'assistance ni formulaire métier soumis.
- Identifiants invalides, erreur réseau, réessai, Entrée et soumissions simultanées : tests de composant avec service d'authentification simulé, explicitement distincts d'une connexion réelle.
- Redirections d'un utilisateur connecté, cloisonnement des portails, session absente/expirée et MFA : tests existants exécutés dans la suite complète. Aucun identifiant de test autorisé n'a été fourni pour refaire une connexion réelle et son challenge MFA ; ces deux étapes n'ont pas été exécutées dans le navigateur.
- 1920 × 1080 et 1366 × 768 : titre, formulaire, institutions et pied de page visibles sans défilement. Mobile 390 et 320 pixels : défilement vertical, accès au formulaire et aux institutions, aucun débordement horizontal. Fenêtre 960 × 540 : repli et défilement vérifiés ; ce contrôle ne constitue pas un essai du zoom natif du navigateur.
- Les cinq images institutionnelles chargent. Le logo Faso SANAMA reste manquant et déclenche le repli textuel. Une erreur de chargement de module observée sur la page légale pendant le remplacement local de `dist` a disparu après rechargement ; les contrôles finaux sont réalisés sur une compilation stable.

Les mesures DOM sont enregistrées dans `viewport-checks.json`. Les captures de la route réelle sont dans `captures/`. `comparaison.html` permet de confronter la page à la maquette, côte à côte ou par superposition. Aucun pourcentage de fidélité n'est revendiqué.
