# ÉTAPES EXACTES BASÉES SUR VOTRE SCREENSHOT

## ✅ CE QUE JE VOIS

Dans votre sidebar gauche, je vois:

```
ALL BUCKETS
  documents
  reports
  payment-proofs
  assay-certificates

CONFIGURATION
  Policies    ← JE LA VOIS! ✅
  Settings
```

---

## 🎯 ÉTAPES À SUIVRE (SIMPLE!)

### Étape 1: Cliquer sur "Policies"

Dans la sidebar gauche, sous "CONFIGURATION", **cliquez sur "Policies"**

---

### Étape 2: Sélectionner le Bucket

Une fois dans Policies:

1. Vous verrez probablement une liste vide ou des policies existantes
2. En haut, cherchez un **dropdown/selector** pour choisir le bucket
3. Sélectionnez **"assay-certificates"** dans ce dropdown
4. OU la page sera déjà filtrée pour "assay-certificates"

---

### Étape 3: Créer la Nouvelle Policy

1. Cliquez le bouton **"New Policy"** ou **"+ Create Policy"**

2. Vous verrez 2 options:
   - "Get started quickly" (templates)
   - "For full customization" ← **CHOISISSEZ CELLE-CI**

3. Un formulaire apparaîtra

---

### Étape 4: Remplir le Formulaire

Remplissez EXACTEMENT comme suit:

```
┌─────────────────────────────────────────────────────────┐
│ Policy Name:                                            │
│ Allow authenticated users all operations                │
├─────────────────────────────────────────────────────────┤
│ Policy Command: (dropdown)                              │
│ SELECT "ALL"                                            │
├─────────────────────────────────────────────────────────┤
│ Target Roles: (dropdown)                                │
│ SELECT "authenticated"                                  │
├─────────────────────────────────────────────────────────┤
│ USING expression (check):                               │
│ bucket_id = 'assay-certificates'                        │
├─────────────────────────────────────────────────────────┤
│ WITH CHECK expression (optional):                       │
│ bucket_id = 'assay-certificates'                        │
└─────────────────────────────────────────────────────────┘
```

**IMPORTANT**: 
- Les expressions USING et WITH CHECK doivent utiliser des **single quotes** `'`
- Pas de double quotes `"`
- Exactement: `bucket_id = 'assay-certificates'`

---

### Étape 5: Sauvegarder

1. En bas du formulaire, cliquez **"Review"** ou **"Save Policy"**
2. Si demandé de confirmer, cliquez **"Confirm"** ou **"Save"**
3. Vous devriez voir un message de succès ✅

---

## ✅ VÉRIFICATION

Après sauvegarde:

1. Vous devriez voir votre nouvelle policy dans la liste
2. Elle devrait s'appeler: "Allow authenticated users all operations"
3. Status: Active/Enabled

---

## 🧪 TEST FINAL

1. **Retournez à votre app Gold Shipper**
2. **Refresh** la page (F5)
3. **Login** si nécessaire
4. **Allez à Batches** → Sélectionnez n'importe quel batch
5. **Scrollez** jusqu'à la section "Assay Certificates"
6. **Essayez d'uploader** un PDF
7. **ÇA DEVRAIT MARCHER!** ✅

---

## 🆘 SI ÇA NE MARCHE PAS

Si après avoir créé la policy, l'upload ne marche toujours pas:

1. Vérifiez dans la console du navigateur (F12) → Console tab
2. Cherchez des erreurs rouges
3. Copiez l'erreur et envoyez-la moi
4. Je vous aiderai à debugger!

---

## 📸 PROCHAINE ÉTAPE

Une fois que vous cliquez sur "Policies" dans la sidebar:

**Prenez un screenshot** de ce que vous voyez, et je vous guiderai 
pour la suite si nécessaire!

---

## 🎯 RÉSUMÉ EN 5 SECONDES

1. Cliquez **"Policies"** (sidebar gauche, sous CONFIGURATION)
2. Cliquez **"New Policy"**
3. Choisissez **"For full customization"**
4. Remplissez le formulaire (voir ci-dessus)
5. Cliquez **"Save Policy"**
6. ✅ DONE!

