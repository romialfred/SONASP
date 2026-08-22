# Page de connexion SONASP — rapport d’implémentation

## Référence et résultat

- Référence contractuelle : `reference/login-sonasp-reference.png`
- Dimensions vérifiées : **1752 × 898 px**
- SHA-256 de la référence : `EC7E1250F5A925532C37AA77DBB7A68BFDECEB867FFEA5A27AAC078205DCF1BC`
- Capture finale : `captures/login-sonasp-final-1752x898.png`
- Comparaison côte à côte : `captures/login-sonasp-comparison-side-by-side.png`
- Superposition à 50 % : `captures/login-sonasp-overlay-50.png`
- Différence absolue : `captures/login-sonasp-difference.png`
- Contrôles responsive : `captures/login-sonasp-final-768x1024.png` et `captures/login-sonasp-final-390x844.png`

La comparaison pixel donne une erreur absolue moyenne normalisée de **7,21 %** sur l’image complète et de **4,02 %** sur le panneau droit. L’écart global restant provient surtout de la photographie source, qui n’était pas disponible dans le dépôt. La géométrie du formulaire a été mesurée indépendamment.

## Géométrie finale à 1752 × 898

| Élément | Mesure finale |
| --- | --- |
| Séparation | x = 979 px en haut, x = 866 px à 52 %, retour x = 979 px en bas |
| Carte | x = 1046, y = 98, 624 × 726 px |
| Sélecteur de langue | x = 1544, y = 28, 169 × 46 px |
| Logo | x = 70, y = 119, 270 × 103 px |
| Copyright | y = 851 px |
| Champs | 57 px de haut |
| Bouton | 55 px de haut |
| Débordement | aucun, document 1752 × 898 |

## Audit de l’authentification existante

1. Route de connexion : `/login`, protégée par `PublicRoute`.
2. Récupération : `/recuperer-acces`, reliée à `supabase.auth.resetPasswordForEmail` ; retour `/reset-password`.
3. Identifiant réel attendu : **adresse de courriel Supabase**, normalisée avec `trim().toLowerCase()`. Le libellé « Nom d’utilisateur » est conservé pour respecter la maquette ; la plateforme ne possède pas de service de résolution d’alias utilisateur.
4. « Se souvenir de moi » : jeton GoTrue conservé dans `localStorage` si coché, dans `sessionStorage` sinon. Aucun jeton parallèle n’est créé.
5. Redirections : `getDefaultRoute` selon rôle ; les représentants de mine restent dans `/portail-mine`.
6. Compte désactivé : vérification immédiate du profil autoritatif après GoTrue, journalisation du refus, suppression de la session et message `ACCOUNT_NOT_AUTHORIZED` transformé en phrase professionnelle.
7. Échecs : identifiants, compte non confirmé, limite de tentatives, réseau et erreurs inconnues sont convertis sans exposer de réponse brute.
8. Déconnexion : `supabase.auth.signOut`, arrêt de `SessionManager` et purge de l’état local.
9. Session : PKCE, rafraîchissement automatique, stockage `gold-shipper-auth`, délai d’inactivité géré par `SessionManager`.
10. Tentatives répétées : les réponses de limitation GoTrue sont traitées ; les événements `login_failed`, `login_success` et `login_denied_inactive_account` sont journalisés par le RPC existant.

## Responsive vérifié

Les neuf formats demandés ont été testés dans le navigateur réel. Aucun débordement horizontal ni chevauchement formulaire/langue n’a été détecté.

| Format | Disposition | Document |
| --- | --- | --- |
| 1752 × 898 | deux panneaux | 1752 × 898 |
| 1440 × 900 | deux panneaux | 1440 × 900 |
| 1366 × 768 | deux panneaux compactés | 1366 × 768 |
| 1280 × 800 | deux panneaux compactés | 1280 × 800 |
| 1024 × 768 | empilée | 1009 × 1140, défilement vertical |
| 768 × 1024 | empilée | 753 × 1110, défilement vertical |
| 430 × 932 | empilée | 430 × 932 |
| 390 × 844 | empilée | 375 × 897, défilement vertical |
| 360 × 800 | empilée | 345 × 926, défilement vertical |

## Accessibilité

- un formulaire natif, trois entrées et trois labels associés ;
- aucun identifiant dupliqué, label cassé, bouton/lien sans nom ou image sans `alt` ;
- messages requis annoncés avec `role="alert"` et focus replacé sur le premier champ invalide ;
- ordre de tabulation couvert par test ;
- bouton d’affichage du mot de passe accessible et non soumetteur ;
- langue du document synchronisée (`fr-BF` / `en`) ;
- focus visible, état chargement et désactivation des contrôles ;
- contraste du bouton : **5,88:1** ; texte principal : **15,66:1** ; texte secondaire : **5,08:1** ; surtitre doré : **6,31:1** ; bordure de champ : **3,08:1**.

Audit DOM final : 1 formulaire, 3 champs, 3 labels, 8 contrôles accessibles, 0 erreur de console.

## Vérifications techniques

- Tests ciblés authentification/connexion : **18/18**.
- Non-régression : **91 fichiers, 829 tests, tous réussis** (`--maxWorkers=4`).
- Build Vite/PWA de production : réussi.
- ESLint ciblé : 0 erreur, 0 avertissement.
- ESLint global historique : 75 erreurs et 95 avertissements, principalement dans `SalesDashboard.tsx` et `SaleDetails.tsx`, sans diagnostic sur les fichiers de cette mission.
- TypeScript global historique : 129 diagnostics ; le module `@/types/database` manque déjà dans le dépôt et les autres diagnostics concernent des écrans existants. Aucun nouveau diagnostic lié à la page de connexion.

## Ressources

- `public/login-gold-background.avif` : 95 463 octets.
- `public/login-gold-background.webp` : 200 890 octets.
- `public/login-pattern.svg` : motif décoratif léger.
- Le logo officiel existant `public/sonasp-logo-clair.png` est réutilisé sans reconstruction.

La photographie contractuelle originale n’ayant pas été trouvée, une photographie réaliste sans texte ni interface a été générée avec l’outil intégré, puis recadrée et optimisée. Elle doit être remplacée par le fichier photographique officiel si la SONASP le fournit. La mention de connexion chiffrée est conforme à l’intention de production, mais son respect effectif dépend du déploiement sous HTTPS ; l’environnement local de contrôle utilise HTTP.

## Fichiers applicatifs modifiés ou ajoutés

- `src/pages/Login.tsx`
- `src/pages/Login.css`
- `src/pages/Login.test.ts`
- `src/pages/Login.component.test.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/AuthContext.fallback.test.tsx`
- `src/lib/supabase.ts`
- `src/lib/supabase.persistence.test.ts`
- `src/i18n/locales/fr/common.json`
- `src/i18n/locales/en/common.json`
- `public/login-gold-background.avif`
- `public/login-gold-background.webp`
- `public/login-pattern.svg`
- `docs/login/reference/*`
- `docs/login/captures/*`
