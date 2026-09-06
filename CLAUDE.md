# CLAUDE.md — Passation rigoureuse du projet SONASP

> Consigne permanente de Claude Code pour ce dépôt. Lire intégralement ce fichier au début de chaque session, puis vérifier les faits dans le code et dans Git avant toute modification.

## 1. Mission

Tu reprends une plateforme nationale burkinabè de collecte, de traçabilité et de commercialisation de l'or. Le produit existe déjà et contient plusieurs portails, des workflows réglementaires et financiers, une authentification forte et un important historique PostgreSQL/Supabase.

Objectif : améliorer l'existant avec une exigence de niveau production.

- Corriger la cause racine des anomalies, pas seulement leur symptôme.
- Préserver les workflows qui fonctionnent et empêcher toute régression.
- Garantir le cloisonnement des données entre organisations.
- Produire une interface sobre, raffinée, cohérente et réellement fonctionnelle.
- Prouver chaque correction par des tests proportionnés au risque.
- Ne jamais présenter comme vérifié ce qui ne l'a pas été.

Ne reconstruis pas la plateforme à partir de zéro. Ne remplace pas une fonctionnalité complète par une maquette, des données statiques ou un composant décoratif.

## 2. État de référence vérifié le 25 août 2026

| Élément | Valeur |
|---|---|
| Dépôt local | `F:\Development\SONASP` |
| Branche | `SONASP_2026` |
| Commit local et distant | `d1b52e919c6a69ff5b61f90bd7fe50407f450dc6` |
| Dernier correctif | restauration de la suppression sécurisée des comptes |
| Dépôt distant | `https://github.com/romialfred/SONASP.git` |
| Production | `https://sonasp.data-univers.com` |
| Build Vercel vérifié | `d1b52e919c6a-mt8mpo0j` |
| Projet Vercel | `business-tech-services/sonasp` |
| Projet Supabase | `yyverzuhkdonjjuficor` |
| Serveur local | `http://127.0.0.1:5180` |

Cette table est un point de départ. Recalcule l'état au début de chaque session. La dernière validation complète connue a réussi : lint, build, 207 fichiers de tests et 1 569 tests. Ne réutilise pas ces chiffres comme preuve d'un nouveau changement sans relancer les contrôles nécessaires.

## 3. Démarrage obligatoire de chaque session

Avant d'éditer :

1. Exécute `git status --short`, `git branch --show-current` et `git log -5 --oneline`.
2. Exécute `git fetch origin` si le réseau est disponible, puis compare `HEAD...origin/SONASP_2026`.
3. Repère les modifications non committées. Elles peuvent appartenir à une autre session : ne les écrase, reformate ou indexe jamais sans preuve.
4. Lis les fichiers concernés, leurs tests, services et migrations contractuelles.
5. Consulte `git log -- <fichier>` et, si nécessaire, `git blame` avant d'annuler une décision récente.
6. Formule une hypothèse de cause racine et une stratégie de preuve.
7. Limite le diff au périmètre demandé. Explique tout élargissement nécessaire.

Dans un worktree sale, travaille autour des changements existants. N'utilise jamais `git reset --hard`, `git checkout --`, une suppression récursive large ou une commande détruisant le travail d'une autre session.

### Lancement local (30 août 2026)

Pour « démarrer la plateforme en local », utiliser **`npm start` / SONASP Local sur 5180** : build puis serveur statique, sans rechargement HMR. Après un build déjà vérifié, `npm run serve:local` suffit. **`npm run dev` / SONASP Dev est réservé au développement sur 5181.** Ne pas forcer `vite --port 5180` : la reconnexion de son client recharge le document et peut détruire les saisies au retour d’onglet. Préserver l’origine (`localhost` ou `127.0.0.1`) de la session de l’utilisateur. Voir `docs/ui-lifecycle-and-refresh-policy.md`.

## 4. Sources de vérité

Ordre de confiance :

1. schéma live observé en lecture seule, code et tests actuels ;
2. migrations canoniques récentes et `supabase/migrations.catalogue.json` ;
3. historique Git et journaux d'implémentation ;
4. audits et documentation, parfois antérieurs aux derniers correctifs.

Documents prioritaires :

- `docs/audits/AUDIT_COMPLET_SECURITE_ROBUSTESSE_PERFORMANCE_2026-08-24.md`
- `docs/audits/BASELINE-MIGRATIONS-ET-REPRODUCTIBILITE-2026-08-24.md`
- `docs/audits/RUNBOOK-CONTROLES-EXTERNES-SECURITE-2026-08-24.md`
- `docs/AUDIT-ROLES-WORKFLOWS-SECURITE-2026-08-23.md`
- `docs/CARTOGRAPHIE-FONCTIONNELLE-2026-08-22.md`
- `docs/MATRICE-TESTS-2026-08-22.md`
- `docs/JOURNAL-IMPLEMENTATION.md`
- `IMPLEMENTATION_PROGRESS.md`

Attention : les audits des 23–24 août sont des baselines historiques. Plusieurs P0 ont été corrigés ensuite par les lots 4A–4I, 2K–2M et 5E. Ne réapplique jamais une recommandation ancienne sans vérifier le code, la base et les tests actuels. Le `README.md` est historique et sous-estime fortement le nombre de migrations.

## 5. Architecture

```text
Navigateur React 18 / Vite / TypeScript
        |
        +-- vitrine publique et pages légales
        |
        +-- application privée lazy-loaded
                |
                +-- Auth Supabase PKCE + profil autoritatif
                +-- MFA obligatoire / AAL2
                +-- ProtectedRoute + guards par portail
                +-- capabilities calculées côté serveur
                |
                v
        Supabase PostgREST / RPC / Edge Functions
                |
                +-- PostgreSQL + contraintes + triggers
                +-- RLS et cloisonnement par tenant
                +-- Storage privé et URL signées
                +-- audit et sessions applicatives
                |
                v
        Vercel + Supabase hébergé
```

Socle : React 18, React Router 7, TypeScript, Vite 7, Tailwind, Supabase Auth/PostgreSQL/RLS/Storage/Edge Functions, Vitest, Testing Library, Recharts, jsPDF/PDF.js et PWA à mise à jour explicite.

Le routage public commence dans `src/App.tsx`. Les routes privées se trouvent dans `src/PrivateApp.tsx`. Une route visible ne constitue jamais à elle seule une autorisation : guards, capabilities, RLS et RPC doivent converger.

## 6. Portails et autorisations

### SONASP national

- `owner` : propriétaire national, protégé contre suppression et déclassement ;
- `admin` : administration technique selon capabilities ;
- `management` : direction et opérations nationales avec séparation des tâches ;
- `manager` : lecture consolidée sans mutation ni validation.

### Société minière

- rôle canonique `mine` ;
- une société ne doit pas avoir deux comptes principaux ;
- lectures et écritures limitées à `mining_company_id` ;
- tenant dérivé du profil serveur, jamais choisi dans un formulaire ;
- nom court affiché dans le chrome, sans répétition dans chaque carte ou titre ;
- capacités usine/aéroport historiques intégrées sans accès inter-mine.

### Comptoir d'achat

Le comptoir est gouverné par des capabilities comme `comptoir.manage`, pas par un rôle UI inventé. Il achète auprès des artisans/collecteurs autorisés, suit factures DGI, paiements, taxes, stocks et cessions à la SONASP. Il ne vend jamais à l'international.

### Collecteur

Le collecteur n'opère que sur les artisans assignés. Les rattachements sont historisés et validés côté serveur. Une sélection masquée dans l'interface ne remplace jamais RLS/RPC.

### Compatibilité

`factory`, `airport`, `refinery` et `customer` restent dans `UserRole`. Ne supprime ou ne fusionne pas ces valeurs sans migration, compatibilité et tests multi-profils.

`src/lib/capabilities.ts` est la grammaire d'autorisation. La liste serveur est autoritative. Une capability sensible ne se déduit jamais d'un rôle affiché ou d'un paramètre client.

## 7. Fichiers structurants

| Fichier | Responsabilité |
|---|---|
| `src/App.tsx` | frontière public/privé |
| `src/PrivateApp.tsx` | routes privées et guards |
| `src/contexts/AuthContext.tsx` | session, profil, connexion/déconnexion |
| `src/components/auth/ProtectedRoute.tsx` | accès général et échec fermé |
| `src/components/auth/MandatoryMfaGate.tsx` | enrôlement et vérification MFA |
| `src/lib/capabilities.ts` | capacités et compatibilité |
| `src/components/auth/*PortalGuard.tsx` | frontières Mine/Comptoir/Collecteur |
| `src/components/layout/NationalDashboardLayout.tsx` | chrome des portails |
| `src/components/layout/sidebarNavigation.ts` | menus par profil |
| `src/styles/design-system.css` | jetons `--sn-*` et styles `sn-*` |
| `src/components/ui/sn/index.tsx` | primitives UI communes |
| `src/lib/supabase.ts` | client Supabase |
| `src/lib/apiClient.ts` | appels réseau contrôlés |
| `src/services/userPermissionsService.ts` | écriture centralisée des permissions |
| `src/types/database.ts` | contrat TypeScript du schéma |
| `supabase/functions/_shared/` | politiques des Edge Functions |
| `supabase/migrations/` | évolution du schéma |
| `supabase/tests/` | contrats RLS et workflows |
| `vite.config.ts` | build, PWA, cache et version |
| `vercel.json` | headers, CSP, cache et routage |

Recherche une primitive avec `rg` avant de créer un nouveau composant ou service.

## 8. Doctrine de sécurité

### Auth et sessions

- Supabase Auth est l'identité ; `user_profiles` est le profil métier autoritatif.
- Profil absent, inactif ou inaccessible : échec fermé.
- Opération sensible : AAL2 contrôlé côté serveur, pas seulement une fenêtre MFA.
- Refresh token ou retour d'onglet ne doit ni renvoyer au login ni relancer l'enrôlement.
- Une session révoquée ne doit plus autoriser de RPC sensible.
- Aucun token, mot de passe, secret, URL signée ou document dans logs/tests/commits.

### Tenant et métier

- Dérive l'acteur de `auth.uid()` et le tenant du profil serveur.
- Refuse tout `actor_id`, rôle, société ou tenant sensible fourni par le navigateur.
- Les enfants conservent le tenant du parent ; utiliser FK/contraintes composites si nécessaire.
- Tests négatifs Mine A/Mine B, Comptoir A/Comptoir B et acteur non assigné obligatoires aux frontières multi-tenant.

### RLS, RPC et privilèges

- Une restriction frontend n'est jamais une protection de données.
- Transitions financières, réglementaires, stock, quota ou statut via RPC transactionnelle et idempotente.
- `SECURITY DEFINER` : `search_path` sûr, objets qualifiés, `PUBLIC`/`anon` révoqués, grant minimal.
- Ne jamais ajouter `USING (true)`/`WITH CHECK (true)` pour résoudre un 403.
- Ne jamais mettre `service_role` dans le navigateur.
- Audits sensibles écrits par le serveur et immuables pour le demandeur.

### Storage et externes

- Documents métier dans des buckets privés et URL signées courtes.
- Valider parent, tenant, taille, MIME et magic bytes côté serveur.
- Respecter les helpers de propriété/compensation dans `supabase/functions/_shared/`.
- DGI : aucun appel direct navigateur. Exiger Edge Function, allowlist HTTPS, secrets serveur, idempotence et transition SQL atomique.

### Suppression des comptes

Le correctif `d1b52e9` restaure une suppression en une action : absence d'activité vérifiée, owner/acteur/hiérarchie protégés, cible désactivée, sessions révoquées, audit puis suppression Auth. Ne réintroduis pas une désactivation manuelle préalable et ne relâche aucun contrôle.

## 9. Migrations Supabase

L'historique contient 148 SQL et une dette ancienne : versions dupliquées, préfixes 8/14 chiffres, fichiers non canoniques et dérive distant/local. Le catalogue immuable empêche une nouvelle dérive mais ne rend pas la chaîne reconstructible.

Règles absolues :

1. Ne renomme, fusionne ou modifie jamais une ancienne migration appliquée.
2. Ne lance jamais `supabase migration repair`, `supabase db reset` ou un reset hébergé sans plan explicitement validé.
3. Nouvelle migration additive, rejouable si possible, nommée `YYYYMMDDHHMMSS_description_en_snake_case.sql` avec timestamp UTC unique.
4. Ajouter préflight/postflight et contrats SQL pour les changements sensibles.
5. Mettre à jour `supabase/migrations.catalogue.json` dans le même commit. Générer un candidat :

   ```powershell
   node scripts/check-migration-integrity.mjs snapshot --output supabase/migrations.catalogue.candidate.json
   ```

   Comparer, remplacer uniquement si l'ajout est voulu, puis retirer le candidat.
6. Vérifier :

   ```powershell
   node --test tests/migrations/migration-integrity.node.mjs
   node scripts/check-migration-integrity.mjs verify
   ```

7. Avant application distante : `supabase db push --linked --dry-run` et examen exact. Si la dérive bloque, pas de `repair` improvisé ni de faux fichiers dans le dépôt ; proposer une procédure isolée et approuvée.
8. Une Edge Function se déploie séparément. Vérifier ensuite version ACTIVE et comportement négatif sans secret.

## 10. Doctrine UX et design

La plateforme doit être institutionnelle, moderne, élégante et sobre. Le design ne consiste pas à déplacer des blocs.

- Utiliser les jetons `--sn-*`/classes `sn-*` de `design-system.css`.
- Réutiliser `PageHeader`, `Section`, `Field`, `StatGrid`, `Badge`, `Note`, `DataTable`, `EmptyState`, `Segmented`, `ChoiceCards` depuis `ui/sn`.
- Utiliser `NationalDashboardLayout` ; ne pas propager `MainLayout` dans une refonte.
- Palette : vert institutionnel dominant, touches or, rouge réservé aux erreurs/dangers.
- Un seul titre principal et un sous-titre court si utile.
- Éviter titres répétés, tirets cadratins et textes décrivant l'implémentation interne.
- Guide de saisie : une définition simple par champ, idéalement une ligne.
- Dans un portail tenant, la société vient de la session : pas de liste déroulante ni de répétition du nom dans chaque bloc.
- Réduire la densité verbale. Une carte affiche indicateur, unité, tendance utile et action claire, pas un paragraphe académique.
- Tuiles compactes, bordure/accent subtil, hiérarchie nette, survol léger ; pas d'arc-en-ciel décoratif.
- Structurer les formulaires longs ; garder les actions visibles, éviter panneau droit étroit et double scroll.
- Aucun bouton, onglet ou menu décoratif. Une action visible fonctionne.
- États loading/vide/erreur/succès/lecture seule/interdit explicites.
- Tout texte utilisateur en français, erreurs techniques traduites sans masquer l'information utile.

Valider selon la portée à 360, 768, 1366, 1440 et 1920 px : aucun débordement, header/sidebar lisibles, tableaux numériques alignés, modales visibles, focus clavier, contraste AA et cohérence des quatre portails.

Pour une demande issue d'une capture, mesurer la structure existante et comparer une capture après correction. Ne jamais valider le design sur le seul code CSS.

## 11. Analyse d'un workflow

Toujours suivre :

```text
menu -> route -> guard -> page -> formulaire -> validation
     -> service/API -> RLS/RPC/Edge -> contraintes/triggers
     -> audit/notification -> lecture aval/tableau de bord
```

Vérifier : acteurs CRUD/validation/paiement, transitions refusées, idempotence, concurrence, unités/devises/taxes, tenant parent/enfant, pièces Storage, états réseau/UI, effets stock/licence/facture/paiement/rapport, routes retour et tests positifs/négatifs.

Ne résous pas un 404 PostgREST en masquant l'erreur : vérifier objet réel, migration appliquée, cache de schéma et permissions.

## 12. Méthode d'implémentation

1. Reproduire et caractériser.
2. Identifier le commit/contrat ayant introduit la régression.
3. Écrire ou adapter un test échouant avant correction.
4. Corriger la cause racine avec le diff minimal sûr.
5. Exécuter les tests ciblés.
6. Élargir aux tests de zone puis aux portes globales proportionnées.
7. Contrôler diff, fichiers non suivis et secrets.
8. Documenter résultat et limites.

Ne neutralise jamais test, RLS, type ou validation pour obtenir du vert. Ne capture pas silencieusement une exception pour afficher zéro ou une liste vide.

## 13. Portes qualité

```powershell
# ciblé
npx vitest run chemin/du/test.test.tsx

# clôture d'un lot normal/élevé
npm run lint
npm run typecheck
npx vitest run
npm run build
git diff --check
```

Pour une migration, ajouter les contrôles du chapitre 9 et les tests SQL concernés. Pour route/formulaire, smoke test navigateur du profil concerné. Pour auth : connexion, MFA, refresh, retour d'onglet, déconnexion et session révoquée.

Si une erreur de type est préexistante, le prouver ; n'en ajouter aucune. Des tests ciblés seuls ne permettent pas d'annoncer une validation globale.

## 14. Git et sessions concurrentes

- Commit/push uniquement sur demande explicite.
- Avant commit : `git fetch origin` et comparaison distante.
- Indexer les fichiers explicitement, jamais `git add .` dans un worktree partagé.
- Inspecter `git diff --cached --check`, le diff indexé et son résumé.
- Un commit = un résultat atomique.
- Après push : vérifier `HEAD`, `origin/SONASP_2026` et worktree propre.
- Ne jamais mélanger les fichiers d'une autre session ou d'un autre lot.

## 15. Déploiement

Déployer uniquement sur autorisation explicite.

### Vercel

Le push peut déclencher Vercel. Vérifier déploiement Ready, alias et :

Depuis l'incident du 6 septembre 2026 : publier les fichiers applicatifs committés via l'intégration Git de `SONASP_2026`. Ne jamais publier une copie locale contenant des améliorations absentes de Git : le push suivant les remplacerait. `npm run build:release` vérifie la provenance, les tests des sites/artisans et le typage avant compilation. Installer d'abord les migrations et Edge Functions requises. Voir `docs/publication-sites-artisans.md`.

```powershell
Invoke-WebRequest https://sonasp.data-univers.com/build-version.json
```

Le préfixe du `buildId` doit correspondre au commit. Vérifier pages publiques et assets concernés. La PWA attend une mise à jour explicite : aucun reload automatique au focus, retour réseau ou refresh token.

### Supabase

- appliquer seulement des migrations relues ;
- dry-run et catalogue avant mutation ;
- déployer séparément les Edge Functions nécessaires ;
- confirmer la version ACTIVE ;
- tests négatifs non destructifs ;
- aucune suppression réelle en production sans autorisation et cible de test identifiée.

## 16. Décisions ouvertes

- Historique des migrations divergent : verrouillé mais pas totalement réconcilié.
- Constats d'audits antérieurs à revalider avant de les classer ouverts.
- « Nom d'utilisateur » correspond techniquement à l'e-mail ; une vraie résolution d'identifiant exige une décision produit.
- Ne pas inventer l'adresse officielle d'assistance.
- DGI exige spécifications/secrets officiels ; ne jamais simuler une certification réelle.
- Ne pas ajouter de données de démonstration sans instruction explicite.

## 17. Compte rendu attendu

Rapporter factuellement : résultat, cause racine, fichiers/contrats modifiés, contrôles exacts, limites, état Git et, si autorisé, état Supabase/Vercel. Distinguer : vérifié statiquement, testé localement, testé en base isolée, déployé, testé en production.

## 18. Prompt de reprise immédiate

> Lis `CLAUDE.md` intégralement. Commence par auditer l'état Git sans modifier le worktree et identifie les changements éventuels d'autres sessions. Reformule la demande active en critères d'acceptation vérifiables. Inspecte le parcours complet, du menu jusqu'à la base et aux effets aval. Exécute un lot atomique selon l'autorisation donnée. Préserve le design system SONASP, le cloisonnement tenant, l'AAL2, la séparation des tâches et l'historique des migrations. Ajoute des tests de non-régression, passe les portes proportionnées au risque et livre un compte rendu fondé sur des preuves. Ne committe, ne pousse et ne déploie que sur instruction explicite.
