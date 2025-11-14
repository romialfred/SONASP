# 🐛 CORRECTION BUG: Historique de Production Manquant

## ❌ Problème Critique Identifié

**Symptôme:** Lorsqu'une production est créée et que son statut change (ex: validé pour la douane), l'historique des changements ne s'affiche PAS dans la page de détails.

**Impact:** Perte totale de traçabilité des changements de statut.

## 🔍 Analyse Root Cause

### 1. Architecture du Système

```
┌─────────────────────┐
│ daily_production    │
│ - id                │
│ - status (ENUM)     │◄── Trigger ici!
│ - created_at        │
└─────────────────────┘
         │
         │ INSERT/UPDATE
         ▼
┌─────────────────────────────┐
│ TRIGGER:                    │
│ production_status_change_   │
│ trigger                     │
└─────────────────────────────┘
         │
         │ Insère dans...
         ▼
┌─────────────────────────────┐
│ unified_status_history      │
│ - entity_type: 'production' │
│ - entity_id: uuid           │
│ - old_status: TEXT          │
│ - new_status: TEXT          │
│ - change_context: ENUM ❌   │ ◄── MANQUANT!
│ - changed_at: timestamp     │
└─────────────────────────────┘
```

### 2. Le Bug Exact

**Fichier:** `supabase/migrations/20251114_005_fix_production_status_trigger.sql`

**Ligne 50-64:** La fonction `log_production_status_change()` insère dans `unified_status_history`:

```sql
INSERT INTO unified_status_history (
  entity_type,
  entity_id,
  old_status,
  new_status,
  changed_by,
  notes
) VALUES (
  'production',
  NEW.id,
  NULL,
  NEW.status::text,
  COALESCE(v_user_id, NEW.created_by),
  'Production créée'
);
```

**❌ Problème:** La colonne `change_context` est **NOT NULL** dans la table mais **ABSENTE** de l'INSERT!

### 3. Définition de la Table

```sql
CREATE TABLE unified_status_history (
  ...
  change_context status_change_context NOT NULL,  ◄── OBLIGATOIRE!
  ...
);
```

**Résultat:** L'INSERT échoue silencieusement, aucune entrée n'est créée, l'historique reste vide.

## ✅ Solution Implémentée

### Migration Corrective

**Fichier:** `supabase/migrations/20251114_008_fix_production_status_trigger_COMPLETE.sql`

### Changements Appliqués

#### 1. Ajout du `change_context`

```sql
DECLARE
  v_context status_change_context;  ◄── Variable pour le contexte
  v_action_desc TEXT;
BEGIN
  -- Déterminer le contexte selon le statut
  CASE NEW.status::text
    WHEN 'prepared' THEN
      v_context := 'production_management';
    WHEN 'ready_for_customs' THEN
      v_context := 'production_management';
    WHEN 'shipped' THEN
      v_context := 'shipping_management';
    ...
  END CASE;
```

#### 2. INSERT Complet

```sql
INSERT INTO unified_status_history (
  entity_type,
  entity_id,
  old_status,
  new_status,
  change_context,        ◄── AJOUTÉ!
  changed_by,
  changed_at,
  action_description,    ◄── AJOUTÉ!
  notes
) VALUES (
  'production',
  NEW.id,
  NULL,
  NEW.status::text,
  v_context,             ◄── Fourni!
  COALESCE(v_user_id, NEW.created_by),
  NOW(),
  v_action_desc,         ◄── Description de l'action
  'Production créée'
);
```

#### 3. Logging Amélioré

```sql
RAISE NOTICE '✅ Historique INSERT créé pour production % avec statut %',
  NEW.id, NEW.status;
```

#### 4. Gestion d'Erreurs

```sql
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Erreur dans log_production_status_change: % - SQLSTATE: %',
    SQLERRM, SQLSTATE;
  RAISE WARNING '   Entity: %, Status: %', NEW.id, NEW.status;
  RETURN NEW;  ◄── Ne pas bloquer l'opération même en cas d'erreur
END;
```

## 📋 Vérification de la Correction

### Script de Diagnostic

**Fichier:** `supabase/migrations/DIAGNOSTIC_PRODUCTION_HISTORY.sql`

Ce script vérifie:

1. ✅ Existence de `unified_status_history`
2. ✅ Trigger activé
3. ✅ Fonction existe
4. ✅ Nombre d'entrées dans l'historique
5. ✅ Historique pour les dernières productions
6. ✅ Structure de la table
7. ✅ Policies RLS
8. ✅ Test d'insertion manuelle

### Exécution du Diagnostic

```bash
# Via psql
psql $SUPABASE_DB_URL -f supabase/migrations/DIAGNOSTIC_PRODUCTION_HISTORY.sql

# Ou via Supabase Dashboard
# SQL Editor → Coller le contenu du fichier → Run
```

## 🎯 Résultat Attendu

### Avant la Correction

```
Historique des Changements
┌────────────────────────────┐
│                            │
│   Aucun changement         │
│   enregistré              │
│                            │
│   L'historique des        │
│   changements apparaîtra  │
│   ici                     │
│                            │
└────────────────────────────┘
```

### Après la Correction

```
Historique des Changements
┌─────────────────────────────────────────────┐
│ ● Préparé → Prêt pour la Douane   [RÉCENT] │
│   27-oct-25 14:30 | user@example.com       │
│   📍 Guinée                                 │
│   ⏱️  Durée: 2h 15min                       │
│   📝 Notes: Validé pour douane              │
├─────────────────────────────────────────────┤
│ ● Production créée (Création)              │
│   27-oct-25 12:15 | user@example.com       │
│   📍 Guinée                                 │
│   📝 Notes: Production créée                │
└─────────────────────────────────────────────┘

2 changements enregistrés
Premier: 27-oct-25
```

## 📊 Données Enregistrées dans l'Historique

Pour chaque changement de statut, le système enregistre:

### Informations Obligatoires

- ✅ **Date et Heure** - `changed_at` (timestamptz)
  - Format: `27-oct-25 14:30`
  - Précision: seconde

- ✅ **Lieu** - Via `siteCountry` (passé en prop)
  - Exemple: "Guinée", "Mali", "Côte d'Ivoire"

- ✅ **Durée** - Calculée entre deux changements
  - Format: "2h 15min", "3j 4h"
  - Affichée automatiquement

- ✅ **Utilisateur** - `changed_by` → `profiles.email`
  - Email de l'utilisateur
  - Fallback: "Système"

- ✅ **Action** - `action_description`
  - "Production créée avec statut: prepared"
  - "Statut changé: prepared → ready_for_customs"
  - "Validé pour la douane"

- ✅ **Contexte** - `change_context`
  - `production_management`
  - `shipping_management`
  - etc.

### Structure de Données

```typescript
interface StatusHistoryEntry {
  id: string;
  production_id: string;
  old_status: ProductionStatus | null;  // null pour création
  new_status: ProductionStatus;
  changed_by: string;                   // UUID
  changed_at: string;                   // ISO timestamp
  notes: string | null;
  user_email: string;                   // Jointure profiles
}
```

## 🔧 Instructions d'Application

### Option 1: Via Supabase Dashboard (RECOMMANDÉ)

1. Connectez-vous au Supabase Dashboard
2. Allez dans **SQL Editor**
3. Créez une nouvelle query
4. Copiez-collez le contenu de:
   ```
   supabase/migrations/20251114_008_fix_production_status_trigger_COMPLETE.sql
   ```
5. Cliquez sur **Run**
6. Vérifiez les messages de sortie

### Option 2: Via CLI (si disponible)

```bash
# Appliquer la migration
supabase db push

# Ou directement via psql
psql $SUPABASE_DB_URL -f supabase/migrations/20251114_008_fix_production_status_trigger_COMPLETE.sql
```

## ✅ Tests à Effectuer

### 1. Test de Création

```sql
-- Créer une nouvelle production
INSERT INTO daily_production (
  production_date,
  bullion_grams,
  estimated_fineness_pct,
  pure_gold_grams,
  estimated_oz,
  bar_reference,
  status,
  created_by
) VALUES (
  '2025-11-14',
  1000.00,
  92.00,
  920.00,
  29.58,
  'TEST-001',
  'prepared',
  auth.uid()
);

-- Vérifier l'historique
SELECT * FROM unified_status_history
WHERE entity_type = 'production'
ORDER BY changed_at DESC
LIMIT 1;
```

**Résultat attendu:** 1 entrée avec:
- `new_status = 'prepared'`
- `old_status = NULL`
- `change_context = 'production_management'`
- `action_description` présent

### 2. Test de Mise à Jour

```sql
-- Changer le statut
UPDATE daily_production
SET status = 'ready_for_customs'
WHERE bar_reference = 'TEST-001';

-- Vérifier l'historique
SELECT * FROM unified_status_history
WHERE entity_type = 'production'
ORDER BY changed_at DESC
LIMIT 2;
```

**Résultat attendu:** 2 entrées, la plus récente avec:
- `old_status = 'prepared'`
- `new_status = 'ready_for_customs'`
- `change_context = 'production_management'`
- `action_description = 'Validé pour la douane'`

### 3. Test via l'Interface

1. Créez une nouvelle production via l'UI
2. Allez sur la page de détails
3. Changez le statut (ex: "Valider pour Douane")
4. Rafraîchissez la page
5. L'historique doit afficher **2 entrées**:
   - Création initiale
   - Changement de statut

## 🚨 Points de Vigilance

### 1. Migrations Existantes

Cette migration **corrige** le trigger créé dans:
- `20251114_005_fix_production_status_trigger.sql`

Elle **n'affecte PAS**:
- Les productions existantes (historique manquant reste manquant)
- Les données dans `daily_production`

### 2. Historique Passé

Les productions créées **avant** cette correction n'ont **pas** d'historique.

**Options:**
1. Accepter la perte d'historique passé
2. Créer un script de backfill (si besoin)

### 3. Production Future

Toutes les productions créées **après** cette correction auront:
- ✅ Historique de création
- ✅ Historique de tous les changements de statut
- ✅ Toutes les métadonnées (date, heure, lieu, durée, utilisateur)

## 📝 Recommandations

### 1. Tests Immédiats

- [ ] Appliquer la migration
- [ ] Créer une production de test
- [ ] Changer son statut
- [ ] Vérifier l'affichage de l'historique

### 2. Surveillance

- [ ] Monitorer les logs PostgreSQL pour erreurs
- [ ] Vérifier régulièrement le nombre d'entrées dans `unified_status_history`
- [ ] Alerter si ratio (productions / entrées historique) < 1

### 3. Documentation

- [ ] Mettre à jour la documentation technique
- [ ] Former les utilisateurs sur l'historique
- [ ] Documenter les statuts disponibles

## 🎓 Leçons Apprises

### Pourquoi ce Bug s'est Produit

1. **Migration incomplète:** Le trigger a été créé sans tous les champs obligatoires
2. **Tests insuffisants:** Le trigger n'a pas été testé après création
3. **Erreurs silencieuses:** PostgreSQL SECURITY DEFINER cache les erreurs par défaut
4. **Absence de monitoring:** Aucune alerte sur les INSERT qui échouent

### Comment Éviter à l'Avenir

1. **✅ Tests systématiques:** Tester chaque trigger après création
2. **✅ Logging explicite:** Ajouter RAISE NOTICE dans les triggers
3. **✅ Validation de schéma:** Vérifier que tous les champs NOT NULL sont fournis
4. **✅ Monitoring:** Mettre en place des alertes sur les tables critiques
5. **✅ Code review:** Révision par un autre développeur

## 📞 Support

En cas de problème:

1. Exécuter le diagnostic: `DIAGNOSTIC_PRODUCTION_HISTORY.sql`
2. Vérifier les logs PostgreSQL
3. Consulter ce document
4. Contacter l'équipe technique avec les résultats du diagnostic

---

**Date:** 2025-11-14
**Version:** 1.0
**Statut:** ✅ CORRECTION PRÊTE À APPLIQUER
**Priorité:** 🔴 CRITIQUE

**Cette correction est ESSENTIELLE pour la traçabilité et la conformité!**
