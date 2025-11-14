# 🗃️ Best Practices - Gestion des Migrations en Équipe

## 📋 Principe Fondamental

**TOUJOURS LISTER LES MIGRATIONS À EXÉCUTER AVANT DE DÉPLOYER OU TESTER**

Travailler en équipe signifie que plusieurs développeurs peuvent créer des migrations. Il est crucial de maintenir une liste claire et à jour des migrations à exécuter.

## ✅ Checklist Avant Chaque Session de Travail

### 1. Vérifier les Nouvelles Migrations
```bash
# Lister toutes les migrations non exécutées
ls -la supabase/migrations/ | tail -20

# Identifier les migrations créées depuis votre dernier pull
git diff main..HEAD --name-only supabase/migrations/
```

### 2. Lire la Documentation de Chaque Migration
Chaque fichier de migration DOIT commencer par un bloc de commentaires expliquant:
- **Ce qu'elle fait** (description claire)
- **Les tables créées/modifiées**
- **Les impacts sur les données existantes**
- **Les dépendances** (autres migrations requises)

### 3. Exécuter les Migrations dans l'Ordre Chronologique
```bash
# Les migrations DOIVENT être exécutées dans l'ordre du timestamp
# Format: YYYYMMDD_NNN_description.sql
# Exemple: 20251114_006_add_shipping_status_history.sql
```

## 🚨 Règles Strictes

### ❌ NE JAMAIS
1. **Modifier une migration déjà exécutée en production**
2. **Supprimer une migration déjà exécutée**
3. **Changer le nom/numéro d'une migration**
4. **Exécuter les migrations dans le désordre**
5. **Committer du code qui dépend de migrations non exécutées**

### ✅ TOUJOURS
1. **Créer une nouvelle migration pour chaque changement de schéma**
2. **Tester la migration sur un environnement de dev d'abord**
3. **Documenter clairement ce que fait la migration**
4. **Communiquer à l'équipe quand vous créez une migration**
5. **Vérifier que la migration est idempotente (peut être relancée sans erreur)**

## 📝 Format Standard d'une Migration

```sql
/*
  # [Titre Court et Descriptif]

  ## Description
  [Explication détaillée de ce que fait la migration]

  ## Changes
  1. New Tables
     - `nom_table`: description
     - Colonnes et leur but

  2. Modified Tables
     - `nom_table`: changements apportés

  3. Security
     - RLS activé/désactivé
     - Policies ajoutées

  4. Indexes
     - Index créés pour performance

  ## Important Notes
  - Notes importantes sur les impacts
  - Avertissements sur les données
  - Instructions spéciales
*/

-- Le code SQL ici
CREATE TABLE IF NOT EXISTS ...
```

## 📊 Suivi des Migrations en Équipe

### Utiliser un Fichier de Suivi

Maintenir un fichier `MIGRATIONS_TO_EXECUTE.md` à jour:

```markdown
# Migrations à Exécuter

## ✅ Exécutées (Production)
- 20251113_001_fix_site_id_trigger.sql
- 20251113_002_fix_storage_policies_format.sql
...

## 🔄 En Attente d'Exécution (À faire)
- 20251114_006_add_shipping_status_history.sql

## 📝 En Développement (Pas encore prêtes)
- 20251114_007_add_freight_status_history.sql (brouillon)
```

### Communication en Équipe

#### Avant de Créer une Migration:
```
💬 "Je vais créer une migration pour [description].
   Quelqu'un travaille-t-il sur le même schéma?"
```

#### Après avoir Créé une Migration:
```
📢 "Nouvelle migration créée: 20251114_006_add_shipping_status_history.sql
   ⚠️  À exécuter avant de tester le module Shipping
   📄 Voir le fichier pour les détails"
```

#### Avant de Merger:
```
✅ "Migration testée sur dev: OK
   📋 Documentation à jour
   🔄 Prêt pour review"
```

## 🛠️ Commandes Utiles

### Vérifier l'État de la Base de Données
```bash
# Se connecter à Supabase
psql "postgres://[CONNECTION_STRING]"

# Lister toutes les tables
\dt

# Voir la structure d'une table
\d+ shipping_status_history

# Vérifier si une table existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'shipping_status_history'
);
```

### Exécuter une Migration Manuellement
```bash
# Via psql
psql "postgres://[CONNECTION_STRING]" < supabase/migrations/20251114_006_add_shipping_status_history.sql

# Via Supabase CLI (si disponible)
supabase db push
```

### Rollback (Annuler une Migration)
```sql
-- Créer toujours une migration de rollback
-- Exemple: 20251114_006_add_shipping_status_history_rollback.sql

DROP TRIGGER IF EXISTS shipping_status_change_trigger ON shipping_preparations;
DROP FUNCTION IF EXISTS create_shipping_status_history_on_update();
DROP TABLE IF EXISTS shipping_status_history CASCADE;
```

## 📚 Documentation des Migrations

### Structure du Projet
```
project/
├── supabase/
│   └── migrations/
│       ├── 20251113_001_fix_site_id_trigger.sql
│       ├── 20251114_006_add_shipping_status_history.sql
│       └── README.md (index de toutes les migrations)
├── docs/
│   └── migrations/
│       ├── CHANGELOG.md (historique des changements)
│       └── TROUBLESHOOTING.md (problèmes courants)
└── MIGRATIONS_TO_EXECUTE.md (liste des migrations en attente)
```

### Tenir un Changelog
```markdown
# Changelog des Migrations

## 2025-11-14

### Added
- `shipping_status_history` table pour tracer les changements de statut
- Trigger automatique pour création d'historique
- RLS policies pour sécurité

### Impact
- Aucun impact sur les données existantes
- Performance: négligeable (trigger optimisé)
- Compatibilité: 100% backward compatible
```

## 🔍 Débogage des Migrations

### Migration Échoue ?

1. **Lire le Message d'Erreur Complet**
```bash
# Activer le mode verbose
psql -v ON_ERROR_STOP=1 "postgres://..." < migration.sql
```

2. **Vérifier les Dépendances**
```sql
-- La table référencée existe-t-elle ?
SELECT * FROM information_schema.tables
WHERE table_name IN ('shipping_preparations', 'users');

-- Les colonnes existent-elles ?
SELECT column_name FROM information_schema.columns
WHERE table_name = 'shipping_preparations';
```

3. **Tester Morceau par Morceau**
```sql
-- Exécuter chaque commande séparément
-- Commenter le reste avec /* */

CREATE TABLE IF NOT EXISTS shipping_status_history (...);
-- Tester ici

CREATE INDEX IF NOT EXISTS ...;
-- Tester ici
```

### Problèmes Courants

#### Erreur: "relation already exists"
```sql
-- Solution: Utiliser IF NOT EXISTS
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
```

#### Erreur: "foreign key constraint"
```sql
-- Solution: Vérifier que les tables référencées existent
-- Ordre des migrations est important!
```

#### Erreur: "must be owner of table"
```sql
-- Solution: Utiliser SECURITY DEFINER sur les fonctions
CREATE OR REPLACE FUNCTION nom_fonction()
RETURNS TRIGGER AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🎯 Workflow Recommandé

### 1. Planification
```
📋 Identifier le besoin
📝 Designer le schéma
💬 Discuter avec l'équipe
✅ Validation du design
```

### 2. Développement
```
🔧 Créer la migration localement
🧪 Tester sur base de données de dev
📄 Documenter les changements
🔍 Review du code SQL
```

### 3. Intégration
```
📤 Commit + Push de la migration
📢 Notifier l'équipe
📋 Ajouter à MIGRATIONS_TO_EXECUTE.md
⏳ Attendre review
```

### 4. Déploiement
```
✅ Approuver la PR
🔄 Merge dans main
🚀 Exécuter en production
📝 Mettre à jour le statut dans MIGRATIONS_TO_EXECUTE.md
📊 Vérifier que tout fonctionne
```

## 📞 En Cas de Doute

### Questions à Se Poser
1. ❓ Cette migration est-elle vraiment nécessaire ?
2. ❓ Peut-elle être fusionnée avec une autre migration ?
3. ❓ Est-elle réversible si besoin ?
4. ❓ Impacte-t-elle les données existantes ?
5. ❓ Nécessite-t-elle un downtime ?

### Qui Contacter
- **Pour le schéma:** Lead Développeur ou Architecte
- **Pour la sécurité (RLS):** Responsable Sécurité
- **Pour les performances:** DBA ou DevOps
- **En cas de blocage:** L'équipe sur Slack/Teams

## 🎓 Ressources

### Documentation
- [Supabase Migrations](https://supabase.com/docs/guides/database/migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Outils
- **Supabase CLI**: Pour gérer les migrations
- **psql**: Client PostgreSQL en ligne de commande
- **pgAdmin**: Interface graphique pour PostgreSQL
- **DBeaver**: Client SQL universel

## ✨ Résumé des Points Clés

1. ✅ **TOUJOURS lister les migrations à exécuter**
2. ✅ **TOUJOURS documenter vos migrations**
3. ✅ **TOUJOURS communiquer avec l'équipe**
4. ✅ **TOUJOURS tester avant de merger**
5. ✅ **TOUJOURS respecter l'ordre chronologique**
6. ❌ **JAMAIS modifier une migration déjà exécutée**
7. ❌ **JAMAIS supprimer une migration en production**

---

**🔄 Dernière mise à jour:** 2025-11-14
**👥 Maintenu par:** L'équipe de développement
**📧 Questions:** Poser dans #dev-database sur Slack
