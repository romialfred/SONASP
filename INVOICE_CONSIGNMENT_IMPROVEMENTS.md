# Améliorations du Module Invoice & Consignment

## Changements Effectués

### 1. Palette de Couleurs Sobres

Les couleurs vives ont été remplacées par des tons plus sobres et professionnels:

**Avant:**
- En Attente: Jaune vif (`yellow-100`, `yellow-700`)
- Expédié: Violet vif (`purple-100`, `purple-700`)
- Dégradés colorés: `from-amber-500 to-yellow-500`, `from-green-600 to-emerald-600`

**Après:**
- En Attente: Gris neutre (`gray-100`, `gray-700`)
- Approuvé: Bleu sobre (`blue-50`, `blue-700`)
- Expédié: Gris-bleu sobre (`slate-100`, `slate-700`)
- Reçu: Vert émeraude sobre (`emerald-50`, `emerald-700`)
- Dégradés remplacés: `from-amber-50 to-orange-50` (plus subtils)

### 2. Composants Modifiés

#### `FreightShipmentDashboard.tsx`
- Tuiles de statistiques avec bordures et backgrounds sobres
- Suppression des dégradés agressifs
- Ajout de bordures discrètes pour une meilleure séparation visuelle

#### `FreightStatusBadge.tsx`
- Mise à jour des couleurs de statut pour plus de sobriété
- Utilisation de backgrounds à 50% d'opacité pour un effet plus doux

#### `FreightShipmentDetails.tsx`
- Bouton "Bon pour la Raffinerie" en vert émeraude sobre
- Suppression du dégradé de couleur

#### `GenerateInvoiceModal.tsx`
- Bandeaux d'information en gris-bleu sobre
- Boutons de génération en vert émeraude sobre

### 3. Système de Génération de Documents

Le module dispose déjà d'un système complet de génération de documents PDF:

#### Documents Générés
1. **Invoice (Facture d'Exportation)**
   - Informations expéditeur/destinataire
   - Détails de l'expédition (AWB#, Lot#, boîtes)
   - Poids net (kg et troy oz)
   - Taux de change FCFA/USD
   - Prix du métal et valeur estimée
   - Conversion poids (1 troy oz = 31.1035 g, 1 kg = 32.1507 troy oz)

2. **Bullion Summary**
   - Date du rapport et numéro d'expédition
   - Liste détaillée des barres avec:
     - Numéro de barre
     - Date de coulée et date d'expédition
     - Poids doré (g)
     - Essai d'or SMK (%)
     - Essai d'argent SMK (%)
     - Contenu Au (g et troy oz)
     - Contenu Ag (g et troy oz)
     - Valeur en USD
   - Section signatures

3. **Consignment Note** (À implémenter si nécessaire)

### 4. Workflow de Génération

**État Actuel:**
Le modal `GenerateInvoiceModal` est disponible dans le module Freight/Customs et peut générer:
- Bullion Summary avec signatures
- Export Invoice avec tous les détails

**Utilisation:**
1. L'utilisateur crée une expédition dans "Invoice & Consignment"
2. Quand le statut est `pending`, un bouton "Bon pour la Raffinerie" apparaît
3. En cliquant, l'utilisateur peut ouvrir le modal de génération de documents
4. Le modal permet de renseigner:
   - Numéro de facture (auto-généré)
   - Date d'expédition
   - AWB # (Air Waybill)
   - Nombre et type de boîtes
   - Taux de change FCFA/USD
   - Prix du métal (CFA/kg)
   - Noms des signataires

### 5. Signataires (Déposants)

**Actuel:**
Le modal utilise des champs de saisie libre pour les signatures:
- Gold Room Operator
- SMK Finance

**À Améliorer:**
Les signataires devraient être automatiquement récupérés depuis la table `depositors` liée à la Daily Production qui compose l'expédition.

## Schéma de Couleurs Final

### Statuts
```
En Attente     : bg-gray-100    text-gray-700    border-gray-200
Approuvé       : bg-blue-50     text-blue-700    border-blue-200
Expédié        : bg-slate-100   text-slate-700   border-slate-200
Reçu           : bg-emerald-50  text-emerald-700 border-emerald-200
```

### Tuiles de Statistiques
```
Total          : border-gray-200 (neutre)
En Attente     : border-gray-200 bg-gray-50/50
Approuvé       : border-blue-200 bg-blue-50/50
Expédié        : border-slate-200 bg-slate-50/50
Reçu           : border-emerald-200 bg-emerald-50/50
```

### Valeurs Agrégées
```
Or Pur Total   : border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50
Valeur Totale  : border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50
```

## Module Refining Process

Le module `RefiningProcess.tsx` a été corrigé pour utiliser la table `freight_shipments` (la table `batches` n'existe pas).

**Statuts affichés:**
- `approved` → Tuile "Approuvés"
- `shipped_to_refinery` → Tuile "En Raffinage"
- `received_at_refinery` → Tuile "Raffinés"

## Prochaines Étapes

1. **Intégrer le modal de génération** dans le workflow de validation:
   - Ouvrir automatiquement le modal après l'approbation
   - Obliger la génération des documents avant de marquer comme "expédié"

2. **Récupérer les déposants automatiquement**:
   - Requête sur `depositors` via les `daily_production` liées à l'expédition
   - Pré-remplir les signatures au lieu de saisie manuelle

3. **Ajouter le Consignment Note** si nécessaire (format similaire à l'Invoice)

4. **Tester avec des données réelles**:
   - Créer des Daily Productions
   - Les approuver pour expédition
   - Créer une Freight Shipment
   - Générer les documents PDF

## Notes Techniques

- Build réussi ✓
- Aucune erreur de compilation ✓
- Palette de couleurs cohérente et sobre ✓
- Service de génération PDF déjà implémenté ✓
- Tables utilisées:
  - `freight_shipments`
  - `freight_customs_operations`
  - `daily_production`
  - `depositors`
  - `mining_companies`
  - `refinery_plants`
