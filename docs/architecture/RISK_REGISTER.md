# Registre des risques

Sévérité = impact × probabilité. Un risque n'est clos que lorsqu'une vérification
l'atteste. Les faits cités ont été observés sur le projet hébergé
`yyverzuhkdonjjuficor` ou sur le miroir local.

| ID | Risque | Impact | Probabilité | Sévérité | Statut |
|---|---|---|---|---|---|
| R-01 | SSRF non authentifiée via l'extension `http` | critique | avérée | **critique** | **fermé** |
| R-02 | Élévation de privilège par modification de son propre profil | critique | avérée | **critique** | **fermé** |
| R-03 | Double réclamation de la taxe de développement communal | élevé | avérée | **élevé** | **fermé** |
| R-04 | Chaîne de vente export inopérante | élevé | avérée | **élevé** | **fermé** |
| R-05 | Privilèges hors RLS accordés aux rôles de l'API | moyen | possible | moyen | **fermé** |
| R-06 | Cloisonnement multi-tenant incomplet | élevé | **infirmée** | faible | **fermé** |
| R-07 | Interfaces locales divergeant des types générés | moyen | avérée | faible | **réduit** |
| R-08 | Dérive entre migrations du dépôt et production | moyen | avérée | moyen | ouvert |
| R-09 | Barème fiscal sans validation juridique | élevé | avérée | **élevé** | ouvert |
| R-10 | Montants financiers non arrondis en XOF | moyen | avérée | moyen | ouvert |
| R-11 | Fonctions Edge non déployées | moyen | avérée | moyen | ouvert |
| R-12 | Objets appelés par le code et absents du schéma | moyen | avérée | moyen | **réduit** |
| R-13 | Écriture anonyme sur snp_avoirs_achat | moyen | avérée | moyen | ouvert |

---

## R-01 — SSRF non authentifiée · FERMÉ

**Description.** L'extension `http` était installée dans `public`, exposée par
PostgREST, exécutable par `anon`. La clé anon étant publique par construction, tout
appelant pouvait faire émettre une requête HTTP arbitraire par la base.

**Preuve.** `POST /rest/v1/rpc/http_get` avec `{"uri":"http://127.0.0.1:1/"}`
répondait `HTTP 500 — Failed to connect to 127.0.0.1 port 1`.

**Mitigation.** Extension recréée dans `extensions`, non exposé par PostgREST.

**Vérification.** La même attaque répond `404 PGRST202`. Voir D-001.

**Résiduel.** Droits d'exécution toujours accordés ; défense en profondeur
incomplète. Demande une intervention sous `supabase_admin`.

---

## R-02 — Élévation de privilège · FERMÉ

**Description.** Le `WITH CHECK` de `users_update_own_profile` ne figeait que
`is_active`, et le déclencheur de versionnement ne levait d'exception que pour ce
champ. Un compte pouvait modifier son `role` et son `mining_company_id`.

**Preuve.** Sur le miroir, un compte `admin` s'est élevé à `management`.

**Mitigation.** Garde sur `current_user` dans le déclencheur. Voir D-002.

**Vérification.** Attaque refusée, administration légitime préservée.

---

## R-03 — Double réclamation fiscale · FERMÉ

**Description.** 16 573 105,49 FCFA réclamés une seconde fois sur une taxe déjà
soldée, sur 24 paiements.

**Mitigation.** Migration `20260825160000` appliquée : déclencheur détaché, doublons
annulés sans suppression.

**Vérification.** Avant : 24 lignes `autre` à reverser pour 16 573 105,49 FCFA.
Après : ces 24 lignes portent le statut `annule` et le motif `DOUBLON-TDC-20260825`.
Les trois autres taxes sont inchangées. Aucune ligne supprimée.

**Résiduel.** Le flux futur est assaini, l'historique des montants non arrondis ne
l'est pas — voir R-10.

---

## R-04 — Chaîne de vente export inopérante · FERMÉ

**Description.** Quatre RPC appelées par le code étaient absentes de la production,
ainsi que `snp_ventes_lots.released_at`. Création de vente et chaîne d'approbation
ne fonctionnaient pas.

**Mitigation.** Migrations `20260822171500` et `20260822173000` appliquées après
analyse d'ensemble. Impact données nul : aucune vente à réaligner, règle de
redevance déjà présente.

**Vérification.** Les quatre RPC répondent ; `sales`, `daily_production` et
`gold_prices_daily` répondent 200.

---

## R-05 — Privilèges hors RLS · FERMÉ

**Description.** `anon` et `authenticated` détenaient TRUNCATE, REFERENCES et
TRIGGER sur la quasi-totalité des tables. Ces privilèges échappent aux politiques :
TRUNCATE vide une table sans trace, TRIGGER fait exécuter du code lors des écritures
d'autrui.

**Nuance.** Non atteignables via PostgREST : pas de faille directe, mais la défense
en profondeur était annulée.

**Mitigation.** Migration `20260825170200` appliquée, privilèges par défaut corrigés
pour que les tables créées ensuite ne les reçoivent plus.

**Vérification.** Aucun des trois privilèges ne subsiste pour `anon` ni
`authenticated` ; seuls SELECT, INSERT, UPDATE et DELETE demeurent, tous filtrés par
RLS. Non-régression : `sales`, `daily_production`, `gold_prices_daily` et
`fx_rates_daily` répondent 200.

---

## R-06 — Cloisonnement multi-tenant · FERMÉ, hypothèse initiale infirmée

**Ce que l'audit annonçait.** Le cloisonnement par périmètre minier ne serait pas
posé, la migration prévue n'ayant jamais été appliquée.

**Ce que la mesure a établi.** Le cloisonnement était déjà en place et opérant. La
production emploie, sur `daily_production` comme ailleurs, le prédicat complet
`snp_est_agent_sonasp() OR snp_est_direction_lecture() OR mining_company_id =
snp_societe_utilisateur()` — celui-là même qu'il aurait fallu construire.

**Méthode.** La lecture des métadonnées s'est révélée trompeuse à deux reprises :
elle a d'abord manqué `freight_shipments`, cloisonnée par une fonction plutôt que
par la colonne, puis désigné comme non cloisonnées des tables qui l'étaient. Seul
l'essai empirique tranche : pour chacune des 34 tables portant
`mining_company_id`, un compte minier a tenté de compter les lignes d'une autre
société. Vingt de ces tables en contenaient réellement — jusqu'à 209 lignes.

**Résultat.** Une seule table laissait voir des données tierces :
`expedition_lot_counters`, dont la politique de lecture portait `USING (true)`.
Sept lignes d'une autre société y étaient visibles. Corrigée par la migration
`20260825270000`, avec le prédicat standard.

**Contrôle inverse.** Un agent national voit toujours 221 productions sur 221, 16
préparations d'expédition et 53 achats miniers ; il voit les 9 compteurs sur 9
après correction. Le cloisonnement ne prive personne de ce qui lui revient.

**Piège écarté.** Un premier essai concluait à l'absence de fuite, puis à la
privation totale d'un agent national. Les deux résultats étaient faux : le miroir
portait encore les 120 politiques de la migration `20260822170000`, appliquées
lors d'un test antérieur. Elles ont été retirées avant de conclure. La décision
D-005 d'écarter cette migration reste juste : elle n'emploie pas
`snp_est_direction_lecture` et aurait bien privé les rôles `admin` et `manager`.

---

## R-07 — Interfaces divergeant des types générés · OUVERT

**Description.** Des interfaces écrites à la main contredisent le schéma réel. Cas
avéré : `DailyProduction` déclarait deux colonnes nullables comme non nullables,
rendant le compilateur aveugle à treize accès fautifs et faisant tomber un écran en
présentation.

**Mitigation partielle.** Interface corrigée, treize accès protégés, trois tests de
non-régression.

**Traité depuis.** `src/types/database.ts` a été régénéré depuis le schéma vivant :
12 892 lignes portées à 17 446. Les objets créés dans la journée — procédures de
conciliation, référentiel fiscal, grands livres, avoirs — y figurent désormais,
ainsi que `snp_sessions_lister` et le type `snp_session_public`. La régénération
n'a introduit aucune erreur : le compilateur passe de 539 à 535.

**Résiduel.** Quatre incompatibilités d'affectation subsistent dans
`ShippingPreparationNew`. Les 18 relations encore signalées par
`typecheck:database` ne relèvent pas du typage mais de R-12 : elles n'existent pas
en base.

---

## R-08 — Dérive migrations dépôt / production · OUVERT

**Description.** Neuf migrations du dépôt n'ont jamais été appliquées ; certaines
sont désormais inapplicables telles quelles. Par ailleurs les migrations appliquées
par l'outil d'administration reçoivent un horodatage distinct du préfixe de fichier.

**Mitigation.** Analyse et arbitrage consignés en D-004. Le catalogue reste vérifié
sans dérive structurelle.

---

## R-09 — Barème fiscal sans validation juridique · OUVERT

**Description.** Trois jeux de taux contradictoires coexistent dans le dépôt, sans
validation tracée. Le FNDL n'a aucune définition, ni dans le code ni dans le schéma.

**Position retenue.** Ne rien inventer. Construire le moteur fiscal versionné et
paramétrable, charger les règles existantes, marquer celles qui demandent
confirmation. Ne jamais figer un taux dans le code.

**Point métier à confirmer.** Taux, assiettes et affectataires opposables pour TVA,
royalties et FNDL.

---

## R-10 — Montants non arrondis en XOF · OUVERT

**Description.** 36 ventes sur 39 portent des montants jusqu'à 42 décimales, dans une
devise sans subdivision. Le déclencheur historique en était une source ; sa
suppression traite le flux futur, pas l'historique.

---

## R-11 — Fonctions Edge non déployées · réduit, partiellement bloqué

**Description initiale.** 7 fonctions ACTIVE sur 16 codées. `sensitive-upload`,
voie prévue pour le rapport de laboratoire acheteur, n'était pas déployée alors que
`src/services/sensitiveUploadGateway.ts` l'appelle : les téléversements sensibles
échouaient donc en production.

**Traité.** `sensitive-upload` et `revoke-user-sessions` sont déployées et
vérifiées : les deux répondent `403 Requête non autorisée` sans habilitation, en
français et sans fuite d'information. `revoke-user-sessions` est appelée par
`src/services/userSessionService.ts` : la révocation de session était donc elle
aussi inopérante.

**Reste bloqué faute de secrets** — ces valeurs ne peuvent être inventées :

| Fonction | Secrets manquants |
|---|---|
| `fetch-daily-lbma-prices` | `GOLD_API_KEY`, `METALS_API_KEY` |
| `activate-account` | `ACTIVATION_RATE_LIMIT_SALT`, `SONASP_APP_URL` |
| `public-assistance` | `ASSISTANCE_HASH_SALT`, `PUBLIC_SITE_ORIGINS` |
| `scheduled-tasks` | `ALLOWED_ORIGIN`, `CRON_SECRET` |

`fetch-daily-lbma-prices` alimente le cours de l'or, dont la conciliation a besoin
pour figer un prix. Son déploiement suppose la fourniture des clés d'API.

**Déployables sans secret mais sans appelant** : `fetch-daily-fx-rates`,
`send-email`, `send-activation-email`. Aucun code source ne les invoque ; les
déployer n'apporterait rien tant qu'un appelant n'existe pas.

---

## R-12 — Dix-sept objets appelés par le code et absents du schéma · OUVERT, qualifié

**Ampleur mesurée.** Le contrôle `typecheck:database` signalait vingt relations
utilisées par `supabase.from()` et absentes des types. La vérification en base
établit que **dix-sept d'entre elles n'existent pas du tout** : ce n'est pas un
défaut de typage mais du code qui interroge le vide. La base ne compte que sept
vues, dont aucune ne correspond aux manquantes.

**Confirmé par appel réel** : 404 sur `user_login_history`,
`user_mining_company_access`, `current_inventory_status`, `fx_rate_comparison`,
`v_sales_price_analysis` et `snp_modules_actifs`, quand une relation réellement
présente répond 401.

**Écrans concernés** : historique de connexion, accès aux sociétés, inventaire,
analyse de change, prix de vente, modules actifs, licences d'export, résumé
déposants, raffinage.

**Trois natures distinctes, trois traitements.**

*Vues dérivables.* Leur source est unique et le mapping évident.

*Tables métier.* `user_mining_company_access` en est une : le code référence sa
contrainte `user_mining_company_access_granted_by_fkey`. La reconstituer
supposerait d'inventer ses règles d'attribution et de révocation.

*Modèles que le backend a déjà remplacés.* C'est le cas le plus instructif.
`user_login_history` n'a pas à être recréée : `snp_sessions_lister()` existe,
exécutable par `authenticated`, avec `snp_session_to_public()` qui filtre les
champs publics et `snp_session_require_access()` qui contrôle l'accès. La table
`user_sessions` porte des politiques mais **aucun GRANT** : elle est délibérément
inaccessible depuis l'API. Le défaut est donc dans le frontend, resté sur une
approche antérieure.

**Ce qui n'a pas été fait, et pourquoi.** Une vue `user_login_history` avait été
écrite puis retirée avant tout déploiement : elle aurait contourné l'architecture
de sécurité que les RPC mettent en place. Mieux vaut un écran franchement
inopérant qu'un écran affichant des données inventées ou contournant un contrôle.

**Traité.** `userLoginService` ne s'appuie plus sur `user_login_history` ni sur
la procédure `log_user_login`, l'une et l'autre inexistantes, mais sur
`userSessionService` et les procédures réellement en place. Réparer le service a
réparé du même coup ses consommateurs. `LoginSessionsTab`, `LoginHistoryTab` et
`UserStatsCard` affichent désormais l'état réel des sessions — active, révoquée,
expirée — au lieu d'un succès et d'un second facteur sans source.

**À savoir sur ces écrans.** Ils ne sont montés nulle part : `UserDetailsPage`,
la page réellement servie, a son propre onglet « Connexions » alimenté par
l'Edge Function `get-user-details`, déployée, et déclare elle-même ses sources
indisponibles. Ces quatre composants sont des vestiges d'une version antérieure.
Ils ont été corrigés plutôt que supprimés : justes et inutilisés vaut mieux que
faux et inutilisés, et la décision de les retirer revient au commanditaire.

**Traité ensuite : l'écran des cours.** `GoldPricesPage` interrogeait
`v_sales_price_analysis` et `v_monthly_sales_vs_market` puis faisait remonter
l'erreur — la page entière tombait. Les deux vues sont créées : leur définition
se déduisait sans ambiguïté, l'écran déclarant les colonnes attendues et chacune
se rapportant à une source unique et existante. Le cours de référence retenu est
`london_am_rate`, celui-là même que portent les ventes ; à défaut de cours publié
le jour de la vente, le dernier cours antérieur est utilisé, jamais un cours
postérieur. Les deux vues sont en `security_invoker` : vérifié sur le miroir, un
compte minier n'y voit qu'une vente sur vingt et une.

**Priorité établie par la mesure.** Sur les seize relations restantes, quinze
sont consommées par du code réellement monté ; seule `user_mining_company_access`
ne l'est pas — `SiteAccessTab` et `userMiningAccessService` sont orphelins, comme
les composants de session. La corriger n'aurait aucun effet fonctionnel.

**Écrans rétablis.** Trois lots de vues ont été créés, chacun parce que sa
définition se déduisait sans ambiguïté : l'analyse des prix de vente
(`v_sales_price_analysis`, `v_monthly_sales_vs_market`), la comparaison des taux
de change (`fx_rate_comparison`) et les paramètres de vente d'or
(`gold_sales_settings_view`). Toutes en `security_invoker`, aucune lisible sans
authentification.

**Ce dernier point n'est pas cosmétique** : `snp_creer_vente_export` s'appuie sur
`gold_sales_settings` pour refuser une vente à un client non autorisé et
plafonner la part de stock accessible. Ne pas pouvoir consulter ces paramètres
revenait à piloter à l'aveugle une règle qui, elle, s'applique.

**Mesure de priorité, corrigée deux fois.** Le premier comptage vérifiait si le
fichier consommateur était importé, non si la fonction appelante l'était ; au bon
niveau, la plupart des relations restantes servent du code mort. Ce second
comptage a lui-même deux angles morts : un composant React est monté en JSX et
non appelé — ce qui a failli faire manquer `fx_rate_comparison` — et quatre
services portent une fonction `getStatusHistory` homonyme, ce qui gonflait le
score de `shipping_status_history`.

**Reste : treize relations, toutes dans du code non appelé ou non dérivables.**

| Relation | Pourquoi elle n'est pas recréée |
|---|---|
| `user_mining_company_access` | table métier ; règles d'attribution à inventer |
| `shipping_status_history` | table ; le code référence sa contrainte `..._changed_by_fkey` |
| `refining_processes` | attend `document_url`, absente de toute table ; l'appelant gère déjà l'absence |
| `current_inventory_status`, `monthly_inventory_summary` | fonctions appelantes sans appelant |
| `fx_analysis_with_details`, `fx_rates_monthly` | idem ; `fx_rates_monthly_aggregated` existe sous un autre nom |
| `batches`, `depositor_contact_summary`, `user_activity_summary`, `v_export_licenses_summary`, `snp_modules_actifs` | idem |

Les recréer n'aurait aucun effet fonctionnel. La question à trancher pour
celles-ci n'est pas de les écrire mais de retirer le code mort qui les appelle.

---

## R-13 — Écriture anonyme sur `snp_avoirs_achat` · OUVERT

**Description.** La table préexistante `snp_avoirs_achat` accorde `INSERT`,
`UPDATE` et `DELETE` au rôle `anon`, en plus de `SELECT`. RLS la protège, mais le
privilège n'a aucune raison d'exister : un avoir est une pièce financière et
aucune vitrine publique ne l'écrit.

**Découvert** en vérifiant les droits des tables d'avoirs après création des
avoirs client, dont la lecture anonyme a été retirée (migration
`20260825260000`).

**Mitigation à faire.** Retirer les privilèges d'écriture à `anon`, après avoir
vérifié qu'aucun appelant légitime ne s'y appuie. Non traité dans le lot en
cours pour ne pas mêler une table d'achat à un incrément de conciliation.

