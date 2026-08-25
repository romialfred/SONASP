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
| R-06 | Cloisonnement multi-tenant incomplet | élevé | avérée | **élevé** | ouvert |
| R-07 | Interfaces locales divergeant des types générés | moyen | avérée | moyen | ouvert |
| R-08 | Dérive entre migrations du dépôt et production | moyen | avérée | moyen | ouvert |
| R-09 | Barème fiscal sans validation juridique | élevé | avérée | **élevé** | ouvert |
| R-10 | Montants financiers non arrondis en XOF | moyen | avérée | moyen | ouvert |
| R-11 | Fonctions Edge non déployées | moyen | avérée | moyen | ouvert |
| R-12 | Objets appelés par le code et absents du schéma | moyen | avérée | moyen | ouvert |
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

## R-06 — Cloisonnement multi-tenant incomplet · OUVERT

**Description.** Le cloisonnement par périmètre minier n'est pas posé. La migration
prévue est inapplicable en l'état : elle repose sur `snp_est_agent_sonasp()`, dont la
définition a changé et ne reconnaît plus que le rôle `management`, avec MFA.

**Conséquence si appliquée telle quelle.** Les rôles `admin`, `manager`, `factory`,
`airport` et `refinery` perdraient tout accès aux tables à `mining_company_id`.

**Mitigation à construire.** Poser le cloisonnement avec un prédicat aligné sur
l'état actuel des capabilities. Voir D-005.

---

## R-07 — Interfaces divergeant des types générés · OUVERT

**Description.** Des interfaces écrites à la main contredisent le schéma réel. Cas
avéré : `DailyProduction` déclarait deux colonnes nullables comme non nullables,
rendant le compilateur aveugle à treize accès fautifs et faisant tomber un écran en
présentation.

**Mitigation partielle.** Interface corrigée, treize accès protégés, trois tests de
non-régression.

**Résiduel.** Le motif subsiste ailleurs : quatre incompatibilités d'affectation dans
`ShippingPreparationNew`, et `typecheck:database` échoue sur 20 relations absentes de
`src/types/database.ts`.

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

## R-12 — Objets appelés par le code et absents du schéma · OUVERT

**Description.** La vitrine publique interroge la table `publications`, qui n'existe
pas en base : l'endpoint répond 404. Même famille que les RPC absentes traitées en
R-04.

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

