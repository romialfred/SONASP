# Revue indépendante du RPC Clients

Date : 7 septembre 2026. Auditeur : `audit_independant`. Baseline Git : `83f8c74ea83c81a2734ef9e086c2edd211573ebe` ; migration nouvelle non encore intégrée dans un commit de livraison au moment de cette revue.

**Conclusion bornée : aucun défaut transactionnel ni contournement RLS confirmé dans les cas SQL exécutés.** La fonction et ses tests peuvent poursuivre l’intégration. Cette conclusion ne valide ni le formulaire, ni Auth/MFA, ni PostgREST, ni le déploiement. La décision de recette globale reste non prononcée.

## Périmètre et preuves

- Migration : `supabase/migrations/20260907044811_enregistrer_dossier_client_atomique.sql`.
- Contrats réutilisés : helper SONASP de `20260823180000_capacites_et_separation_fonctions.sql`, RLS de `20260905000000_durcir_rls_clients.sql`.
- Tests de l’implémenteur relancés indépendamment : `tests/clients/customer-dossier.node.mjs`.
- Cas complémentaires de l’auditeur : [customer-dossier-independent.node.mjs](customer-dossier-independent.node.mjs).
- Exécution conjointe : [rapport brut](backend-independent.tap.txt), [preuve horodatée et empreintes SHA-256](backend-independent.evidence.json).

Commande reproductible :

```sh
node docs/amelioration/audit/run-backend-audit.mjs
```

Résultat de la dernière exécution enregistrée : **32 tests Node réussis, 0 échec**, soit 22 scénarios du backend + 8 scénarios complémentaires + 2 tests parents comptés par Node. Cette exécution remplace la première preuve à 29 tests après ajustement de la compatibilité des valeurs NULL historiques. L’empreinte SHA-256 de la migration est `0b87f4df5de4e59c7c7252550018c92d923d978f356289109c142b417c31cb0f`. Les empreintes des six entrées contrôlées sont restées identiques entre le début et la fin de l’exécution. L’environnement est un PostgreSQL embarqué PGlite jetable en mémoire. Aucun réseau, compte réel ou donnée réelle n’est utilisé ; les helpers Auth/capabilities/session sont simulés.

## Contrôles effectués

| Contrôle | Observation statique | Preuve exécutée / limite |
|---|---|---|
| Identité et habilitation | Appel exige `auth.uid`, agent SONASP et session active ; acteur non fourni dans le payload | Refus sans identité, AAL1, mauvaise capacité, session expirée et rôle anon dans fixture |
| Privilèges | `SECURITY INVOKER`, révocation PUBLIC/anon, EXECUTE authenticated | Introspection `pg_proc` et `has_function_privilege` dans PGlite |
| RLS | Aucune nouvelle policy ni BYPASS ; UPDATE/INSERT sous le rôle appelant | Policies restrictives supplémentaires parent/enfant opposables et rollback vérifié |
| Résolution SQL | Tables qualifiées ; `search_path=pg_catalog,public,pg_temp` ; préflight interdit CREATE public aux rôles API | Table temporaire homonyme ne détourne pas le trigger historique dans le cas testé |
| Atomicité | Écriture parent et fusion des enfants dans le même appel SQL ; exceptions propagées | Échec SQL du second enfant : aucun parent créé ; erreur en édition : parent et banques restaurés |
| Réponses trompeuses | `FOUND` / nombre de lignes contrôlé après mutations | Triggers annulant UPDATE parent, INSERT enfant ou UPDATE enfant conduisent à un refus sans succès partiel |
| Relations | Vérification du couple banque/client avant UPDATE ; champs inconnus interdits | Banque étrangère, UUID inconnu, UUID dupliqué et injection `customer_id` rejetés |
| Identifiants | Banque existante mise à jour par son ID ; aucun DELETE | ID, date de création et FK vers paiements/préventes conservés |
| Retrait bancaire | Banques omises désactivées et déclassées de principal | Références historiques conservées, banque déjà inactive laissée inchangée, réactivation explicite sur le même ID |
| Principal | Au plus un principal dans le payload, trigger existant conservé | Passage A → B vérifié avec A puis B et B puis A dans le payload |
| Types et requis | Objets JSON et clés autorisés ; requis texte ; crédit numérique positif ou zéro ; domaine des statuts | Valeurs absentes, scalaires, tableaux, mauvais booléens, sentinelle Autre et email invalide refusés |
| Valeur zéro | Crédit zéro non remplacé par défaut | Création et édition conservent 0 dans la base embarquée |
| Compatibilité | Champs hors formulaire et dates de création non écrasés | `company`, `is_active` et `created_at` préservés dans les cas d’édition |
| NULL et textes historiques | `status` et `payment_terms` doivent être fournis, mais acceptent NULL conformément au schéma ; pas de fermeture arbitraire des domaines texte | Création/édition NULL, refus des clés omises sans effacement et valeurs hors catalogues UI couverts par les trois scénarios ajoutés |
| Rejeu migration | CREATE OR REPLACE et privilèges explicites ; aucun changement de table métier | Rejeu sans modification des données ni nombre de policies dans la fixture |

## Hypothèses et points à conserver dans la recette

1. **Auth réelle non testée.** La définition SQL de `snp_est_agent_sonasp` est chargée depuis la migration existante, mais `snp_actor_has_capability`, `auth.uid` et la session sont des doublures. Les refus SQL démontrent la réaction du RPC à ces valeurs ; ils ne prouvent pas un login, un MFA ou une révocation réellement exécutés.
2. **Droits plus larges que la route frontend.** Le helper serveur existant reconnaît `sonasp.prepare`, `sonasp.approve`, `sonasp.finance.execute` et `sonasp.finance.reconcile`. Le nouveau RPC conserve donc la largeur des policies d’écriture existantes ; il ne la crée pas. Le frontend de création/édition utilise SONASP_PREPARE. Les quatre acceptations et le refus lecture seule ont été testés. Cette distinction doit figurer dans la matrice d’accès ; aucun resserrement arbitraire n’a été demandé par l’auditeur.
3. **Schéma et trigger reconstruits.** Le runner utilise une fixture de tables et de trigger `ensure_single_primary_bank`. Les types TypeScript ne prouvent pas toutes les contraintes live. Une comparaison en lecture seule du schéma, des defaults, FK, indexes, triggers et policies de l’environnement de recette est encore requise avant la recette intégrée.
4. **Concurrence multi-session non exécutée.** Le verrou parent sérialise les appels de modification du même dossier et les enfants sont verrouillés. Cette propriété ne prouve pas l’absence de perte d’une modification concurrente à partir de deux copies anciennes du formulaire. Une règle de gestion d’un conflit et un scénario multi-session restent à documenter selon l’existant.
5. **Réponse réseau perdue non exécutée.** La fonction ne prend pas de clé d’idempotence ; la contrainte email de la fixture rejette une recréation identique. Cela ne constitue pas une preuve de reprise utilisateur après écriture confirmée en base mais réponse HTTP perdue. La double soumission et la reprise doivent être contrôlées dans le formulaire intégré, sans affirmer que ce RPC est idempotent.
6. **Domaines texte à justifier.** `payment_terms` et la devise bancaire restent des chaînes, alors que les contrôles UI proposent des options. Le RPC conserve ici la souplesse du stockage antérieur. Les valeurs historiques et la règle métier doivent décider si ces listes sont fermées ; l’audit n’invente pas une restriction supplémentaire. Cette question a été transmise au responsable backend.
7. **Retrait et paiements existants.** La conservation de la FK est prouvée. La lecture statique confirme que `paymentService.getCustomerBanks` filtre `is_active=true` pour la création, tandis que `internationalPaymentDetailService` relit la banque historique par son ID et son `customer_id` sans exclure les banques inactives. Le workflow aval doit encore démontrer ce comportement dans l’interface avec les données persistées ; cette lecture ne ferme pas le scénario réel.
8. **Preuves de travail.** Les empreintes identifient les fichiers audités, pas un commit de livraison. Toute évolution de la fonction, des helpers, de la RLS, du trigger ou de leur intégration invalide les assertions concernées et impose leur retest. Catalogue de migrations, pipeline CI et postflight sur la candidate doivent être vérifiés avant promotion.

Ces limites ne sont pas classées NON APPLICABLE et ne ferment aucun critère éliminatoire de la recette intégrale. Elles ne doivent pas être reclassées comme futur audit de sécurité pour obtenir une note.

## Références techniques consultées

La revue a consulté le [changelog Supabase](https://supabase.com/changelog), la documentation [Database Functions](https://supabase.com/docs/guides/database/functions) et [CREATE FUNCTION PostgreSQL](https://www.postgresql.org/docs/current/sql-createfunction.html) pour la séparation invoker/definer et la résolution par `search_path`. Les résultats de recette ci-dessus reposent sur les fichiers et les tests nommés, pas sur ces documents seuls.
