# Vitrine présidentielle Faso SANAMA

## Périmètre

La vitrine présente Faso SANAMA comme une plateforme de la Présidence du Faso. La SONASP figure parmi les acteurs, avec un rôle commercial. Les huit profils présentés sont : Présidence, sociétés minières, artisans et sites, comptoirs, collecteurs, DGMG, Finances/DGI et SONASP.

La présentation présidentielle fournie par l’utilisateur a servi de référence pour les trois axes (tracer, contrôler, décider), les acteurs et les huit étapes de la chaîne. Le document de décision et ses captures internes ne sont pas publiés. Les fonctions décrites ont été rapprochées des portails et des registres du code actuel. La vitrine ne présente ni indicateurs fictifs ni promesse de déploiement autonome sur les serveurs des mines.

Les conditions contractuelles des mines et le circuit de cession des comptoirs sont distingués. Les paiements des collecteurs sont présentés selon leurs habilitations. Tous les accès métiers passent par `/login` ; les autorisations des portails restent déterminées par le compte.

L’en-tête, le pied de page, l’assistance, les informations institutionnelles, les métadonnées, l’écran de chargement et le nom du manifeste reprennent la nouvelle identité. Les formulaires métier et les services d’authentification ne sont pas modifiés.

## Vérifications

- Tests Vitest de la zone publique et de la connexion : 44 tests réussis ; nouveau contrôle du retour en haut de page ajouté au test du layout et repassé après correction.
- ESLint et contrôle des libellés français réussis.
- Vérification TypeScript réussie avant les derniers ajustements de navigation ; la compilation de publication vérifie à nouveau les types.
- Chrome : sélection des huit acteurs, lecture du panneau correspondant et présence de l’accès sécurisé.
- Chrome : activation des huit étapes de traçabilité et vérification de leurs explications.
- Chrome : menu mobile, fermeture avec Échap, restitution du focus, retour à l’accueil par le logo, liens vers les informations institutionnelles et l’assistance.
- Chrome : aller-retour entre vitrine et connexion, panneau de connexion de 400 pixels avec son logo, sans défilement à 1440×1000 ; aucune erreur console après rechargement final de la vitrine.
- Formats : 320×568, 360×800, 390×844, 768×1024, 1024×768, 1366×768, 1440×900 et 1920×1080. Aucun élément de la vitrine, du bandeau ou de l’en-tête ne dépasse horizontalement.

Les [mesures du navigateur](./20260906/browser-checks.json) et les captures du dossier `20260906` documentent la vérification. Les pages publiques ne créent aucun enregistrement métier pendant ces essais.

## Reproduction

`npm run dev -- --host 127.0.0.1 --port 5181 --strictPort` sert à la vérification de développement. Pour la version locale stable, utiliser `npm run build:release` puis `npm run serve:local` sur le port 5180.

Contrôler les onglets des acteurs à la souris et au clavier (flèches, Début et Fin), les huit étapes, les liens de navigation, le menu mobile et les retours entre vitrine, assistance et connexion. Sur chaque largeur, vérifier l’absence de débordement, la lisibilité du logo, la visibilité des actions et la position du contenu sous l’en-tête fixe.
