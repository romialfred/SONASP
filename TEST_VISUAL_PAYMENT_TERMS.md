# 🧪 Guide de Test Rapide - Approbation Client

## 🎯 Objectif
Tester le workflow complet d'approbation via l'INTERFACE (pas SQL)

## ⚡ Test en 5 Minutes

### 1. Créer Vente (2 min)
```
1. Login comme Management
2. Menu: Sales Management > Sales  
3. Cliquer "Create New Sale"
4. Remplir:
   - Customer: Auramet ou StoneX
   - Quantity: 100 oz
   - Price: 2500 USD/oz
   - Mechanism: Spot
5. Submit
6. Approuver la vente (bouton Approve)
```

### 2. Récupérer Sale ID (30 sec)
```
1. Dans Sales, trouver la vente créée
2. Cliquer dessus pour voir détails
3. Copier l'ID depuis l'URL ou la page
```

### 3. Tester Approbation Client (2 min)
```
1. Ouvrir nouvelle fenêtre/onglet
2. Appuyer F12 (Console)
3. URL: /sales/approve/{SALE_ID}/test-token
4. Page charge → Voir détails vente
5. Cliquer "Approve Sale"
6. Observer console:
   ✅ [customerApproveSale] Success!
   ✅ Message confirmation
```

### 4. Vérifier Résultat (30 sec)
```
1. Retour au Dashboard Management
2. Sales > Chercher la vente
3. Vérifier Status changé:
   ✅ "Waiting for Payment" (idéal)
   ✅ "Customer Approved" (OK aussi)
```

### 5. Vérifier Paiement (30 sec)
```
1. Menu: Payments
2. Chercher paiement VP-XXXX
3. Vérifier:
   ✅ Lié à la vente
   ✅ Amount correct
   ✅ Status: Pending
```

## ✅ Succès Si:
- Aucune erreur 400 dans console
- Status vente a changé
- Paiement créé automatiquement
- Logs [customerApproveSale] Success

## ❌ Problème Si:
- Erreur 400 persiste
- Status reste "Approved"
- Pas de paiement créé

→ Envoyer screenshot console!

## 📝 Notes
- Utiliser /sales/approve/{ID}/test-token pour test
- En production: Token sera dans email client
- Console F12 OBLIGATOIRE pour voir logs
