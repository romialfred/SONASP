# Script de Réinitialisation des Statuts de Production

## 📋 Vue d'ensemble

Ce script permet de changer tous les statuts des productions à `"prepared"` et s'assure que tous les changements sont enregistrés dans la table `unified_status_history`.

## 🎯 Ce que fait le script

1. **Affiche le résumé actuel** des statuts de toutes les productions
2. **Identifie les productions** dont le statut n'est pas "prepared"
3. **Met à jour tous les statuts** à "prepared"
4. **Vérifie que le trigger** `log_unified_status_change` a bien créé des entrées dans `unified_status_history`
5. **Affiche un rapport final** avec statistiques

## 🚀 Utilisation

### Option 1: Script JavaScript (Recommandé)

```bash
# Preview (mode dry-run) - Affiche ce qui serait fait sans modifier
npm run db:reset-production-status:preview

# Exécution réelle - Modifie toutes les productions
npm run db:reset-production-status
```

Ou directement :

```bash
# Mode dry-run
node scripts/reset-all-production-to-prepared.js --dry-run

# Exécution réelle
node scripts/reset-all-production-to-prepared.js
```

### Option 2: Script SQL (Pour utilisateurs avancés)

```bash
# Nécessite psql installé et configuré
psql $SUPABASE_DB_URL -f scripts/reset-all-production-to-prepared.sql
```

## 📊 Exemple de sortie

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RÉSUMÉ AVANT MODIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Statut                        Nombre
──────────────────────────────────────────────────
ready_for_customs                 45
prepared                          23
in_inventory                      12
shipped_to_refinery                8
──────────────────────────────────────────────────
TOTAL                             88

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 PRODUCTIONS À MODIFIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nombre total: 65

Exemples (5 premiers):

Référence           Statut Actuel       Date Production
──────────────────────────────────────────────────────────────────────
HUMYAN-0002         ready_for_customs   31/10/2025
HUMYAN-0001         in_inventory        30/10/2025
HUMYAN-0003         shipped_to_refinery 29/10/2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔨 MISE À JOUR EN COURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Progression: 65/65

✅ 65 productions mises à jour avec succès

⏳ Attente de l'exécution des triggers...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 VÉRIFICATION HISTORIQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 65 entrées trouvées dans unified_status_history

Dernières entrées créées:

Ancien Statut       Nouveau         Date Changement
──────────────────────────────────────────────────────────────────────
ready_for_customs   prepared        15/01/2025 14:30:45
in_inventory        prepared        15/01/2025 14:30:44
shipped_to_refinery prepared        15/01/2025 14:30:43

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RÉSUMÉ APRÈS MODIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Statut                        Nombre
──────────────────────────────────────────────────
prepared                          88
──────────────────────────────────────────────────
TOTAL                             88

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SCRIPT TERMINÉ AVEC SUCCÈS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔍 Vérification manuelle

Après l'exécution du script, vous pouvez vérifier manuellement :

### Vérifier les statuts des productions

```sql
SELECT
  status,
  COUNT(*) as count
FROM daily_production
WHERE status IS NOT NULL
GROUP BY status
ORDER BY count DESC;
```

### Vérifier l'historique

```sql
SELECT
  entity_id,
  old_status,
  new_status,
  changed_at,
  action_description
FROM unified_status_history
WHERE entity_type = 'production'
  AND new_status = 'prepared'
ORDER BY changed_at DESC
LIMIT 20;
```

### Vérifier le fonctionnement du trigger

```sql
-- Le trigger devrait avoir créé des entrées dans unified_status_history
SELECT COUNT(*) as total_history_entries
FROM unified_status_history
WHERE entity_type = 'production'
  AND changed_at >= NOW() - INTERVAL '5 minutes';
```

## ⚙️ Fonctionnement technique

### Trigger automatique

Le script s'appuie sur le trigger `log_unified_status_change` qui est défini dans la migration `unified_status_system_fixed.sql` :

```sql
CREATE TRIGGER unified_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  WHEN (NEW.status IS NOT NULL)
  EXECUTE FUNCTION log_unified_status_change();
```

Ce trigger **s'exécute automatiquement** à chaque fois qu'un statut de production est modifié et crée une entrée dans `unified_status_history`.

### Structure de unified_status_history

```sql
unified_status_history (
  id                  uuid PRIMARY KEY,
  entity_type         text,              -- 'production', 'shipping_preparation', etc.
  entity_id           uuid,              -- ID de l'entité
  old_status          text,              -- Ancien statut
  new_status          text,              -- Nouveau statut
  change_context      status_change_context,
  changed_by          uuid,              -- User ID
  changed_at          timestamptz,       -- Date du changement
  action_description  text,              -- Description automatique
  notes               text,              -- Notes optionnelles
  metadata            jsonb              -- Métadonnées additionnelles
)
```

## ⚠️ Avertissements

### Mode Dry-Run d'abord !

**Toujours exécuter le script en mode `--dry-run` d'abord** pour voir ce qui sera modifié :

```bash
npm run db:reset-production-status:preview
```

### Impact sur les données

- ✅ **Les changements sont irréversibles** (sauf restauration depuis backup)
- ✅ **L'historique est préservé** dans `unified_status_history`
- ✅ **Aucune donnée n'est supprimée**, seulement les statuts sont modifiés

### Sécurité

- Le script utilise les credentials Supabase depuis `.env`
- Les modifications sont enregistrées avec l'ID de l'utilisateur système
- Tous les changements sont tracés dans `unified_status_history`

## 🐛 Dépannage

### Le script ne trouve aucune production

Vérifiez que la table `daily_production` contient des données :

```sql
SELECT COUNT(*) FROM daily_production;
```

### Aucune entrée dans unified_status_history

Vérifiez que le trigger existe :

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'unified_status_change_trigger';
```

Si le trigger n'existe pas, appliquez la migration :

```bash
# Appliquer la migration unified_status_system
psql $SUPABASE_DB_URL -f supabase/migrations/unified_status_system_fixed.sql
```

### Erreurs de permissions

Assurez-vous que l'utilisateur a les droits nécessaires :

```sql
GRANT UPDATE ON daily_production TO authenticated;
GRANT INSERT ON unified_status_history TO authenticated;
```

## 📚 Voir aussi

- [unified_status_system_fixed.sql](../supabase/migrations/unified_status_system_fixed.sql) - Migration du système de statuts unifié
- [README_unified_status.md](../supabase/migrations/README_unified_status.md) - Documentation complète du système
- [PRODUCTION_STATUS_SYSTEM.md](../PRODUCTION_STATUS_SYSTEM.md) - Guide du système de statuts de production

## ✅ Checklist avant exécution

- [ ] Variables d'environnement configurées (`.env`)
- [ ] Script exécuté en mode `--dry-run` d'abord
- [ ] Résultats du dry-run vérifiés
- [ ] Backup de la base de données effectué (optionnel mais recommandé)
- [ ] Confirmation que c'est le bon environnement (dev/staging/prod)
- [ ] Toute l'équipe est informée de la modification

---

**Dernière mise à jour:** 2025-01-15
