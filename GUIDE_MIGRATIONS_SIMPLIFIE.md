# 📋 Guide Migrations Simplifié - Pour Toute l'Équipe

## 🎯 Les 3 Règles d'Or

### 1️⃣ VÉRIFIER avant d'exécuter
### 2️⃣ EXÉCUTER dans l'ordre
### 3️⃣ DOCUMENTER après l'exécution

---

## 🔄 Workflow Complet (10 minutes)

```
┌────────────────────────────────────────────────────────┐
│  1. GIT PULL                                           │
│     git pull origin main                               │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  2. VÉRIFIER LES MIGRATIONS                            │
│     Ouvrir: MIGRATIONS_TO_EXECUTE_NOW.md               │
│     Y a-t-il des migrations 🔴 en attente?            │
└────────────────────┬───────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
           │                   │
           ▼                   ▼
      Oui 🔴              Non ✅
           │                   │
           │                   └──→ Vous pouvez coder! 🎉
           │
           ▼
┌────────────────────────────────────────────────────────┐
│  3. EXÉCUTER LE SCRIPT DE VÉRIFICATION                 │
│     Supabase Dashboard > SQL Editor                    │
│     Copier: scripts/verify-database-structure.sql      │
│     Run                                                │
└────────────────────┬───────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
           │                   │
           ▼                   ▼
    Résultat OK ✅      Résultat Erreur ❌
           │                   │
           │                   └──→ Résoudre d'abord
           │                        (voir section Problèmes)
           │
           ▼
┌────────────────────────────────────────────────────────┐
│  4. EXÉCUTER LA MIGRATION                              │
│     Supabase Dashboard > SQL Editor                    │
│     Copier: contenu de la migration.sql                │
│     Run                                                │
└────────────────────┬───────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
           │                   │
           ▼                   ▼
      Succès ✅           Erreur ❌
           │                   │
           │                   └──→ Voir: FIX_MIGRATION_006_ERROR.md
           │
           ▼
┌────────────────────────────────────────────────────────┐
│  5. VÉRIFIER LE RÉSULTAT                               │
│     - Tester l'interface                               │
│     - Vérifier que tout fonctionne                     │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  6. METTRE À JOUR LA DOCUMENTATION                     │
│     MIGRATIONS_TO_EXECUTE_NOW.md:                      │
│     🔴 À EXÉCUTER → ✅ Exécutée                       │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  7. NOTIFIER L'ÉQUIPE                                  │
│     Dans #dev-database:                                │
│     "Migration XXX exécutée avec succès ✅"           │
└────────────────────────────────────────────────────────┘
```

---

## 🚨 En Cas de Problème

### Problème 1: "relation does not exist"

**Signification:** Une table requise n'existe pas

**Solution:**
1. Voir quelle table manque dans l'erreur
2. Chercher quelle migration crée cette table
3. Exécuter d'abord cette migration
4. Puis revenir à votre migration

### Problème 2: "permission denied"

**Signification:** Droits insuffisants

**Solution:**
- Vérifier que vous êtes connecté comme admin
- Contacter @devops

### Problème 3: "already exists"

**Signification:** Migration déjà exécutée (en partie)

**Solution:**
1. Vérifier avec `verify-database-structure.sql`
2. Si table existe déjà: Migration OK ✅
3. Si partiellement créée: Voir guide rollback

---

## 📚 Documents Utiles

### Lecture Rapide (5 min)

| Document | Quand l'utiliser | Temps |
|----------|-----------------|-------|
| `MIGRATIONS_TO_EXECUTE_NOW.md` | Avant chaque session | 1 min |
| `QUICK_MIGRATION_GUIDE.md` | Pour exécuter maintenant | 5 min |
| `FIX_MIGRATION_006_ERROR.md` | Si erreur "users does not exist" | 2 min |

### Lecture Approfondie (30 min)

| Document | Quand l'utiliser | Temps |
|----------|-----------------|-------|
| `MIGRATIONS_BEST_PRACTICES.md` | Onboarding nouveaux devs | 20 min |
| `REPONSE_ERREUR_MIGRATION.md` | Comprendre l'erreur récente | 10 min |

### Scripts Utiles

| Script | Usage | Où l'exécuter |
|--------|-------|---------------|
| `verify-database-structure.sql` | Vérifier dépendances | Supabase SQL Editor |
| `check-migrations-status.sql` | Voir l'état des migrations | Supabase SQL Editor |

---

## ✅ Checklist Visuelle

Avant d'exécuter une migration:

```
□ J'ai lu MIGRATIONS_TO_EXECUTE_NOW.md
□ J'ai exécuté verify-database-structure.sql
□ Le résultat est ✅ (pas ❌)
□ J'ai lu la documentation dans le fichier .sql
□ J'ai la bonne version du fichier (pas _OLD ou _BACKUP)
□ Je suis connecté avec les bons droits
□ J'ai prévenu l'équipe que je vais l'exécuter
```

Après avoir exécuté une migration:

```
□ La commande a retourné "Success"
□ J'ai testé l'interface
□ Tout fonctionne correctement
□ J'ai mis à jour MIGRATIONS_TO_EXECUTE_NOW.md
□ J'ai commit la mise à jour de la doc
□ J'ai notifié l'équipe du succès
```

---

## 🎓 Questions Fréquentes

### Q: Puis-je exécuter une migration deux fois?

**R:** Oui, si elle utilise `IF NOT EXISTS`. Nos migrations sont idempotentes.

### Q: Dans quel ordre exécuter?

**R:** TOUJOURS dans l'ordre chronologique du timestamp.
```
20251114_001 → 20251114_002 → 20251114_003 → ...
```

### Q: Que faire si j'oublie une migration?

**R:** Pas grave! Exécutez-la dès que vous le remarquez. Puis testez tout.

### Q: Qui peut exécuter les migrations en prod?

**R:** Lead Dev ou DevOps avec les accès appropriés.

### Q: Comment annuler une migration?

**R:**
1. Créer une migration de rollback
2. Tester sur dev
3. Exécuter en prod
4. Ne JAMAIS supprimer la migration originale

---

## 💡 Conseils Pro

### 1. Toujours Sauvegarder Avant

Même si rare, une erreur peut arriver. Supabase fait des backups automatiques, mais:
```sql
-- Pour une grosse migration, faire un snapshot manuel
-- Supabase Dashboard > Database > Backups
```

### 2. Tester Sur Dev D'abord

Si vous avez une base de dev locale:
```bash
# Tester d'abord là
psql dev_db < migration.sql

# Si OK, puis en prod
```

### 3. Lire Les Logs

Après une migration, vérifier les logs:
```
Supabase Dashboard > Logs
```

### 4. Documenter Les Problèmes

Si vous rencontrez un problème:
1. Le noter dans un doc
2. Partager la solution avec l'équipe
3. Mettre à jour les Best Practices

---

## 🚀 Exemple Complet

### Scénario: Vous arrivez lundi matin

```bash
# 1. Tirer le code
git pull origin main

# 2. Voir les nouveautés
git log --oneline -5
# → Vous voyez: "feat: add shipping status history"

# 3. Ouvrir la doc
cat MIGRATIONS_TO_EXECUTE_NOW.md
# → 🔴 1 migration en attente

# 4. Aller sur Supabase
# Dashboard > SQL Editor

# 5. Vérifier la structure
# Copier/coller: scripts/verify-database-structure.sql
# Run
# → ✅ Tout OK

# 6. Exécuter la migration
# Copier/coller: supabase/migrations/20251114_006_add_shipping_status_history_FIXED.sql
# Run
# → Success ✅

# 7. Vérifier
# Ouvrir l'app > Shipping > Details
# → ✅ Tout fonctionne!

# 8. Mettre à jour la doc
# Éditer MIGRATIONS_TO_EXECUTE_NOW.md
# 🔴 → ✅

# 9. Commit
git add MIGRATIONS_TO_EXECUTE_NOW.md
git commit -m "docs: mark migration 006 as executed"
git push

# 10. Notifier
# Dans Slack #dev-database:
# "Migration 006 exécutée avec succès ✅"
```

**Temps total: 10 minutes**
**Difficulté: Facile**
**Stress: Zéro** (vous avez vérifié avant!)

---

## 📞 Aide Rapide

### Quelque Chose Ne Va Pas?

1. **D'abord:** Ne paniquez pas! 😌
2. **Ensuite:** Lire l'erreur complète
3. **Chercher:** Dans `FIX_MIGRATION_006_ERROR.md`
4. **Tester:** `verify-database-structure.sql`
5. **Demander:** Dans #dev-database

### Contacts Directs

- **Questions générales:** #dev-database
- **Urgences:** @lead-dev
- **Permissions:** @devops
- **Bugs migrations:** @database-team

---

## 🎯 TL;DR (Version Ultra-Courte)

```
1. git pull
2. Voir MIGRATIONS_TO_EXECUTE_NOW.md
3. Migration en attente? → Exécuter verify-database-structure.sql
4. OK? → Exécuter la migration
5. Succès? → Mettre à jour la doc + notifier équipe
6. Erreur? → Voir FIX_MIGRATION_006_ERROR.md
```

**C'est tout!** 🎉

---

**📅 Dernière mise à jour:** 2025-11-14
**👥 Pour:** Toute l'équipe
**⏱️ Temps de lecture:** 5 minutes
**💪 Niveau:** Débutant à Expert
**🎯 Objectif:** Zéro erreur, zéro stress
