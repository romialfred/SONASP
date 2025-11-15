# ✅ Script de Réinitialisation des Statuts - Créé

## Date: 2025-01-15

## 🎯 Objectif

Créer un script pour changer tous les statuts des productions à `"prepared"` et s'assurer que tous les changements sont enregistrés dans la table `unified_status_history`.

---

## 📦 Fichiers Créés

### 1. Script JavaScript (Recommandé)
**Fichier:** `scripts/reset-all-production-to-prepared.js`

**Caractéristiques:**
- ✅ Mode dry-run (`--dry-run`) pour prévisualisation
- ✅ Affichage détaillé de la progression
- ✅ Vérification automatique de l'historique
- ✅ Rapport complet avant/après
- ✅ Gestion d'erreurs robuste
- ✅ Support Ctrl+C pour annulation

**Utilisation:**
```bash
# Preview (sans modification)
npm run db:reset-production-status:preview

# Exécution réelle
npm run db:reset-production-status
```

### 2. Script SQL (Alternative)
**Fichier:** `scripts/reset-all-production-to-prepared.sql`

**Caractéristiques:**
- ✅ Script SQL pur pour psql
- ✅ Table temporaire pour sauvegarder les anciens statuts
- ✅ Vérification complète avec rapports
- ✅ Messages colorés et formatés

**Utilisation:**
```bash
psql $SUPABASE_DB_URL -f scripts/reset-all-production-to-prepared.sql
```

### 3. Documentation Complète
**Fichier:** `scripts/README-reset-production-status.md`

**Contenu:**
- Vue d'ensemble du script
- Instructions d'utilisation détaillées
- Exemples de sortie
- Vérification manuelle
- Fonctionnement technique
- Dépannage
- Checklist avant exécution

---

## 🔧 Fonctionnement Technique

### Flux d'exécution

```
┌─────────────────────────────────────────────────┐
│ 1. Résumé des statuts AVANT                     │
│    - Compte par statut                          │
│    - Liste des productions à modifier           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Mise à jour des productions                  │
│    UPDATE daily_production                      │
│    SET status = 'prepared'                      │
│    WHERE status != 'prepared'                   │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Trigger automatique                          │
│    log_unified_status_change()                  │
│    ↓                                            │
│    INSERT INTO unified_status_history           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Vérification                                 │
│    - Compte les nouvelles entrées               │
│    - Affiche les dernières modifications        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 5. Résumé des statuts APRÈS                     │
│    - Tous les statuts = "prepared"              │
│    - Rapport final avec statistiques            │
└─────────────────────────────────────────────────┘
```

### Trigger log_unified_status_change

Le trigger s'exécute automatiquement sur `daily_production` :

```sql
CREATE TRIGGER unified_status_change_trigger
  AFTER INSERT OR UPDATE ON daily_production
  FOR EACH ROW
  WHEN (NEW.status IS NOT NULL)
  EXECUTE FUNCTION log_unified_status_change();
```

**Fonction du trigger:**
1. Détecte le changement de statut
2. Identifie l'entité (production, shipping, etc.)
3. Crée une entrée dans `unified_status_history` avec :
   - `entity_type`: 'production'
   - `entity_id`: ID de la production
   - `old_status`: Ancien statut
   - `new_status`: 'prepared'
   - `changed_by`: User ID (ou système)
   - `changed_at`: Timestamp
   - `action_description`: Description automatique

---

## 📊 Exemple d'exécution

### Mode Preview (Dry-Run)

```bash
$ npm run db:reset-production-status:preview

🔄 Script de Réinitialisation des Statuts de Production

⚠️  MODE DRY-RUN: Aucune modification ne sera effectuée

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

⚠️  MODE DRY-RUN: Les modifications ci-dessus ne seront PAS effectuées
   Retirez --dry-run pour effectuer les modifications
```

### Mode Réel

```bash
$ npm run db:reset-production-status

🔄 Script de Réinitialisation des Statuts de Production

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RÉSUMÉ AVANT MODIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[... résumé ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ATTENTION: Vous êtes sur le point de modifier 65 productions
   Tous les statuts seront changés à "prepared"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Démarrage dans 3 secondes... (Ctrl+C pour annuler)
2...
1...

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

---

## 🔍 Vérification Post-Exécution

### 1. Vérifier les statuts

```sql
SELECT status, COUNT(*) as count
FROM daily_production
GROUP BY status;

-- Résultat attendu:
-- prepared | 88
```

### 2. Vérifier l'historique

```sql
SELECT
  old_status,
  new_status,
  COUNT(*) as count
FROM unified_status_history
WHERE entity_type = 'production'
  AND new_status = 'prepared'
  AND changed_at >= NOW() - INTERVAL '5 minutes'
GROUP BY old_status, new_status;

-- Résultat attendu: Une entrée par ancien statut
-- ready_for_customs → prepared | 45
-- in_inventory → prepared      | 12
-- shipped_to_refinery → prepared | 8
```

### 3. Vérifier les détails

```sql
SELECT
  dp.bar_reference,
  ush.old_status,
  ush.new_status,
  ush.changed_at,
  ush.action_description
FROM unified_status_history ush
JOIN daily_production dp ON dp.id = ush.entity_id
WHERE ush.entity_type = 'production'
  AND ush.new_status = 'prepared'
  AND ush.changed_at >= NOW() - INTERVAL '5 minutes'
ORDER BY ush.changed_at DESC
LIMIT 10;
```

---

## 📝 Scripts npm ajoutés

```json
{
  "scripts": {
    "db:reset-production-status": "node scripts/reset-all-production-to-prepared.js",
    "db:reset-production-status:preview": "node scripts/reset-all-production-to-prepared.js --dry-run"
  }
}
```

---

## ⚙️ Configuration requise

### Variables d'environnement (.env)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Dépendances

Déjà installées dans le projet :
- `@supabase/supabase-js`
- `dotenv`

---

## ⚠️ Avertissements et bonnes pratiques

### ✅ À FAIRE

1. **Toujours tester en dry-run d'abord**
   ```bash
   npm run db:reset-production-status:preview
   ```

2. **Vérifier l'environnement**
   - Dev, Staging ou Production ?
   - Variables d'environnement correctes ?

3. **Informer l'équipe**
   - Avertir avant de lancer en production
   - Choisir un moment approprié

4. **Vérifier après exécution**
   - Statuts des productions
   - Entrées dans unified_status_history

### ❌ À NE PAS FAIRE

1. Ne jamais exécuter directement sans dry-run
2. Ne pas lancer en production sans backup
3. Ne pas interrompre le script pendant l'exécution
4. Ne pas exécuter plusieurs fois simultanément

---

## 🛠️ Dépannage

### Problème: Aucune production trouvée

**Cause:** Table vide ou toutes déjà à "prepared"

**Solution:**
```sql
SELECT COUNT(*), status
FROM daily_production
GROUP BY status;
```

### Problème: Historique non créé

**Cause:** Trigger désactivé ou inexistant

**Solution:**
```sql
-- Vérifier le trigger
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'unified_status_change_trigger';

-- Si absent, appliquer la migration
-- psql $SUPABASE_DB_URL -f supabase/migrations/unified_status_system_fixed.sql
```

### Problème: Erreur de permissions

**Cause:** Droits insuffisants

**Solution:**
```sql
GRANT UPDATE ON daily_production TO authenticated;
GRANT INSERT ON unified_status_history TO authenticated;
```

---

## 📚 Documentation associée

- [unified_status_system_fixed.sql](supabase/migrations/unified_status_system_fixed.sql)
- [README_unified_status.md](supabase/migrations/README_unified_status.md)
- [PRODUCTION_STATUS_SYSTEM.md](PRODUCTION_STATUS_SYSTEM.md)
- [README-reset-production-status.md](scripts/README-reset-production-status.md)

---

## ✅ Résumé

### Ce qui a été créé:

1. ✅ **Script JavaScript** avec mode dry-run
2. ✅ **Script SQL** pour psql
3. ✅ **Documentation complète** avec exemples
4. ✅ **Scripts npm** pour faciliter l'utilisation
5. ✅ **Gestion d'erreurs** robuste
6. ✅ **Vérification automatique** de l'historique

### Garanties:

- ✅ Tous les changements sont enregistrés dans `unified_status_history`
- ✅ Le trigger fonctionne automatiquement
- ✅ Mode dry-run pour prévisualisation sûre
- ✅ Rapports détaillés avant/après
- ✅ Vérification de l'intégrité des données

**Status: PRÊT À UTILISER**

---

**Dernière mise à jour:** 2025-01-15
