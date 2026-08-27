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


---

## R-14 — Les noms de fichiers de migration ne sont pas ceux appliqués · OUVERT

**Description.** Les migrations de ce chantier ont été appliquées par l'outil
Supabase, qui attribue son propre horodatage au moment de l'exécution. Le dépôt
porte donc `20260825170000_retirer_extension_http_de_l_api.sql` là où la
production a enregistré `20260825172835_retirer_extension_http_de_l_api`. Vingt
fichiers environ sont dans ce cas.

**Conséquence.** Un `supabase db push` considérerait ces fichiers comme jamais
appliqués et tenterait de les rejouer. La plupart sont rejouables et leur
postflight les arrêterait, mais ce n'est pas vrai de toutes.

**Ce qui complique la réconciliation.** La correspondance n'est pas de un à un :
`20260825220000_rpc_conciliation_transactionnelle.sql` a été appliqué en trois
migrations distinctes (`conciliation_journal_idempotence`,
`rpc_conciliation_ouvrir_et_analyse`, `rpc_conciliation_valider`), et
`20260825230000_expliciter_droits_lecture_conciliation.sql` n'a aucun homologue
enregistré sous ce nom.

**Pourquoi ce n'est pas corrigé ici.** Renommer vingt fichiers sur une
correspondance qui n'est pas bijective demande une relecture pièce par pièce,
sans rapport avec la livraison en cours. Le faire vite serait le faire mal.

**Mitigation à faire.** Établir la table de correspondance exacte fichier →
version appliquée, renommer les fichiers jamais appliqués sous leur propre nom
— ce qui ne contrevient pas à la règle protégeant les migrations appliquées,
puisque ces noms-là ne l'ont jamais été — puis vérifier par
`supabase db push --linked --dry-run` qu'il ne reste rien en attente.

**En attendant.** Ne pas lancer `supabase db push` sur ce dépôt.

---

## Jeu de démonstration — ce qu'il faut savoir

Ajouté le 26 août 2026 à la demande expresse du commanditaire, par la migration
`20260826081432_jeu_demonstration_conciliation.sql`.

**Les taux ne sont pas une vérité juridique.** TVA 18 %, FNDL 1 %, redevance
progressive à 3/4/5 % selon le cours : ils illustrent le moteur. Chacun porte une
référence réglementaire commençant par « A confirmer » et devra être remplacé par
le barème opposable avant tout usage réel.

**Tout est marqué.** `DEMO-20260826` dans le commentaire des règles, dans les
observations des dossiers. Le retrait est rappelé en fin de migration.

**Ce que la démonstration ne peut pas montrer.** Les deux dossiers ont été
ouverts au nom du propriétaire. La procédure de validation refuse qu'un acteur
valide ce qu'il a préparé : le parcours ne va donc jusqu'au bout qu'avec un
second compte, de rôle `management`. Cette limite est le comportement attendu,
pas un défaut du jeu de données.

---

## R-15 — Barème fiscal · CONFIRMÉ ET EN VIGUEUR

**Description.** La migration `20260826083911_baremes_fiscaux_connus.sql` inscrit
un barème présenté comme « confirmé par le métier » : TVA 1,5 % pour les
comptoirs d'achat, 0 % pour les mines industrielles, redevance 3 / 5 / 6 % sur
des tranches de 4 000, 4 500 et 5 000 USD/oz.

**Ce qui a été vérifié.** Ces valeurs ne figurent ni dans
`Implementation-Concilliation.md`, ni dans les échanges de cette session. La
spécification évoque 18 % pour la TVA — « NE PAS considérer 18 % comme une
constante universelle » — et 1 % pour le FNDL, sans aucun barème de redevance
chiffré. Seul le FNDL à 1 % concorde.

**Pourquoi ce n'est pas bloquant aujourd'hui.** Les six règles sont en statut
`projet`, sans auteur ni approbation. La résolution fiscale ne retient que les
règles `approuvee` : aucune n'entre en vigueur tant qu'un acteur habilité ne
l'approuve pas depuis l'écran, ce qui inscrit alors son nom au dossier. Vérifié :
les six sont approuvables par le propriétaire, et aucune n'est en vigueur.

**Ce qu'il faut faire.** Confirmer chaque taux contre le texte opposable avant
approbation. Une fois approuvés, ils serviront à calculer des montants
définitifs.

**Effet de bord à connaître.** Les taux de démonstration ont reçu une date de fin
au 26 août 2026. Aucune règle n'est donc en vigueur à compter de cette date : un
dossier validé aujourd'hui signalera ses trois taxes comme non calculées. C'est
le comportement voulu — mieux vaut un montant absent qu'un montant faux — mais il
faut le savoir avant une démonstration.

---

## R-16 — Deux travaux parallèles ne se raccordaient pas · FERMÉ

**Description.** Le référentiel fiscal a reçu une notion de profil du vendeur, et
`snp_resoudre_regle_fiscale` un cinquième paramètre `p_profil_vendeur` dont le
défaut est `'tous'`. La validation de conciliation, écrite en parallèle sans
connaître ce changement, appelait la résolution avec trois arguments.

**Conséquence mesurée.** La TVA n'existe que sous les profils `comptoir` et
`mine_industrielle`. Résolue sous `'tous'`, elle ne renvoyait aucune règle :
vérifié en base, `profil 'tous'` → aucune règle, `mine_industrielle` → 0 %,
`comptoir` → 1,5 %. Chaque dossier aurait donc signalé la TVA comme non calculée,
indéfiniment.

**Correction.** `20260826095503_conciliation_transmettre_profil_vendeur.sql` lit
le profil sur la vente : `seller_type = 'mining_company'` donne
`mine_industrielle`. Prouvé de bout en bout : dossier validé avec
`profil_vendeur: mine_industrielle`, trois taxes ajustées, aucune sans règle.

**Ce qui reste à trancher.** `seller_type = 'sonasp'` ne correspond à aucun profil
du référentiel — la société nationale n'est ni un comptoir ni une mine. Le profil
`'tous'` est alors transmis, et la TVA sera signalée comme non calculée sur ces
ventes plutôt que supposée. Le régime fiscal des ventes de la SONASP relève d'une
décision métier.

---

## R-17 — Le contrat TypeScript du schéma retardait sur la base · FERMÉ

**Description.** La colonne `profil_vendeur` a été ajoutée à
`snp_regles_fiscales` et utilisée par le service et l'écran, sans être déclarée
dans `src/types/database.ts`. Le compilateur ne signalait rien : le typage de
cette table est trop lâche pour l'exiger.

**Pourquoi cela compte.** Un contrat de types qui décrit un schéma qu'il n'a
plus est précisément ce qui a produit le `TypeError: Cannot read properties of
null` corrigé cette semaine. Le compilateur ne protège que ce que le contrat
déclare honnêtement.

**Correction.** La colonne est déclarée aux trois emplacements de la table —
`Row` obligatoire, `Insert` et `Update` facultatifs, la base portant un défaut —
ainsi qu'aux arguments et au retour de `snp_resoudre_regle_fiscale`.

---

## R-18 — La porte `typecheck` n'atteint jamais le compilateur · OUVERT

**Description.** `npm run typecheck` enchaîne deux étapes :
`typecheck:database` puis `typecheck:compiler`. La première échoue sur les treize
relations fantômes de R-12 et interrompt la chaîne. `typecheck:compiler`, qui
lance `tsc --noEmit -p tsconfig.app.json`, n'est donc jamais exécuté.

**Aggravant.** `tsconfig.json` porte `"files": []` : lancer
`tsc --noEmit -p tsconfig.json` ne vérifie aucun fichier et rend « 0 erreur »
quel que soit l'état du code. Un contrôle mené ainsi ne démontre rien. Ce piège
a effectivement produit de faux constats de conformité le 26 août 2026.

**Ce que cela a laissé passer.** L'écran des paramètres référençait l'icône
`Timer` sans l'importer. Le build Vite a réussi, les faux contrôles de types
aussi ; seule la suite de tests a levé le `ReferenceError` au rendu du composant.

**Mitigation à faire.** Traiter R-12 pour débloquer la chaîne — les treize
relations n'existent pas en base et servent du code non appelé, la question est
de retirer ce code plutôt que de créer les objets. À défaut, exécuter
`typecheck:compiler` indépendamment de `typecheck:database`.

**En attendant.** Vérifier les types avec `tsconfig.app.json` explicitement,
jamais avec `tsconfig.json`.

---

## R-19 — Deux fonctionnalités étaient en panne sans le dire · FERMÉ

**Infractions d'artisans.** `artisanInfractionsService` interrogeait
`snp_artisan_infractions`, qui n'existait sous aucun nom. Trois pages vivantes
l'appellent au chargement : le dossier de l'artisan, le détail d'un constat, le
formulaire de constat. Toutes trois passent par `Promise.allSettled`, si bien que
l'échec ne plantait rien : **le dossier affichait « aucune infraction » alors que
la table n'existait pas**. Un agent en aurait conclu qu'un artisan est
irréprochable. La table est créée, cloisonnée par `snp_can_access_artisan()`
comme ses tables sœurs, avec ses contraintes de cohérence vérifiées.

**Export du raffinage.** Le sélecteur de colonnes offrait deux boutons, « CSV »
et « Excel ». Le format choisi n'était pas transmis à l'appelant : les deux
produisaient un fichier Excel, et le message de succès annonçait « Excel » dans
les deux cas. Le format traverse désormais jusqu'à l'export.

**Comment elles ont été trouvées.** Ni l'une ni l'autre par une lecture du code :
la première par le contrôle de couverture du schéma, la seconde par un paramètre
déclaré et jamais lu — une erreur `TS6133` que la porte `typecheck` n'atteignait
jamais (voir [[R-18]]).

---

## R-20 — Deux manques de conception, mis au jour en retirant du code mort · OUVERT

**Suivi intrajournalier des taux de change.** `intradayRates` est lu par
`saveEndOfDayFxSnapshot`, mais la seule fonction qui l'alimentait n'était appelée
de nulle part. L'instantané quotidien retombe donc toujours sur son chemin de
repli : ouverture, plus haut, plus bas et clôture y sont égaux à un relevé
unique. La fonction morte a été retirée et le repli porte désormais un
commentaire disant la vérité. **Rétablir un vrai suivi demande de brancher un
relevé périodique** — décision à prendre.

**Documents de raffinage sur un paiement.** Le code interrogeait
`refining_processes`, une table inexistante, et sans aucun lien avec le paiement :
il prenait les cinq lignes les plus récentes, quelle que soit la vente. Le bloc
est retiré. **Le rattachement reste à concevoir.**

---

## R-21 — Les corrections de `src/types/database.ts` sont fragiles · OUVERT

**Description.** Le fichier est généré, mais il est en pratique maintenu à la
main dans ce dépôt. Y figurent désormais : la colonne `profil_vendeur`, deux
procédures de session, la table `snp_artisan_infractions`, et surtout
**158 paramètres de procédure élargis à `null`**.

**Pourquoi cet élargissement.** Le générateur déclare un paramètre à défaut SQL
comme simplement optionnel (`p_motif?: string`), ce qui nie que SQL accepte
`NULL`. Réécrire les appels aurait été plus durable, mais dangereux : plusieurs
procédures ont un défaut qui n'est pas `NULL` — `snp_notifier` retombe sur
`'normale'`, `snp_enregistrer_reglement` sur `'virement'`. Omettre le paramètre
aurait silencieusement changé le calcul.

**Le risque.** Une régénération brute du fichier effacerait ces corrections et
ramènerait des centaines d'erreurs de types.

**Mitigation à faire.** Faire de la régénération une étape outillée qui réapplique
ces ajustements, ou corriger le générateur en amont.

---

## R-22 — Le détail d'un paiement rassemblait des documents d'autres ventes · FERMÉ

**Description.** `collectPaymentDocuments` réunissait six sources de pièces
justificatives. Seules deux étaient rattachées au paiement : la preuve bancaire
et la facture de la vente. Les quatre autres — documents de production,
certificats d'analyse, pièces d'expédition, licences d'export — prenaient les
lignes les plus récentes de leur table, sans aucun filtre : cent pièces
d'expédition, dix certificats, cinq licences. Un opérateur consultant un paiement
aurait vu des documents appartenant à d'autres ventes.

**Ce qui a empêché que cela se voie.** Ces mêmes blocs interrogeaient des
colonnes inexistantes : `batch_number` sur `daily_production`, `document_type`,
`document_url` et `uploaded_at` sur `production_documents`, `certificate_url` sur
`assay_certificates`. Les requêtes échouaient, les résultats étaient ignorés,
l'écran n'affichait rien. Le défaut de rattachement n'a jamais eu l'occasion de
se manifester.

**Pourquoi les blocs ont été retirés plutôt que réparés.** Corriger les noms de
colonnes aurait produit l'inverse du résultat cherché : des documents qui
s'affichent enfin, et qui sont les mauvais. Sur une plateforme où les pièces
fondent des paiements, l'erreur serait passée pour une amélioration.

**Ce qui reste à concevoir.** `daily_production` ne porte aucun lien vers une
vente : le rattachement des documents de production à un paiement n'existe pas
dans le schéma. Les certificats, pièces d'expédition et licences demandent le
même travail de liaison. L'écran montre désormais moins de documents, mais tous
lui appartiennent.

**Effet mesuré.** Onze erreurs de types résolues au passage ; 311 → 295.

---

## R-23 — Deux trous de couverture du barème fiscal · OUVERT

**Contexte.** Le barème a été approuvé le 26 août 2026 à 14 h 04 depuis l'écran,
par un acteur habilité. Les six règles sont en vigueur ; le moteur les résout.

**Premier trou — la redevance sous 4 000 USD/oz.** Le barème commence à
4 000 USD/oz. En deçà, aucune règle ne s'applique : la conciliation signale la
redevance comme non calculée plutôt que de supposer un taux. Mesuré :

| Cours | Redevance résolue |
|---|---|
| 3 500 et 3 999 USD/oz | aucune |
| 4 000 à 4 499 | 3 % |
| 4 500 à 4 999 | 5 % |
| 5 000 et au-delà | 6 % |

**Deux ventes sur dix-neuf** portent un cours inférieur à 4 000 USD/oz — le
minimum en base est 2 365. Leur redevance ne serait pas calculée.

**Second trou — la TVA des ventes SONASP.** La TVA n'existe que pour les profils
`comptoir` et `mine_industrielle`. Une vente dont `seller_type` vaut `sonasp`
est résolue sous le profil `tous`, pour lequel aucune règle de TVA n'existe :
sa TVA est signalée comme non calculée. Douze ventes sur dix-neuf sont dans ce
cas. Voir [[R-16]], où ce point était déjà relevé comme décision métier en
attente.

**Ce que la plateforme fait, et qui est correct.** Elle refuse de supposer. Un
montant absent est signalé à l'écran — « Aucune règle en vigueur pour : tva » —
plutôt qu'un montant faux présenté comme exact.

**Décisions attendues.** Faut-il une tranche de redevance sous 4 000 USD/oz ?
Quel régime de TVA pour les ventes de la SONASP elle-même ? Les deux se règlent
depuis l'écran des règles fiscales, sans intervention technique.
---

## R-24 — Trois modules appliquent une TVA écrite en dur, contraire au barème · OUVERT

**Constat, vérifié le 26 août 2026.** Le moteur de conciliation ne porte aucun
taux : il les obtient tous par `snp_resoudre_regle_fiscale`. Trois autres
chemins ne consultent rien.

| Emplacement | Contenu |
|---|---|
| `VenteOrForm.tsx:89` | `TVA_TAUX = 18`, `TAXE_DEV_COMM_TAUX = 1` |
| `achatMineService.ts:72` | `TVA_TAUX_DEFAUT = 18`, `TAXE_DEV_COMM_TAUX_DEFAUT = 1` |
| `snp_repondre_demande` (SQL) | `v_tva := round(v_brut * 0.18, 2)` |

**Pourquoi cela compte maintenant.** Le barème approuvé le 26 août dit 1,5 %
pour un comptoir et 0 % pour une mine. Ces trois modules appliquent 18 % sans
consulter le référentiel : une même opération peut porter deux TVA différentes
selon l'écran qui la traite.

**Ce qui limite les dégâts.** `snp_achats_mines`, `snp_artisan_ventes_or` et
`snp_factures_achat` stockent le taux appliqué sur chaque ligne (`tva_taux`,
`taxe_dev_comm_taux`). Une facture passée reste donc explicable : elle porte le
taux qui l'a calculée. Ce qui manque, c'est que ce taux vienne du référentiel.

**Ce qui bloque la correction.** Deux choses, toutes deux du ressort du métier :
le référentiel ne connaît pas encore la taxe de développement communal, et
passer de 18 % à 1,5 % ou 0 % change les montants des opérations à venir. C'est
une décision fiscale, pas un correctif technique.

**Travail à prévoir.** Les colonnes existent déjà pour recevoir le taux résolu ;
il s'agit de remplacer la constante par un appel à
`snp_resoudre_regle_fiscale`, comme le fait la conciliation.
---

## R-25 — Constats de la reconnaissance traçabilité du 27 août · PARTIELLEMENT TRAITÉ

La cartographie parallèle de neuf sous-systèmes (dix agents, synthèse versée au
dossier de reconnaissance) a mis au jour les faits ci-dessous. Le lot correctif
du 27 août (migrations `20260827102555` → `20260827112903`) en a traité une
partie ; l'état de chaque constat est annoté.

**Fuites et privilèges.**
- CLOS — `sales.invoice_url` : le constat visait du code mort. La colonne
  n'existe pas en base, le bucket `sale-documents` non plus : la fuite était un
  chemin jamais exécutable, pas une exposition active. `uploadInvoicePDF` et
  `generateAndUploadSaleInvoice` (sans appelant) ont été retirés de
  `saleInvoiceService.ts` ; `paymentDocumentsService.ts` ne lit plus la colonne
  fantôme. Tout archivage futur passera par `sales_documents` + gateway
  sensible + `snp_storage_can_read_object`, jamais par une URL publique.
- CLOS — `snp_ventes_lots` : les trois politiques permissives `USING(true)`
  sont retirées ; la lecture suit le périmètre de la vente
  (`snp_peut_consulter_vente`) — migration `20260827102555`.
- PÉRIMÉ — `snp_achats_mines` en écriture `USING(true)` : constat inexact, les
  politiques vivantes sont déjà conditionnées par capabilities (vérifié en
  base le 27 août).
- OUVERT — l'historique des réquisitions reste lisible par la mine, motifs
  internes SONASP compris. Décision de cloisonnement à prendre.

**Ruptures de chaîne.**
- OUVERT — vente d'une mine sans lots : `snp_creer_vente_export_mine` n'écrit
  aucune ligne `snp_ventes_lots`.
- CLOS — lien achat → production : jonction `snp_achats_productions`,
  allocation FIFO serveur par date de production, somme des allocations d'une
  production bornée par sa quantité déclarée, validation refusée sans
  couverture complète, libération à l'annulation, backfill des 54 achats
  (7 découverts historiques consignés, rien d'inventé) — migration
  `20260827112903`, prouvée en transaction annulée (achat chevauchant refusé).
- CLOS — `snp_analyses_teneur.shipping_preparation_id` et
  `snp_analyses_resultats.assay_certificate_id` posés (le texte libre
  `certificat_reference` demeure en héritage) — migration `20260827103211`.
- PARTIEL — cessions comptoirs : le bilan matière SONASP les compte désormais
  (4e source de `stockSonaspService`, statuts `accepted`/`paid`). Leur
  rattachement lot à lot dans `snp_ventes_lots` reste OUVERT.
- OUVERT (différé) — les paiements 4H n'écrivent pas au grand livre
  commercial. Question préalable consignée : la contrainte de conversion du
  grand livre exige XOF ou (montant_xof + taux + horodatage), or le flux 4H
  est en devise de vente.
- OUVERT — `freight_shipments` et `freight_customs_operations` restent deux
  modules parallèles sans lien.

**Écrans et intégrité.**
- OUVERT — `freightCustomsService` interroge des colonnes inexistantes de
  `shipping_preparations` : le module /freight-customs est cassé.
- OUVERT — `freight_shipments.updateStatus` et `achatMineService.changerStatut`
  posent acteurs et horodatages depuis le navigateur. Atténuation partielle :
  l'allocation achat↔production est désormais rejouée par trigger serveur à
  chaque changement de statut, quel que soit le chemin d'écriture.
- CLOS — avances partielles : `snp_paiement_international_executer` accepte un
  versement partiel (engagement réduit du montant versé, refus du dépassement
  cumulatif, engagement soldé au dernier versement), le rejet restitue le
  montant à l'engagement, la vente passe `payment_received` quand le cumul
  approuvé couvre le produit net — migrations `20260827103734`,
  `20260827111822` (preuve bancaire PAR VERSEMENT : l'égalité mono-paiement
  `sales.payment_proof_url` est retirée de l'invariant d'approbation, le lien
  preuve↔paiement et la concordance Storage restent entiers). Prouvé de bout
  en bout en transaction annulée le 27 août. `sales_payment_schedules` et
  `customer_accounts_receivable` restent orphelines (OUVERT).
- OUVERT — la frise de production affiche neuf phases pour une énumération qui
  en a trois ; `certificate_approvals` n'est peuplée par rien.

**Causes racines découvertes en corrigeant** (le flux 4H n'avait jamais pu
s'exécuter en production) :
- CLOS — l'éligibilité du compte receveur exigeait `stakeholder_type='sonasp'`
  et `verification_status='verified'`, deux valeurs ininsérables au regard des
  contraintes CHECK de `stakeholder_bank_accounts` : aucun compte ne pouvait
  passer. Corrigé (`'mining_company'` + `'verifie'`) — migration
  `20260827105814` ; même correction côté écran (`getSellerBanks`).
- CLOS — la contrainte héritée `payments_status_check` (3 statuts) contredisait
  le jeu canonique 4H (6 statuts) : tout passage à `processing` était refusé.
  L'obsolète est retirée, la canonique validée — migration `20260827110036`.

Chaque point OUVERT est une décision ou un lot à part entière ; aucun n'est
traité en silence.
