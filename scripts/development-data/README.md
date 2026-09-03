# Peuplement historique de développement — HIST-2024-2026

## Périmètre et sécurité

Ce lot est réservé au projet Supabase SONASP de développement
`yyverzuhkdonjjuficor`. Il couvre janvier 2024 à décembre 2026 ; septembre à
décembre 2026 restent des prévisions afin de ne pas antidater des réalisations.
Les dates métier sont historiques, tandis que les journaux techniques conservent
la date réelle d'exécution.

- Aucun utilisateur existant, rôle ou droit n'est modifié.
- Les sept acteurs techniques ont des adresses `example.invalid`, aucun mot de
  passe, aucune invitation et restent bannis puis désactivés.
- Aucun courriel, SMS, paiement bancaire, certification DGI ou document officiel
  externe n'est envoyé ou fabriqué.
- Les références visibles suivent les nomenclatures métier (`SL-YYYY-…`,
  `RN-YYYY-…`, `OP-YYYYMM-…`, `PA-YYYY-MM-…`) et ne contiennent ni « test » ni
  « demo ».
- Le rejeu est idempotent : les UUID déterministes `d8302026-*` empêchent les
  doublons.

## Données et scénarios couverts

- 96 productions mensuelles réalisées (trois flux), 108 prévisions, 9 budgets
  annuels, 108 ventilations mensuelles et 108 trimestrielles.
- 96 plans, demandes, achats et factures d'achat reliés à leurs productions.
- 96 chaînes physiques complètes : préparation, douane/fret, raffinerie et stock.
- 32 ventes internationales, 64 analyses/certificats, 32 conciliations dont 10
  validées et 26 paiements internationaux répartis entre les statuts non
  irréversibles disponibles.
- 32 affectations à la Réserve nationale couvrant les 14 statuts du workflow,
  dont 19 actives.
- 24 artisans sur trois sites, 192 ventes d'or locales, 160 factures non certifiées,
  11 réquisitions et 9 contrats brouillon.
- Cours de l'or et changes ajoutés uniquement aux dates absentes.

Les brouillons, demandes en attente, contrats, réquisitions, conciliations et
affectations intermédiaires constituent les cas modifiables destinés aux essais de
formulaires. Les statuts finaux restent volontairement immuables conformément aux
règles métier.

## Réparation de cohérence incluse

La base de développement contient 12 ventes historiques `SL-2026-001` à
`SL-2026-012` sans chaîne physique. Elles bloquent le contrôle global de la Réserve.
Le lot ne désactive pas ce contrôle : il construit pour chacune une production, un
achat, une expédition, un raffinage et un stock traçables, puis rattache la vente à
ce stock. L'instantané pré-commit conserve leur statut initial pour une reprise.

## Contrôles exécutés par `postflight.sql`

Le peuplement est annulé au moindre écart de volume, de période, de conservation
des poids, de provenance d'une vente, de séparation des acteurs, de couverture des
statuts, de notification externe ou de préservation des profils existants. La
répétition liée du 3 septembre 2026 a franchi tous ces contrôles puis exécuté
`ROLLBACK`.

Le manifeste de 96 pièces (64 analyses et 32 décisions) est exporté dans
`output/development-data/documents.json`. Il décrit les pièces attendues sans les
présenter comme des documents officiels ni déclencher de stockage externe.

## Commandes

Répétition distante, toujours annulée :

```powershell
node scripts/development-data/run.mjs --linked
```

Insertion transactionnelle contrôlée :

```powershell
node scripts/development-data/run.mjs --linked --commit `
  --development-confirmed --dry-run-reviewed --rollback-snapshot
```

Avant le `COMMIT`, le programme exécute `snapshot-before.sql` et conserve le reçu
dans `output/development-data/pre-commit-snapshot.json`. Le reçu de transaction est
écrit dans `linked-commit.json`. Le mode commit est refusé sans projet lié et sans
les trois confirmations explicites.

Les scripts `schema-audit.sql`, `coverage-audit.sql` et les audits spécialisés sont
des diagnostics en lecture seule. `prepare-local.mjs` reste destiné au miroir local
isolé et ne doit jamais écraser une base existante.
