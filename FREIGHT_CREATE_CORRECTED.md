# CORRECTION FREIGHT & CUSTOMS - Workflow Correct

## Workflow Métier:

1. **Shipping Preparation** (table: shipping_preparations)
   - Contient des productions regroupées
   - Statut: `ready_for_expedition`

2. **Freight & Customs** charge les shipping_preparations avec statut `ready_for_expedition`

3. **Création de l'expédition freight** avec:
   - Sélection de shipping_preparations (pas productions individuelles)
   - Informations douanières
   - Génération PDFs

## Changements nécessaires:

- ✅ Service: `getAvailableShippingPreparations()` au lieu de `getAvailableProductions()`
- ✅ Interface: `AvailableShippingPreparation` avec items
- ⏳ Page Create: Afficher shipping_preparations avec leurs items

## Test actuel:
- 0 shipping_preparations dans la base
- Il faut d'abord créer des shipping_preparations avec statut ready_for_expedition
