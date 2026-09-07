# Affiliations : écriture et relecture du dossier

7 septembre 2026. Correctif applicatif local `8016b698` sur la branche
`codex/amelioration-integrale`. Aucune migration ni publication distante.

## Comportement corrigé

Une actualisation ne confirme son succès qu'après la relecture des cartes et de
leurs droits. Si une écriture est confirmée mais que sa relecture échoue, le
dossier explique que l'opération est enregistrée et demande une actualisation,
sans inviter à répéter le paiement. Les actions financières restent indisponibles
tant que leur état n'est pas vérifié. La relation de droits de la nouvelle émission
est utilisée après actualisation ; un changement de titulaire, émission ou
contexte utilisateur démonte les lectures de l'ancien dossier.

Les erreurs initiales et celles de l'historique ne sont plus présentées comme une
absence de dossier ou un historique vide vérifié.

## Preuves techniques

- `tests-avant.txt` : reproduction des défauts de relecture, avant correction.
- `tests-apres.txt` et `tests-consolides.txt` : vérifications de l'implémenteur.
- `../../audit/affiliation-local-20260907.evidence.json` : rejeu indépendant final,
  33 tests réussis dans trois fichiers, avec empreintes stables avant/après.
- `../../audit/REVUE_AFFILIATION_REPRISE_LOCALE.md` : avis indépendant et limites.

Ces tests remplacent Auth et le transport. Ils ne prouvent aucun paiement, dépôt
de pièce, activation, contrôle RLS ou transaction Supabase réelle.

## Banc navigateur local : preuves à reprendre

Le banc `docs/affiliation-qa/workflow-*` utilise PGlite en mémoire, des identités
simulées et les composants applicatifs. Les options de panne ajoutées ne sont
disponibles que sur ce banc. Il ne faut pas les confondre avec la session réelle
sur le serveur 5192.

Les captures `01-periode-relecture-echouee.png`,
`02-droits-lecture-echouee.png`, `03-droits-erreur-confirmee.png` et
`04-erreur-cartes-verifiee.png` ne sont **pas recevables comme preuves de panne** :
l'armement et la persistance de l'erreur au moment exact de la capture n'ont pas
été établis. Les fichiers sont conservés pour traçabilité, sans résultat validé
déduit de leur nom. Un paiement apparu dans ce banc n'a pas été saisi de bout en
bout par le coordinateur ; il ne compte pas comme scénario de paiement exécuté.

La recette réelle avec saisie observée, relecture de la base, contrôle de la pièce
et nettoyage ciblé reste à exécuter avant validation métier.
