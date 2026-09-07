# Clients — transaction du dossier et conservation des banques

État backend : **TESTÉ en PostgreSQL embarqué PGlite, À AUDITER**. Recette UI authentifiée : **BLOQUÉE** par l'environnement décrit dans `README.md`. Aucune application à une base distante ni publication.

Version de départ : `83f8c74ea83c81a2734ef9e086c2edd211573ebe`. Migration créée par Supabase CLI 2.115.0 : `20260907044811_enregistrer_dossier_client_atomique.sql`. Les preuves doivent être reliées au commit d'intégration lorsqu'il sera fixé.

## Cause et exigences

`CustomerForm.tsx` écrivait le parent, supprimait toutes ses banques puis réinsérait la liste. Un échec enfant conservait un parent partiellement modifié ; les banques changeaient d'identifiant ou ne pouvaient être supprimées à cause des références de paiement/prévente. Le commit `d1efaa3b` documentait déjà cette dette de fusion. Le crédit 0 doit rester 0. Ces défauts relèvent des sections 7, 8 et 15 du prompt maître : atomicité, correspondance de chaque champ et cohérence dans les écrans aval.

## Contrat frontend final

```text
public.save_customer_dossier(
  p_customer_id uuid,  -- null pour création ; identifiant existant pour édition
  p_customer jsonb,   -- dossier complet, pas un PATCH partiel
  p_banks jsonb       -- liste complète des banques conservées/ajoutées
) returns uuid
```

| Objet | Champs admis | Traitement |
|---|---|---|
| Client | `name`, `email`, `phone`, `country`, `address`, `contact_person`, `tax_id`, `payment_terms`, `credit_limit`, `status` | Champs métier du formulaire existant. Nom/contact/adresse/téléphone/pays/email requis ; email normalisé en minuscules ; crédit numérique ≥0 ; statut `pending`, `active`, `inactive` ou explicitement `null`, conformément à la colonne nullable. Les clés `status` et `payment_terms` sont requises dans le dossier complet ; leurs valeurs `null` sont conservées sans valeur par défaut inventée. Aucun champ système, rôle, tenant ou auteur accepté. |
| Banque | `id` optionnel, `bank_name`, `country`, `city`, `currency`, `account_number`, `iban`, `swift_code`, `is_primary`, `is_active` | Les champs requis restent ceux du formulaire existant. Pas de nouvelle règle de numéro de compte/IBAN/devise inventée. Chaînes bancaires facultatives vides → null. Booléens optionnels : principal false, actif true. |
| Banque existante | `id` du dossier courant | Mise à jour en place, création initiale et références aval conservées. ID inconnu, étranger, répété ou fourni à la création refusé. |
| Banque ajoutée | Pas d'`id` | ID généré par la base, parent dérivé de l'identifiant enregistré. |
| Banque retirée | Absente de `p_banks` | `is_active=false`, `is_primary=false`, conservation de la ligne et de ses FK. Le formulaire existant recharge seulement les banques actives ; les paiements existants exigent une banque active avant nouvel usage. |

`p_banks=[]` est autorisé ; `null`, objet ou chaîne sont refusés. Le champ `is_primary` reste exclusif conformément au composant et au trigger existants. Aucun lien de paiement n'est déplacé. `company`, `is_active` du client, dates de création et autres champs hors formulaire ne sont pas réécrits.

`payment_terms` accepte du texte ou `null`, et les pays/devises bancaires restent des chaînes non vides. Ces colonnes texte ne possèdent pas de contrainte de catalogue dans le schéma observé. Les listes du formulaire ne constituent pas une nouvelle règle de validité des données historiques ; les valeurs hors liste sont donc conservées et testées en création puis édition. Une clé `payment_terms` ou `status` absente est refusée avant toute écriture, au lieu d'être transformée en effacement implicite. La limite de crédit conserve la validation numérique existante, y compris zéro.

## Autorisations, compatibilité et concurrence

Le RPC est `SECURITY INVOKER`. Il exige `auth.uid()`, le helper existant `snp_est_agent_sonasp()` et une session active. Le helper existant dérive les capacités SONASP et l'AAL requis ; aucun rôle supplémentaire n'est admis. Les RLS et grants de tables restent opposables et **inchangés**. L'exécution RPC est retirée à PUBLIC/anon puis accordée à authenticated.

Le helper RLS historique reconnaît `sonasp.prepare`, `sonasp.approve`, `finance.execute` et `finance.reconcile`. Ce périmètre est plus large que la route de création/édition frontend (`sonasp.prepare`) et reste inchangé ; le RPC ne redéfinit pas arbitrairement les permissions de tables.

Le parent est verrouillé avant ses banques pour sérialiser deux appels du même dossier. Toutes les écritures sont dans une seule transaction : exception SQL, violation RLS, enfant étranger et UPDATE sans ligne annulent l'ensemble. Les comptes omis sont désactivés avec vérification du nombre de lignes attendu. Le test PGlite ne prouve pas une course réseau multiconnexion ; celle-ci reste à exécuter en préproduction.

Compatibilité spécifique : le trigger historique `ensure_single_primary_bank()` référence `customer_banks` sans schéma. Un `search_path` vide casserait une banque principale. Le nouveau RPC utilise donc `pg_catalog, public, pg_temp`, et ses propres relations sont toutes qualifiées. Son préflight refuse que `anon` ou `authenticated` puissent créer des objets dans public. Le trigger historique n'est pas modifié.

Le préflight contrôle fonctions d'accès, colonnes, activation RLS et CREATE du schéma ; le postflight vérifie invoker et privilèges RPC. Le catalogue ajoute uniquement cette migration, sans modifier aucun checksum historique.

## Exécution des preuves SQL

```powershell
node --test tests/clients/customer-dossier.node.mjs
node scripts/check-migration-integrity.mjs verify
node --test tests/migrations/migration-integrity.node.mjs
```

Le 7 septembre 2026, le runner Clients a réussi **22 scénarios et leur suite englobante, soit 23 tests Node**. PGlite exécute la nouvelle fonction PL/pgSQL, le vrai helper SONASP extrait de la migration canonique et la vraie migration RLS du 5 septembre. Les tables proviennent d'une fixture minimale du schéma observé et du contrat TypeScript ; les identités, capacités, AAL et sessions sont **simulés**, pas issus d'une connexion Supabase. Aucun accès réseau, compte réel ni donnée personnelle utilisé. La base jetable est fermée après les assertions.

Rapport brut conservé : [clients-tests.tap](clients-tests.tap). Empreintes de la migration, de la fixture et du runner : [clients-tests-version.json](clients-tests-version.json). Les requêtes [clients-verification.sql](clients-verification.sql) préparent la lecture de contrôle dans la future base isolée ; elles n'y ont pas été exécutées.

| Scénarios | Preuve persistée contrôlée |
|---|---|
| Création tous champs, zéro crédit, banque principale | Valeurs SQL relues, normalisation et rattachement exact |
| Édition, compte conservé | ID et created_at identiques, nouvelle ville, champs historiques préservés |
| Statut/conditions de paiement explicitement null | NULL relu en création puis conservé en édition, sans statut ou conditions par défaut |
| Clés statut/conditions absentes | Rejet avant écriture ; parent, banque et dates strictement identiques |
| Conditions, pays et devise hors listes UI | Valeurs texte historiques conservées après modification du dossier |
| Compte retiré référencé | Ligne inactive, FK payments et pre_sales inchangées |
| Dossier sans compte, retrait de tous les comptes | Liste vide acceptée, aucune suppression historique |
| Erreur SQL sur deuxième enfant, création puis édition | Zéro nouveau parent, rollback du nom/banques/flags en édition |
| ID bancaire étranger, inconnu, répété, création avec ID | Rejet explicite, aucune réaffectation |
| Parent inexistant, UPDATE ignoré par trigger | Pas de faux succès avec zéro ligne |
| Valeurs requises et types invalides, statut inconnu, email dupliqué | Rejets serveur, contraintes persistées |
| Aucune capacité, AAL1, session expirée, identité absente, anon | Refus sous contextes de test simulés |
| RLS restrictive additionnelle parent et enfant | Refus et rollback complet malgré l'accès au RPC |
| Rejeu de la migration | Données et nombre de policies inchangés |

Une première exécution a signalé un défaut du **runner** : une chaîne JSON était transmise brute à PostgreSQL au lieu d'être sérialisée ; le runner a été corrigé puis tous les scénarios ont été rejoués. Aucun échec n'a été supprimé ou converti en succès supposé.

## Restant obligatoire avant VALIDÉ

Préflight sur schéma réel isolé ; saisie UI complète avec véritable login/MFA ; contrôle DB de CET enregistrement ; liste, détail, rechargement et modification ; refus des profils non autorisés ; course concurrente ; audit indépendant intégré ; vérification des usages aval des banques inactives. Le correctif source n'est pas une attestation de recette des formulaires.

Sources : `CustomerForm.tsx`, `BankAccountForm.tsx`, types `customers/customer_banks`, migration `20260905000000_durcir_rls_clients.sql`, commit `d1efaa3b`, contrôle bancaire des RPC de paiement `20260827103734_avances_partielles_paiement_international.sql`. [Fonctions PostgreSQL et SECURITY INVOKER — Supabase](https://supabase.com/docs/guides/database/functions), [verrouillage explicite — PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).
