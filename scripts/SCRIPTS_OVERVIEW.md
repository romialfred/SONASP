# Scripts Overview - FX Rates Import

## Scripts Principaux (À Conserver)

### Import de Données

#### 1. `fetch_historical_fx_rates_improved.mjs` ⭐ PRINCIPAL
Import complet des données historiques FX (2024-2025)
- Récupère EUR/USD depuis Frankfurter
- Calcule USD/XOF, USD/GNF, XOF/GNF
- Crée les agrégats mensuels automatiquement
- **Usage:** `node scripts/fetch_historical_fx_rates_improved.mjs`

#### 2. `fetch_lbma_historical_data.mjs`
Import des données historiques gold LBMA
- **Usage:** `node scripts/fetch_lbma_historical_data.mjs`

#### 3. `seed_lbma_gold_prices.mjs`
Seed des prix LBMA pour tests
- **Usage:** `node scripts/seed_lbma_gold_prices.mjs`

### Scripts de Test (Pour Développement)

#### 4. `test_one_date.mjs` ⭐ TEST RAPIDE
Test import d'une seule date (2025-12-05)
- Parfait pour vérifier que tout fonctionne
- **Usage:** `node scripts/test_one_date.mjs`

#### 5. `test_improved_fx.mjs`
Test import de 3 dates
- **Usage:** `node scripts/test_improved_fx.mjs`

#### 6. `test_import_with_aggregate.mjs`
Test import + création d'agrégat mensuel
- **Usage:** `node scripts/test_import_with_aggregate.mjs`

#### 7. `test_monthly_aggregate.mjs`
Test création d'un agrégat mensuel
- **Usage:** `node scripts/test_monthly_aggregate.mjs`

#### 8. `check_table_columns.mjs`
Diagnostic des colonnes de fx_rates_monthly_aggregated
- **Usage:** `node scripts/check_table_columns.mjs`

### Scripts de Diagnostic

#### 9. `analyze_gold_fx_tables.mjs`
Analyse complète des tables gold et FX
- **Usage:** `node scripts/analyze_gold_fx_tables.mjs`

#### 10. `check_table_structure.mjs`
Vérification de la structure d'une table
- **Usage:** Modifier le script pour la table voulue

#### 11. `describe_table.mjs`
Description détaillée d'une table
- **Usage:** Modifier le script pour la table voulue

### Scripts Obsolètes (Peuvent être Supprimés)

#### 12. `fetch_historical_fx_rates.mjs`
Ancienne version du script d'import
- ⚠️ Remplacé par `fetch_historical_fx_rates_improved.mjs`
- **Status:** OBSOLÈTE

#### 13. `test_fx_import.mjs`
Ancien script de test
- **Status:** OBSOLÈTE si existe

## Workflow Recommandé

### Pour l'Import Initial

```bash
# 1. Test rapide pour vérifier que tout fonctionne
node scripts/test_one_date.mjs

# 2. Si succès, lancer l'import complet
node scripts/fetch_historical_fx_rates_improved.mjs
```

### Pour le Développement

```bash
# Diagnostic de la base de données
node scripts/analyze_gold_fx_tables.mjs

# Test des colonnes d'une table
node scripts/check_table_columns.mjs

# Test import avec agrégats
node scripts/test_import_with_aggregate.mjs
```

## Scripts à Garder pour Production

Scripts essentiels qui doivent rester:

1. `fetch_historical_fx_rates_improved.mjs` - Import principal
2. `test_one_date.mjs` - Test rapide
3. `analyze_gold_fx_tables.mjs` - Diagnostic

## Scripts Pouvant être Supprimés

Scripts créés pour le développement/débogage:

- `fetch_historical_fx_rates.mjs` (remplacé)
- `test_fx_import.mjs` (si existe)
- `check_table_columns.mjs` (après vérification)
- `test_monthly_aggregate.mjs` (après vérification)
- `test_import_with_aggregate.mjs` (après vérification)

## Structure Recommandée

```
scripts/
├── README_FX_IMPORT.md           # Documentation principale
├── SCRIPTS_OVERVIEW.md            # Ce fichier
│
├── Production/
│   ├── fetch_historical_fx_rates_improved.mjs
│   ├── fetch_lbma_historical_data.mjs
│   └── seed_lbma_gold_prices.mjs
│
├── Testing/
│   ├── test_one_date.mjs
│   ├── test_improved_fx.mjs
│   └── analyze_gold_fx_tables.mjs
│
└── Development/ (optionnel)
    ├── check_table_columns.mjs
    ├── test_monthly_aggregate.mjs
    └── test_import_with_aggregate.mjs
```

## Commandes Utiles

### Nettoyer les scripts de test après validation

```bash
# Supprimer les scripts temporaires (après l'import réussi)
rm scripts/check_table_columns.mjs
rm scripts/test_monthly_aggregate.mjs
rm scripts/test_import_with_aggregate.mjs
rm scripts/fetch_historical_fx_rates.mjs  # ancienne version
```

### Lister tous les scripts

```bash
ls -lh scripts/*.mjs
```

### Rechercher une fonction dans tous les scripts

```bash
grep -n "function_name" scripts/*.mjs
```

## Notes

- Tous les scripts utilisent maintenant le chemin correct vers `.env`
- Tous les scripts utilisent les bons noms de colonnes
- Les scripts peuvent être exécutés depuis n'importe quel dossier

## Dernière Mise à Jour

2025-12-11 - Après correction des problèmes de colonnes et .env
