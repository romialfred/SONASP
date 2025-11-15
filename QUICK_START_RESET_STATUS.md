# 🚀 Guide Rapide: Réinitialiser les Statuts de Production

## Utilisation Simple

### 1. Preview (Recommandé en premier)

```bash
npm run db:reset-production-status:preview
```

Ceci affichera ce qui serait modifié **sans faire aucune modification**.

### 2. Exécution Réelle

```bash
npm run db:reset-production-status
```

Le script vous demandera confirmation avant de procéder.

---

## Ce que fait le script

1. ✅ Change tous les statuts de production à `"prepared"`
2. ✅ Enregistre automatiquement dans `unified_status_history`
3. ✅ Affiche un rapport complet avant/après
4. ✅ Vérifie que le trigger a bien fonctionné

---

## Vérification Rapide

### Vérifier les statuts après exécution

```sql
SELECT status, COUNT(*)
FROM daily_production
GROUP BY status;
```

### Vérifier l'historique

```sql
SELECT old_status, new_status, COUNT(*)
FROM unified_status_history
WHERE entity_type = 'production'
  AND new_status = 'prepared'
  AND changed_at >= NOW() - INTERVAL '10 minutes'
GROUP BY old_status, new_status;
```

---

## Fichiers Créés

- `scripts/reset-all-production-to-prepared.js` - Script principal
- `scripts/reset-all-production-to-prepared.sql` - Alternative SQL
- `scripts/README-reset-production-status.md` - Documentation complète

---

## Besoin d'aide ?

Voir la documentation complète dans `scripts/README-reset-production-status.md`
