# Nettoyage R02 : historique et clôture vérifiée

**Résultat final à 16:01 UTC :** après nouvelle revue et autorisation distincte, la V2 a été exécutée une seule fois (code 0), puis son postflight READ ONLY a réussi. Exactement un site et deux responsables supprimés ; trois UUID absents, données hors manifeste des quatorze tables, schéma et métadonnées Storage inchangés. Les trois changements tiers sont préservés. Preuve : `cleanup-verification-v2.json`. Aucun autre nettoyage ni migration. Les paragraphes suivants conservent la préparation et l’échec V1 pour traçabilité.

**Mise à jour 15:51 UTC :** le principal a autorisé la candidate ci-dessous. Son exécution unique a échoué avant les DELETE (`42703 column t.id does not exist`) dans l’expression de préservation de `snp_artisan_vente_site_origins`, dont la clé est `vente_id`. La relecture distincte confirme le site et ses deux responsables toujours présents et inchangés ; données hors manifeste, schéma et métadonnées Storage inchangés. Preuve : `cleanup-echec-verification.json`. Aucun retry. La suite de ce document conserve le plan initial, qui ne doit pas être exécuté une nouvelle fois sans correction, revue et autorisation séparée.

**V2 préparée et contrôlée en lecture seule à 15:58 UTC :** SHA candidat `7420606a3828626d652dfd79887f89da1cfc90b3865478e1af520901743a5a73`. Seul remplacement : `ORDER BY t.id` par `ORDER BY to_jsonb(t)::text COLLATE "C"` dans les agrégats hors manifeste. Les deux expressions intégrales et le postflight entier ont été évalués en `READ ONLY`, avec toutes les gardes intactes : code 0, trois lignes présentes, baseline/schéma/Storage inchangés. Preuve `cleanup-validation-v2.evidence.json`. Nouvelle revue et instruction d’écriture attendues ; aucune suppression V2 à ce stade.

La lecture réelle `cleanup-preflight.json`, réalisée le 7 septembre 2026 à 14:08:59 UTC dans une transaction `READ ONLY`, confirme le site `d9f7160a-aadd-41d9-ad4d-c9f886d41e0c` et les deux responsables du manifeste. Leurs valeurs sont strictement égales à la relecture de création, et leurs empreintes de lignes sont égales à celles du relevé de 13:09 UTC. Le nom est exactement `QA20260907-R02-SITE`. Aucune photo, référence AEA ni dépendance métier externe n’est présente.

`cleanup-plan.json` donne les UUID, empreintes, tables protégées et SHA256 de `cleanup-candidate.sql` et `cleanup-postflight.sql`. Le générateur `prepare-cleanup.mjs` refuse les divergences et ne contacte jamais le serveur. Le SQL de suppression ne sera exécuté qu’après revue et instruction séparée du principal.

## Contraintes et effets relus

- La FK des responsables utilise `ON DELETE CASCADE`. Le candidat supprime explicitement les **deux UUID connus**, puis le parent ; il ne s’appuie pas sur une cascade pour découvrir les enfants.
- La FK des artisans utilise `ON DELETE SET NULL` : une garde refuse tout artisan rattaché à ce site, afin qu’aucun artisan ne soit modifié.
- Productions et origines des ventes utilisent `RESTRICT`, ventes et rattachements des collecteurs utilisent `NO ACTION` : chaque dépendance doit être absente avant suppression.
- Aucune FK entrante vers les responsables, aucune règle de réécriture, aucun trigger métier `DELETE`. Les triggers métier existants concernent uniquement les insertions/modifications : date de mise à jour et contrôle AEA. Les FK, définitions de triggers et empreintes des fonctions sont comparées de nouveau dans la transaction.
- Les trois changements tiers observés auparavant restent hors manifeste. Leur version relue à 14:08 est incluse dans les empreintes de préservation ; aucune tentative d’annuler leurs changements antérieurs.

## Transaction candidate

Le candidat ouvre une transaction `REPEATABLE READ`, borne l’attente de verrou à **5 secondes** et chaque instruction à **30 secondes**, puis verrouille les sept tables impliquées par les FK en `SHARE ROW EXCLUSIVE` avant les lectures du snapshot. Les consultations restent possibles ; les écritures sur ces tables sont brièvement mises en attente. Cette borne évite qu’un nouveau rattachement ou une évolution de schéma se glisse entre la vérification et la suppression. Le détail des modes figure dans la [documentation PostgreSQL sur les verrous](https://www.postgresql.org/docs/current/explicit-locking.html).

Le bloc garde le schéma, le nom exact, les UUID, l’ensemble des responsables, leurs hashes, l’absence de pièces et de références externes. Il supprime deux responsables et un site, vérifie les nombres exacts de lignes affectées puis leur absence. Il compare les empreintes des autres données de quatorze tables et des métadonnées des trois buckets dans la même transaction. Toute divergence lève une exception et annule l’ensemble. Aucune table temporaire, DDL, migration, changement de rôle, désactivation de règle, opération Auth ou mutation Storage.

Le reçu avant `COMMIT` ne suffit pas seul à conclure : le code de sortie CLI et un postflight séparé sont requis. Les comptages des [lignes supprimées](https://www.postgresql.org/docs/current/sql-delete.html) sont contrôlés dans le bloc SQL ; un trigger ignorant une suppression provoque donc un refus.

## Contrôle après, à exécuter uniquement après le Go séparé

`cleanup-postflight.sql` est une transaction `READ ONLY` qui retourne l’absence des trois UUID, le schéma, une nouvelle baseline et les empreintes hors manifeste. Puis :

```powershell
node docs/amelioration/environnement/reprise-r02/run-readonly.mjs cleanup-postflight.sql cleanup-postflight
node docs/amelioration/environnement/reprise-r02/verify-cleanup.mjs docs/amelioration/environnement/reprise-r02/cleanup-postflight.json docs/amelioration/environnement/reprise-r02/cleanup-verification.json
```

Le comparateur exige la disparition exacte de ces trois lignes, toutes les autres lignes de la baseline inchangées et le schéma/les métadonnées Storage identiques. Si un tiers écrit entre le préflight et le postflight, le comparateur le signale sans attribuer automatiquement ce changement au nettoyage. Les empreintes Storage portent sur les métadonnées, pas les octets des documents.

Le plan initial est conservé comme preuve. La tentative échouée est décrite en tête de document ; **aucun DELETE n’a été atteint**, aucune réussite de nettoyage déclarée.
