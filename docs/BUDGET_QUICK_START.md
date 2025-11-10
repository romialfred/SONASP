# 🚀 Guide Rapide - Module Budget & Forecasts

## 📍 Comment Accéder au Module

### **Via le Menu Navigation**

1. **Se connecter** avec un compte Management
2. **Ouvrir le menu** Production Management (icône Factory 🏭)
3. **Cliquer sur** "Budget & Forecasts"

**Ou directement via URL:**
```
https://votre-app.com/performance/budgets
```

---

## ✅ Vérification Post-Migration

### **1. Vérifier que la Migration est Appliquée**

Dans Supabase SQL Editor:

```sql
-- Vérifier les tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('annual_budgets', 'quarterly_forecasts', 'daily_budget_breakdown')
ORDER BY table_name;
```

**Résultat attendu:** 3 tables

### **2. Vérifier les Fonctions**

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%budget%' OR routine_name LIKE '%forecast%')
ORDER BY routine_name;
```

**Résultat attendu:** 6 fonctions

---

## 🎯 Premier Pas: Créer le Budget 2025

### **Étape 1: Ouvrir la Page**

1. Menu > Production Management > Budget & Forecasts
2. Vous arrivez sur la page avec l'année courante

### **Étape 2: Créer le Budget Annuel**

1. Rester sur l'onglet **"Budget Annuel"**
2. Remplir la matrice des 12 mois:

**Exemple:**
```
Janvier:    930 oz
Février:    840 oz
Mars:       930 oz
Avril:      900 oz
Mai:        930 oz
Juin:       900 oz
Juillet:    930 oz
Août:       930 oz
Septembre:  900 oz
Octobre:    930 oz
Novembre:   900 oz
Décembre:   930 oz
```

3. **Vérifier** les totaux automatiques:
   - Q1: 2700 oz
   - Q2: 2730 oz
   - Q3: 2760 oz
   - Q4: 2760 oz
   - **Total: 10950 oz**

4. Cliquer **"Enregistrer"**

### **Étape 3: Vérifier la Génération Automatique**

```sql
-- Vérifier que 365 jours ont été générés
SELECT COUNT(*) as total_days
FROM daily_budget_breakdown
WHERE source_type = 'budget'
AND year = 2025;

-- Voir quelques exemples
SELECT date, month, daily_oz, days_in_month
FROM daily_budget_breakdown
WHERE source_type = 'budget'
AND year = 2025
AND month = 1
LIMIT 5;
```

**Résultat attendu:**
```
2025-01-01 | 1 | 30.0000 | 31
2025-01-02 | 1 | 30.0000 | 31
2025-01-03 | 1 | 30.0000 | 31
...
```

---

## 📊 Créer une Révision Trimestrielle

### **En Mars 2025 (Fin Q1)**

1. Cliquer sur l'onglet **"Forecast Q1"**
2. La matrice est pré-remplie avec le budget initial
3. **Ajuster les valeurs** selon la performance réelle:

**Exemple de Révision Q1:**
```
Janvier:    920 oz  (légèrement en dessous du budget)
Février:    850 oz  (ajusté à la hausse)
Mars:       920 oz  (ajusté)
Avril:      910 oz  (révisé)
Mai:        935 oz  (révisé)
Juin:       905 oz  (révisé)
Juillet:    925 oz  (révisé)
Août:       925 oz  (révisé)
Septembre:  895 oz  (révisé)
Octobre:    925 oz  (révisé)
Novembre:   895 oz  (révisé)
Décembre:   925 oz  (révisé)
```

4. Ajouter une **note** (optionnel):
```
"Révision Q1 - Performance légèrement sous budget en janvier,
ajustement prudent pour Q2-Q4 basé sur les conditions du marché"
```

5. Cliquer **"Enregistrer"**

---

## 🔍 Visualiser les Comparaisons

### **Dashboard avec Statistiques**

En haut de la page, vous verrez:

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Budget      │ Forecasts   │ Trimestre   │ Prochaine   │
│ Annuel      │ Complétés   │ Actuel      │ Révision    │
│ 10950 oz    │ 1/4         │ Q1          │ Q2 (Juin)   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### **Calendrier de Révision**

Affiche les 4 trimestres avec statut:
- ✓ Vert: Révision complétée
- ! Orange: Révision en attente (période active)
- Gris: Révision future

---

## 🎨 Interface Matricielle

### **Fonctionnalités Clés**

1. **Badge Trimestre**: Chaque mois a un badge coloré Q1-Q4
2. **Jours du Mois**: Affiché sous chaque mois (gère années bissextiles)
3. **Moyenne Journalière**: Calcul en temps réel sous chaque mois
4. **Totaux Trimestriels**: Cartes en bas avec totaux par trimestre
5. **Total Annuel**: Grand récapitulatif en bas
6. **Cellules Modifiées**: Fond orange pour les cellules changées
7. **Compteur de Modifications**: Bouton "Enregistrer (3 modif.)"

---

## 📈 Consulter les Performances

### **Via SQL (Pour Management)**

**Budget vs Réel du Jour:**
```sql
SELECT
  b.date,
  b.daily_oz as budget_daily,
  dp.estimated_oz as actual_daily,
  (dp.estimated_oz - b.daily_oz) as variance,
  ROUND((dp.estimated_oz / b.daily_oz * 100), 2) as achievement_pct
FROM daily_budget_breakdown b
LEFT JOIN daily_production dp ON dp.production_date = b.date
WHERE b.source_type = 'budget'
AND b.date >= CURRENT_DATE - INTERVAL '7 days'
AND b.date <= CURRENT_DATE
ORDER BY b.date DESC;
```

**Cumul Mensuel:**
```sql
SELECT
  b.month,
  SUM(b.daily_oz) as budget_monthly,
  SUM(dp.estimated_oz) as actual_monthly,
  SUM(dp.estimated_oz) - SUM(b.daily_oz) as variance,
  ROUND((SUM(dp.estimated_oz) / SUM(b.daily_oz) * 100), 2) as achievement_pct
FROM daily_budget_breakdown b
LEFT JOIN daily_production dp ON dp.production_date = b.date
WHERE b.source_type = 'budget'
AND b.year = 2025
GROUP BY b.month
ORDER BY b.month;
```

---

## 🛠️ Résolution de Problèmes

### **Problème 1: Menu "Budget & Forecasts" Non Visible**

**Solution:**
```bash
# Reconstruire l'application
npm run build

# Vider le cache du navigateur
Ctrl + Shift + R (ou Cmd + Shift + R sur Mac)
```

### **Problème 2: Erreur "annual_budgets does not exist"**

**Solution:** La migration n'a pas été appliquée

```sql
-- Vérifier dans Supabase SQL Editor
SELECT * FROM annual_budgets LIMIT 1;

-- Si erreur, appliquer la migration:
-- Copier le contenu de:
-- supabase/migrations/20251111000000_create_annual_budget_system.sql
-- Et l'exécuter dans SQL Editor
```

### **Problème 3: Budget Créé mais Breakdown Non Généré**

**Solution:** Forcer la régénération

```sql
-- Forcer le trigger
UPDATE annual_budgets
SET updated_at = now()
WHERE year = 2025;

-- Vérifier
SELECT COUNT(*)
FROM daily_budget_breakdown
WHERE source_type = 'budget' AND year = 2025;
-- Devrait retourner 365 (ou 366 si bissextile)
```

### **Problème 4: Permissions Insuffisantes**

**Erreur:** "You do not have permission to perform this action"

**Solution:**
```sql
-- Vérifier le rôle
SELECT role FROM user_profiles WHERE user_id = auth.uid();

-- Le rôle doit être 'Management'
-- Si incorrect, demander à un admin de modifier
```

---

## 📱 Navigation Rapide

### **Accès Direct via URL**

```
Budget Annuel:           /performance/budgets
Forecast Q1:             /performance/budgets (onglet "Forecast Q1")
Forecast Q2:             /performance/budgets (onglet "Forecast Q2")
Forecast Q3:             /performance/budgets (onglet "Forecast Q3")
Forecast Q4:             /performance/budgets (onglet "Forecast Q4")
```

### **Menu Complet**

```
Production Management
├── Daily Production        (/production/daily)
├── Budget & Forecasts      (/performance/budgets) ← NOUVEAU
└── Performance Analysis    (/performance/analysis)
```

---

## 🎓 Workflow Recommandé

### **Janvier (Début d'Année)**
1. Créer le budget annuel 2025
2. Valider avec l'équipe de direction
3. Enregistrer dans le système

### **Mars (Fin Q1)**
1. Analyser les 3 mois réels
2. Comparer Budget vs Réel
3. Créer Forecast Q1 avec ajustements

### **Juin (Fin Q2)**
1. Analyser les 6 mois réels
2. Comparer Forecast Q1 vs Réel
3. Créer Forecast Q2 avec nouvelles projections

### **Septembre (Fin Q3)**
1. Analyser les 9 mois réels
2. Créer Forecast Q3
3. Ajuster les 3 derniers mois

### **Décembre (Fin Q4)**
1. Forecast Q4 optionnel (bilan final)
2. Préparer le budget de l'année suivante

---

## 💡 Astuces

### **1. Saisie Rapide**
- Utiliser Tab pour passer d'un champ à l'autre
- Les calculs sont automatiques (pas besoin de cliquer)

### **2. Années Bissextiles**
- Le système détecte automatiquement
- Février affiche 28 ou 29 jours selon l'année

### **3. Copier-Coller**
- Possible de copier depuis Excel
- Format: une valeur par ligne

### **4. Validation**
- Vérifier les totaux trimestriels avant d'enregistrer
- Le total annuel doit être cohérent

### **5. Notes**
- Toujours ajouter des notes de révision
- Elles sont affichées en bas de chaque forecast

---

## 📞 Support

**Documentation Complète:**
```
docs/BUDGET_MANAGEMENT_SYSTEM.md
```

**En Cas de Problème:**
1. Vérifier les migrations appliquées
2. Vérifier les permissions (role Management)
3. Consulter les logs Supabase
4. Vider le cache navigateur

---

## ✅ Checklist Démarrage

- [ ] Migrations appliquées (3 tables créées)
- [ ] Fonctions PostgreSQL créées (6 fonctions)
- [ ] Application rebuild (`npm run build`)
- [ ] Cache navigateur vidé (Ctrl+Shift+R)
- [ ] Connexion avec compte Management
- [ ] Menu "Budget & Forecasts" visible
- [ ] Budget 2025 créé
- [ ] Breakdown journalier généré (365 enregistrements)
- [ ] Interface responsive testée

---

**🎉 Vous êtes prêt à utiliser le module Budget & Forecasts!**

Pour toute question, consulter la documentation complète ou les exemples SQL dans le fichier de migration.
