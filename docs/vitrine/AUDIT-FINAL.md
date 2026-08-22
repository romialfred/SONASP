# Audit final de la vitrine SONASP

## Synthèse

La vitrine est complète, intégrée à l’application et présentable localement. Aucun écart critique ouvert n’a été constaté dans le périmètre implémenté ni dans l’audit npm final. La mise en production reste conditionnée à l’origine HTTPS officielle, à l’application des migrations, à la configuration de la fonction d’assistance et à une décision formelle sur la dépendance XLSX historique.

| Domaine | Évaluation | Éléments contrôlés |
| --- | --- | --- |
| Fidélité visuelle | élevée | composition, palette, diagonale, hiérarchie, CTA et aperçu métier proches de la référence |
| UX/UI | validé | navigation vers des routes/sections réelles, états vides et erreurs compréhensibles |
| Responsive | validé | sept largeurs, aucun débordement horizontal |
| Accessibilité | validé avec contrôle manuel | landmarks, lien d’évitement, titres, labels, focus, Échap, tailles tactiles, mouvement réduit |
| Performance | validé avec réserve | images AVIF/WebP/JPEG, lazy loading, public séparé ; dette du bundle privé documentée |
| SEO | validé sous configuration | métadonnées par route, OG, données structurées, robots et sitemap sans domaine inventé |
| Sécurité publique | validé | aucune clé secrète, validation serveur, CORS restrictif, honeypot, temporisation, hachage et rate limiting |
| Sécurité Portail Mine | renforcée | contrôle fail-closed, société obligatoire, filtrage service et politiques/RPC renforcés |
| Qualité du code | validé avec dette historique | lint ciblé propre, composants et contenus typés ; 129 diagnostics TypeScript globaux préexistants |
| Dépendances | fortement amélioré | audit ramené de 26 à 3 alertes, sans critique ; PDF.js, jsPDF, autoTable et React Router mis à jour |
| Non-régression | validé | suite complète, build, routes publiques et privées |
| Contenus | validé avec réserve institutionnelle | aucune donnée publique inventée ; coordonnées non vérifiées volontairement omises |
| Images et identité | validé | logo conservé, armoiries officielles non générées, hero optimisé et déclaré comme illustration |

## Écarts résiduels

### P0 — Paramètres de production

À renseigner avant publication : `SONASP_PUBLIC_BASE_URL`, `PUBLIC_SITE_ORIGINS` et `ASSISTANCE_HASH_SALT`. Les migrations `031` et `032` doivent être appliquées, puis la fonction Edge déployée. Aucun domaine ou secret n’a été supposé.

### P0 — Décision sur XLSX

`xlsx@0.18.5` conserve deux avis de niveau élevé et le registre npm ne propose aucun correctif. Le composant est utilisé par plusieurs exports historiques du back-office, pas par la vitrine. Avant mise en production globale, le remplacer par une bibliothèque maintenue ou documenter une exception temporaire avec restriction stricte des classeurs non fiables.

### P1 — Dette historique du back-office

Le lint global conserve 75 erreurs et 95 avertissements, et le typecheck global 129 diagnostics, dans des modules antérieurs. Le bundle privé reste lourd. Ces points ne bloquent ni la vitrine ni le build, mais justifient une tranche technique distincte.

Vite/esbuild conservent deux avis affectant principalement le serveur de développement. Leur correction exige une migration majeure vers Vite 8 et une vérification de la chaîne de build ; le serveur de développement ne doit pas être exposé sur Internet.

### P1 — Sitemap des actualités dynamiques

Le sitemap couvre les sept routes publiques statiques. Les slugs publiés depuis Supabase nécessitent une génération dynamique côté hébergeur ou une fonction dédiée.

### P2 — Validation institutionnelle finale

Avant exposition officielle, faire approuver le visuel minier reconstitué, les textes juridiques et le domaine par la SONASP. Une photographie institutionnelle licenciée pourra remplacer le hero sans modifier la composition.

## Décision

Statut : **prête pour recette institutionnelle**. Le déploiement public global requiert la satisfaction des points P0. Aucune certification de sécurité ou d’accessibilité non démontrée n’est revendiquée.
