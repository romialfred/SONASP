# 📝 Guide: Créer des Batches via l'Interface

## 🎯 Situation Actuelle

**Database Status:**
- ✅ Tables existent
- ✅ 3 utilisateurs créés
- ❌ 0 batches
- ❌ 0 mining companies

**Users disponibles:**
1. `romi.alfred@gmail.com` - HANE NGONE (refinery)
2. `r.tiegnan@data-univers.com` - KABORE Moussa (refinery)
3. `romuald.tiegnan@gmail.com` - TIEGNAN Romuald (management)

---

## 🚀 Étape 1: Se Connecter

1. Ouvrir l'application: `http://localhost:5173` (ou votre URL)
2. Se connecter avec: `romuald.tiegnan@gmail.com` (management)
3. Vous arrivez sur le Dashboard

---

## 🏢 Étape 2: Créer une Mining Company (REQUIS)

**Sans mining company, vous ne pourrez pas créer de batch!**

1. Dans le menu latéral, cliquer sur **"Stakeholders"**
2. Cliquer sur **"Mining Companies"**
3. Cliquer bouton **"Add Mining Company"** ou **"+ New"**
4. Remplir le formulaire:
   ```
   Name: Société Minière Test
   Country: Guinea
   Status: Active
   Contact Email: contact@mining-test.com
   Contact Phone: +224 XXX XXX XXX
   ```
5. Cliquer **"Save"**

**Répéter pour créer 2-3 mining companies.**

---

## 📦 Étape 3: Créer des Batches

### Option A: Via Menu Batches

1. Menu latéral → **"Batch Management"** → **"Batches"**
2. Cliquer **"New Batch"** ou **"Create Batch"**
3. Remplir le formulaire:
   ```
   Shipping Date: [Aujourd'hui]
   Weight (grams): 5000
   Metal Type: Gold
   Mining Company: [Sélectionner celle créée]
   Comments: Batch test 1
   ```
4. Cliquer **"Create"** ou **"Save"**
5. Le batch est créé avec statut: `draft` ou `pending`

### Option B: Via Dashboard Quick Action

1. Sur le Dashboard, chercher **"Quick Actions"**
2. Cliquer **"Create Batch"**
3. Remplir le formulaire (même que Option A)

---

## 🔄 Étape 4: Changer Statut vers Refinery

Les batches nouvellement créés ont généralement le statut `draft` ou `shipped`. Pour qu'ils apparaissent sur la page Refining, il faut les faire progresser:

### Workflow Normal:

```
draft
  ↓ [Ship]
shipped
  ↓ [Airport Confirm]
received_at_airport
  ↓ [Validate Airport]
validated_at_airport
  ↓ [Validate for Refinery]
validated_for_refinery ← COMMENCE ICI POUR REFINERY
  ↓
waiting_refinery_receipt
  ↓
received_at_refinery
  ↓
validated_for_processing
  ↓
processing
  ↓
processed
```

### Comment Progresser un Batch:

1. Aller sur **Batches** → Cliquer sur un batch
2. Sur la page détails du batch, il y a des boutons d'action
3. Cliquer sur le bouton approprié selon le statut actuel:
   - Si `draft`: Cliquer **"Ship"**
   - Si `shipped`: Cliquer **"Confirm Receipt at Airport"**
   - Si `received_at_airport`: Cliquer **"Validate"**
   - Etc.

---

## 🏭 Étape 5: Vérifier Page Refining

Une fois que vous avez des batches avec statuts:
- `validated_for_refinery`
- `waiting_refinery_receipt`
- `received_at_refinery`
- `validated_for_processing`
- `processing`
- `processed`

**La page `/refining` les affichera automatiquement!**

1. Menu latéral → **"Batch Management"** → **"Refining"**
2. Vous devriez voir:
   - Metrics cards mis à jour
   - Sections de batches avec boutons d'action
   - Aucune erreur console

---

## ⚡ Raccourci: Changer Statut via SQL (Temporaire pour Test)

Si vous voulez tester rapidement **SANS** passer par tout le workflow:

### Option 1: Via Supabase Dashboard

1. Ouvrir **Supabase Dashboard**
2. Aller dans **SQL Editor**
3. Exécuter:
   ```sql
   -- Créer une mining company d'abord
   INSERT INTO mining_companies (name, country, status)
   VALUES ('Test Mining Co', 'Guinea', 'active');
   
   -- Puis créer des batches directement avec statuts refinery
   INSERT INTO batches (
     batch_number,
     status,
     weight_grams,
     weight_ounces,
     metal_type,
     shipping_date
   ) VALUES 
   ('BATCH-001', 'validated_for_refinery', 5000, 160.75, 'gold', CURRENT_DATE),
   ('BATCH-002', 'waiting_refinery_receipt', 7500, 241.13, 'gold', CURRENT_DATE),
   ('BATCH-003', 'received_at_refinery', 6200, 199.38, 'gold', CURRENT_DATE);
   ```

4. Rafraîchir la page `/refining` dans l'application

---

## 🎯 Résumé des Actions Minimum

**Pour voir des batches sur la page Refining:**

1. ✅ Se connecter (management user)
2. ✅ Créer 1+ mining company
3. ✅ Créer 3+ batches
4. ✅ Faire progresser les batches vers statuts refinery
5. ✅ Aller sur `/refining`

**OU**

1. ✅ Exécuter le script SQL dans Supabase Dashboard
2. ✅ Rafraîchir `/refining`

---

## 🐛 Troubleshooting

### Erreur: "Mining company required"

**Solution:** Créer une mining company d'abord (Étape 2)

### Erreur: "Permission denied"

**Solution:** Se connecter avec un user management ou admin

### Batches créés mais pas visibles sur /refining

**Cause:** Statut incorrect

**Solution:** Vérifier le statut du batch:
```sql
SELECT batch_number, status FROM batches;
```

Les statuts pour Refining page:
- `validated_for_refinery`
- `waiting_refinery_receipt`
- `received_at_refinery`
- `validated_for_processing`
- `processing`
- `processed`

### Page /refining vide avec batches existants

**Vérifier:**
1. Console browser (F12) pour erreurs
2. Statut des batches dans la DB
3. Que le build a été refait après les corrections:
   ```bash
   npm run build
   ```

---

## 📊 Vérification Database

### Voir tous les batches:

```sql
SELECT 
  batch_number,
  status,
  weight_grams,
  metal_type,
  shipping_date
FROM batches
ORDER BY created_at DESC;
```

### Compter batches par statut:

```sql
SELECT 
  status,
  COUNT(*) as count
FROM batches
GROUP BY status;
```

### Voir mining companies:

```sql
SELECT name, country, status FROM mining_companies;
```

---

## ✅ Checklist Complète

- [ ] Se connecter à l'application
- [ ] Créer au moins 1 mining company
- [ ] Créer au moins 3 batches
- [ ] Faire progresser batches vers statuts refinery
- [ ] Vérifier que les batches apparaissent sur `/refining`
- [ ] Tester les actions (Receive, Validate, Process)
- [ ] Vérifier le graphique mensuel (si page vide)

---

**Une fois les batches créés via l'interface, la page Refinery les affichera automatiquement!** 🏭✨
