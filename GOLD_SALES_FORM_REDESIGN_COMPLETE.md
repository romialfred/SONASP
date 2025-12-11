# Refonte Complète du Formulaire de Vente d'Or

## Date
2025-12-11

## Résumé

Le formulaire de création de vente d'or a été complètement redesigné pour offrir une interface plus raffinée et mieux organisée. Il est maintenant intégré avec le module Gold Sales Settings pour garantir que seuls les clients autorisés peuvent être sélectionnés.

## Changements Majeurs

### 1. Intégration avec Gold Sales Settings

Le formulaire utilise maintenant le module Gold Sales Settings pour:
- Charger uniquement les clients autorisés pour une mine spécifique
- Afficher les paramètres de vente (pourcentage max du stock, méthode de vente, etc.)
- Valider les autorisations de vente avant la création

**Fonction utilisée:**
```typescript
getAuthorizedCustomersForMine(miningCompanyId: string)
```

Cette fonction récupère les clients autorisés depuis la table `gold_sales_settings` via une RPC function Supabase.

### 2. Nouvelle Structure du Formulaire

Le formulaire est maintenant organisé en 3 sections principales:

#### A. Informations du Mécanisme de Pricing (en haut)
Si l'utilisateur vient de Gold Trade Space:
- Badge du mécanisme sélectionné (Spot Basis, Forward 14 Days, etc.)
- Prix par once avec ajustement de marché
- Quantité simulée
- Valeur estimée
- Date de valeur et jours de règlement

**Design:** Card avec fond gradient emerald-to-teal, bordure emerald-500

#### B. Section Vendeur & Client (au milieu)
- **Vendeur (Mining Company):**
  - Sélection de la société minière
  - Affichage automatique de l'inventaire disponible
  - Auto-sélection si une seule mine existe
  - Non modifiable après sélection (désactivé)

- **Client (Authorized Buyer):**
  - Liste des clients autorisés uniquement (basée sur Gold Sales Settings)
  - Affichage des paramètres: Max Stock %, méthode de vente, frais
  - Badge visuel pour identifier les paramètres

- **Détails de la vente:**
  - Quantité à vendre (avec conversion g/oz)
  - Prix de vente (verrouillé si venant de Gold Trade Space)
  - Frais de transport (optionnel)
  - Autres frais (optionnel)

**Design:** Card avec sections bien définies, badges colorés pour les informations importantes

#### C. Tableau de Facturation (en bas)
Format de tableau professionnel avec:
- En-tête bleu/indigo avec titre "Sale Invoice" et date
- Colonnes: Description | Amount (USD)
- Lignes avec hover effect
- Calculs progressifs:
  - Quantité (oz et g)
  - Prix par once
  - **Gross Proceeds** (fond vert)
  - Freight Cost (en rouge si > 0)
  - Other Costs (en rouge si > 0)
  - **Net Proceeds** (fond bleu)
  - Net Smelted Royalties (3%)
  - **Final Proceeds** (fond gradient indigo-purple, grand texte)

**Design:** Tableau avec alternance de couleurs, typography claire, design de facture professionnelle

### 3. Corrections d'Erreurs

#### Erreur de Chargement des Clients - CORRIGÉE

**Avant:**
```typescript
// Chargeait TOUS les clients de la table customers
const { data: customersData, error } = await supabase
  .from('customers')
  .select('*')
  .order('name');
```

**Après:**
```typescript
// Charge uniquement les clients AUTORISÉS pour la mine sélectionnée
const result = await getAuthorizedCustomersForMine(formData.miningCompanyId);
```

Cette correction garantit que:
- Seuls les clients configurés dans Gold Sales Settings sont affichés
- Pas d'erreur si aucun client n'est configuré
- Validation automatique des autorisations de vente

### 4. Flux de Navigation depuis Gold Trade Space

Le flux fonctionne maintenant correctement:

1. **Gold Trade Space** → L'utilisateur simule un pricing avec une quantité
2. **Clic sur "Continue with [Mechanism]"** → Navigation vers `/sales/new` avec:
   ```javascript
   state: {
     mechanismData: {
       mechanism,
       displayName,
       pricePerOz,
       adjustmentPercentage,
       valueDate,
       settlementDays,
       description
     },
     quantityOz: quantity,
     availableStockOz: available
   }
   ```
3. **Formulaire de Vente** → Le formulaire:
   - Pré-remplit le prix depuis le mécanisme
   - Pré-remplit la quantité
   - Verrouille le prix (non modifiable)
   - Affiche le mécanisme en haut dans une card distinctive

### 5. Logique de Sélection

#### Vendeur (Mining Company)
- Charge toutes les mines actives
- Si une seule mine existe → Auto-sélection et champ désactivé
- Affiche: Nom (Abréviation) - Pays
- Affiche l'inventaire disponible après sélection

#### Client (Authorized Buyer)
- **Désactivé** tant qu'aucun vendeur n'est sélectionné
- Charge uniquement les clients autorisés pour le vendeur sélectionné
- Affiche les paramètres de vente définis dans Gold Sales Settings:
  - Max Stock %
  - Sale Method
  - Refining fees paid by customer (Oui/Non)
  - Transport fees paid by customer (Oui/Non)

#### Validation des Autorisations
Avant d'afficher le calcul:
```typescript
const result = await checkSaleAuthorization(
  miningCompanyId,
  customerId,
  quantity,
  availableInventory
);

if (!result.data?.is_authorized) {
  alert.error(result.data?.reason);
  return;
}
```

## Design & UX

### Palette de Couleurs

| Section | Couleur | Usage |
|---------|---------|-------|
| Pricing Mechanism | Emerald (vert) | Mise en évidence du mécanisme sélectionné |
| Seller Info | Blue (bleu) | Informations de la société minière |
| Customer Info | Purple-Pink | Informations du client |
| Invoice Gross | Green | Revenus bruts positifs |
| Invoice Net | Blue | Revenus nets |
| Invoice Final | Indigo-Purple gradient | Montant final (le plus important) |
| Costs | Red | Coûts et déductions |

### Typography & Spacing
- **Titres:** font-bold, text-xl to text-3xl
- **Sous-titres:** text-sm, text-gray-600
- **Valeurs importantes:** text-2xl to text-3xl, font-bold
- **Espacement:** space-y-6 entre sections, gap-4 dans les grilles

### Responsive Design
- **Desktop (>1024px):** Layout complet avec toutes les sections visibles
- **Tablet (768-1024px):** Grid adapté, 2 colonnes pour les champs
- **Mobile (<768px):** Layout en colonne unique

## Exemple de Flux Complet

### Scénario: Vente depuis Gold Trade Space

1. **Utilisateur va dans Gold Trade Space**
   - Entre une quantité: 400 oz
   - Clique sur "Simulate"
   - Voit 4 options: Spot Basis, Forward 14 Days, Forward 30 Days, In-Process

2. **Utilisateur clique "Continue with Spot Basis"**
   - Navigation vers `/sales/new`
   - Prix: $4006.83/oz (verrouillé)
   - Quantité: 400 oz (pré-remplie)

3. **Formulaire de Vente s'affiche**
   - En haut: Card verte avec "Spot Basis" et tous les détails
   - Section vendeur: Auto-sélectionne "Yanfolila" si c'est la seule mine
   - Inventaire disponible: 1244.23 oz affiché

4. **Utilisateur sélectionne le client**
   - Liste déroulante: Auramet, StoneX (clients autorisés uniquement)
   - Sélectionne "Auramet"
   - Card violette s'affiche avec paramètres:
     - Max Stock: 100%
     - Sale Method: standard
     - Refining fees: Customer
     - Transport fees: Customer

5. **Utilisateur remplit les coûts (optionnel)**
   - Freight Cost: $500
   - Other Costs: $100

6. **Utilisateur clique "Calculate Invoice"**
   - Validation des autorisations
   - Tableau de facturation s'affiche:
     - Quantity: 400.000 oz (12,441.40 g)
     - Price per oz: $4,006.83
     - **Gross Proceeds: $1,602,732.00**
     - Freight Cost: -$500.00
     - Other Costs: -$100.00
     - **Net Proceeds: $1,602,132.00**
     - Royalties (3%): -$48,063.96
     - **Final Proceeds: $1,554,068.04**

7. **Utilisateur clique "Create Sale"**
   - Vente créée avec numéro: SL-2025-001
   - Redirection vers `/sales`
   - Message de succès

## Fichiers Modifiés

1. **src/pages/sales/SaleCreate.tsx** (complètement redesigné)
   - 745 lignes
   - Nouvelle structure avec 3 sections
   - Intégration Gold Sales Settings
   - Tableau de facturation professionnel

## Fonctions Supabase Requises

Le formulaire dépend de 2 fonctions RPC Supabase:

### 1. get_authorized_customers_for_mine
```sql
CREATE OR REPLACE FUNCTION get_authorized_customers_for_mine(p_mining_company_id UUID)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  max_stock_percentage INTEGER,
  sale_method TEXT,
  refining_fees_paid_by_customer BOOLEAN,
  transport_fees_paid_by_customer BOOLEAN
)
```

### 2. check_sale_authorization
```sql
CREATE OR REPLACE FUNCTION check_sale_authorization(
  p_mining_company_id UUID,
  p_customer_id UUID,
  p_quantity_oz DECIMAL,
  p_available_stock_oz DECIMAL
)
RETURNS TABLE (
  is_authorized BOOLEAN,
  reason TEXT,
  max_allowed_oz DECIMAL,
  settings JSONB
)
```

**Note:** Ces fonctions doivent exister dans la base de données pour que le formulaire fonctionne correctement.

## Avantages du Nouveau Design

### 1. Sécurité Renforcée
- Seuls les clients autorisés sont chargés
- Validation automatique avant création de vente
- Respect des règles métier définies dans Gold Sales Settings

### 2. Meilleure UX
- Interface claire et organisée en 3 sections logiques
- Informations de pricing en évidence en haut
- Tableau de facturation professionnel et lisible
- Pas de confusion sur qui peut vendre à qui

### 3. Intégration Seamless avec Gold Trade Space
- Flux naturel: Simulation → Vente
- Données pré-remplies automatiquement
- Prix verrouillé pour garantir l'intégrité

### 4. Design Professionnel
- Palette de couleurs cohérente
- Typography bien définie
- Cards avec ombres et bordures subtiles
- Hover effects sur le tableau

## Tests Recommandés

### Scénarios à Tester

1. **Navigation depuis Gold Trade Space**
   - Vérifier que toutes les données sont transmises
   - Vérifier que le prix est verrouillé
   - Vérifier l'affichage du mécanisme

2. **Chargement des Clients Autorisés**
   - Avec Gold Sales Settings configuré
   - Sans Gold Sales Settings (doit afficher "No authorized customers")
   - Avec plusieurs mines

3. **Validation des Autorisations**
   - Quantité dépassant le stock disponible
   - Quantité dépassant le max_stock_percentage
   - Client non autorisé (ne devrait pas apparaître)

4. **Calcul de la Facturation**
   - Sans frais additionnels
   - Avec freight cost
   - Avec other costs
   - Vérifier le calcul des royalties (3%)

5. **Création de Vente**
   - Vérifier l'insertion en base de données
   - Vérifier le numéro de vente généré
   - Vérifier le seller_type = 'mining_company'

## Build Status

✅ Build réussi sans erreur
✅ Compilation TypeScript OK
✅ Aucune erreur de type
✅ Bundle size: 4.32 MB (1.05 MB gzipped)

## Conclusion

Le formulaire de vente est maintenant:
- **Sécurisé:** Intégré avec Gold Sales Settings
- **Professionnel:** Design raffiné avec tableau de facturation
- **Intuitif:** Organisation claire en 3 sections
- **Fonctionnel:** Navigation fluide depuis Gold Trade Space

L'erreur de chargement des clients a été corrigée et le formulaire ne charge plus tous les clients mais uniquement ceux autorisés par Gold Sales Settings.

---

**Status:** ✅ REFONTE COMPLÈTE - BUILD RÉUSSI

**Date:** 2025-12-11
