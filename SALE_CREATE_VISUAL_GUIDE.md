# Guide Visuel des Améliorations de Création de Vente

## Scénario: Créer une vente depuis l'inventaire de KGM

### Étape 1: Page d'inventaire

```
┌────────────────────────────────────────────────────────────────────┐
│ Gold Inventory Management                                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Inventory Details by Mining Company                          │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ Company     │ Entries │ Total │ Available │ ... │ Actions   │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ KGM         │   5     │ 56.00 │   56.00   │ ... │ [Button]  │ │
│ │ Kofi        │         │       │           │     │           │ │
│ │             │         │       │           │     │   ┌───────┴─┐
│ │                                                   │ Continue  │ │
│ │                                                   │ With Spot │ │
│ │                                                   │   Basis   │ │
│ └───────────────────────────────────────────────────┴───────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**Bouton "Continue With Spot Basis":**
- Petit, compact
- Icône ArrowUpRight
- Désactivé si stock = 0
- Texte: "Continue With Spot Basis"

### Étape 2: Navigation vers SaleCreate

**Données passées:**
```javascript
{
  preselectedSellerId: "company-uuid-KGM",
  lockSeller: true,
  availableStockOz: 56.000
}
```

### Étape 3: Formulaire de création de vente avec vendeur verrouillé

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back              Create New Sale                                │
│                     Based on Spot Basis pricing mechanism          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 🏢 Seller & Customer Information                             │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │                                                              │ │
│ │ Seller (Mining Company) * [🔒 Locked]                       │ │
│ │ ┌────────────────────────────────────────────────────────┐  │ │
│ │ │ Kofi Gold Mine (KGM) - Mali                  [disabled] │  │ │
│ │ └────────────────────────────────────────────────────────┘  │ │
│ │ Seller is pre-selected from inventory and cannot be changed │ │
│ │                                                              │ │
│ │ ┌────────────────────────────────────────────────────────┐  │ │
│ │ │ Available Inventory:  56.000 oz  (1741.80 g)          │  │ │
│ │ └────────────────────────────────────────────────────────┘  │ │
│ │                                                              │ │
│ │ Customer (Authorized Buyer) *                                │ │
│ │ ┌────────────────────────────────────────────────────────┐  │ │
│ │ │ [Select customer...]                                    │  │ │
│ │ └────────────────────────────────────────────────────────┘  │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│                                    [Calculate Invoice]             │
└────────────────────────────────────────────────────────────────────┘
```

**Caractéristiques du champ vendeur:**
- Badge "🔒 Locked" en bleu
- Fond bleu clair (bg-blue-50)
- Cursor not-allowed
- Select désactivé
- Hint explicatif en gris

### Étape 4: Après avoir cliqué sur "Calculate Invoice"

```
┌──────────────────────────────┬───────────────────────────────────┐
│                              │ ┌───────────────────────────────┐ │
│ Create New Sale              │ │ 📄 Invoice Preview            │ │
│                              │ │ Live invoice calculation      │ │
│                              │ └───────────────────────────────┘ │
│ [Le contenu du formulaire]   │                                   │
│  se décale vers la gauche    │ ┌─────────────────────────────┐ │
│                              │ │ Draft Invoice                │ │
│ [Seller & Customer Info]     │ │ #DRAFT-123456               │ │
│                              │ │ Date: Dec 13, 2025          │ │
│ [Sale Details & Calculations]│ │ 🟢 SPOT BASIS               │ │
│                              │ └─────────────────────────────┘ │
│                              │                                   │
│                              │ ┌──────────┐ ┌──────────┐       │
│                              │ │ 🏢 SELLER│ │ 👤 CUSTOMER│      │
│                              │ │ KGM      │ │ Client X  │      │
│                              │ │ Mali     │ │ Country Y │      │
│                              │ └──────────┘ └──────────┘       │
│                              │                                   │
│                              │ ┌─────────────────────────────┐ │
│                              │ │ 📦 Product Details          │ │
│                              │ │ Fine Gold: 56.000 oz        │ │
│                              │ │ Price: $4,006.83/oz         │ │
│                              │ └─────────────────────────────┘ │
│                              │                                   │
│                              │ ┌─────────────────────────────┐ │
│                              │ │ 💵 Financial Summary        │ │
│                              │ ├─────────────────────────────┤ │
│                              │ │ Gross Proceeds $224,382.48  │ │
│                              │ │ Less: Freight   -$0.00      │ │
│                              │ │ Net Proceeds    $224,382.48 │ │
│                              │ │ Less: Royalties -$6,731.47  │ │
│                              │ │                             │ │
│                              │ │ ╔═══════════════════════╗   │ │
│                              │ │ ║ TOTAL  $217,651.01    ║   │ │
│                              │ │ ╚═══════════════════════╝   │ │
│                              │ └─────────────────────────────┘ │
│                              │                                   │
│                              │ ⚠️ Note: This is a live preview │
│                              │    Final PDF will include logos │
│                              │                                   │
│                              │ [Scroll for more details...]      │
└──────────────────────────────┴───────────────────────────────────┘
   ↑                              ↑
   Largeur: max-w-5xl            Largeur fixe: 480px
   Marge droite: 500px           Position: fixed right-0
```

## Détails du volet de prévisualisation

### Structure complète du volet

```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │ ← Sticky header
│ │ [Gradient bleu/indigo]              │ │
│ │ 📄 Invoice Preview                  │ │
│ │ Live invoice calculation            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ╔═══════════════════════════════════╗   │
│ ║ Header de facture                 ║   │
│ ║ [Fond gris dégradé]               ║   │
│ ║ DRAFT-123456        Dec 13, 2025  ║   │
│ ║ [Badge vert: SPOT BASIS]          ║   │
│ ╚═══════════════════════════════════╝   │
│                                         │
│ ╔═══════════╗  ╔═══════════╗           │
│ ║ 🏢 SELLER ║  ║ 👤 CUSTOMER║          │
│ ║ [Bordure  ║  ║ [Bordure   ║          │
│ ║  bleue]   ║  ║  violette] ║          │
│ ║ KGM       ║  ║ Client X   ║          │
│ ║ Mali      ║  ║ Country Y  ║          │
│ ╚═══════════╝  ╚═══════════╝           │
│                                         │
│ ╔═══════════════════════════════════╗   │
│ ║ 📦 Product Details [Fond ambre]   ║   │
│ ║ Fine Gold        56.000 oz        ║   │
│ ║                 (1741.80 g)       ║   │
│ ║ Price per oz     $4,006.83        ║   │
│ ╚═══════════════════════════════════╝   │
│                                         │
│ ╔═══════════════════════════════════╗   │
│ ║ 💵 Financial Summary              ║   │
│ ║ ┌─────────────────────────────┐   ║   │
│ ║ │ Gross Proceeds              │   ║   │
│ ║ │ [Fond vert]  $224,382.48    │   ║   │
│ ║ └─────────────────────────────┘   ║   │
│ ║   Less: Freight     -$0.00        ║   │
│ ║   Less: Other       -$0.00        ║   │
│ ║ ┌─────────────────────────────┐   ║   │
│ ║ │ Net Proceeds                │   ║   │
│ ║ │ [Fond bleu]  $224,382.48    │   ║   │
│ ║ └─────────────────────────────┘   ║   │
│ ║   Less: Royalties (3%) -$6,731.47 ║   │
│ ║                                   ║   │
│ ║ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   ║   │
│ ║ ┃ [Gradient indigo/violet]   ┃   ║   │
│ ║ ┃ TOTAL AMOUNT  $217,651.01  ┃   ║   │
│ ║ ┃ [Texte blanc, grande taille]┃   ║   │
│ ║ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   ║   │
│ ╚═══════════════════════════════════╝   │
│                                         │
│ ╔═══════════════════════════════════╗   │
│ ║ 📅 Payment Terms                  ║   │
│ ║ Value Date:      Dec 15, 2025     ║   │
│ ║ Settlement:      2 days           ║   │
│ ╚═══════════════════════════════════╝   │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠️ [Fond jaune avec bordure gauche]│ │
│ │ Note: This is a live preview...    │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Palette de couleurs utilisée

### En-tête du volet
- **Background:** `from-blue-600 to-indigo-600`
- **Text:** Blanc

### Header de facture
- **Background:** `from-gray-50 to-gray-100`
- **Border:** `border-gray-200` (2px)
- **Badge mechanism:** `bg-emerald-100 border-emerald-300 text-emerald-900`

### Cartes Seller/Customer
- **Seller:**
  - Border: `border-blue-200` (2px)
  - Icon background: `bg-blue-100`
  - Icon color: `text-blue-600`
- **Customer:**
  - Border: `border-purple-200` (2px)
  - Icon background: `bg-purple-100`
  - Icon color: `text-purple-600`

### Product Details
- **Background:** `from-amber-50 to-yellow-50`
- **Border:** `border-amber-200` (2px)
- **Text:** `text-amber-900` (bold), `text-amber-700` (details)

### Financial Summary
- **Gross Proceeds:** `from-green-50 to-emerald-50` + `border-green-200`
- **Net Proceeds:** `from-blue-50 to-indigo-50` + `border-blue-200`
- **Deductions:** `text-red-600`
- **Total Amount:** `from-indigo-600 to-purple-600` (white text)

### Payment Terms
- **Background:** `from-slate-50 to-gray-100`
- **Border:** `border-slate-200` (2px)
- **Text:** `text-slate-900`

### Note de bas de page
- **Background:** `bg-yellow-50`
- **Border left:** `border-yellow-400` (4px)
- **Text:** `text-yellow-800`

## Animations et transitions

### Ouverture du volet
```css
transition-all duration-300
```

### Contenu principal
```css
/* Quand volet fermé */
max-w-5xl mx-auto

/* Quand volet ouvert */
max-w-5xl mr-[500px] ml-auto
```

Transition fluide de 300ms pour:
- Marges
- Largeur
- Position

## Responsive behavior

Le volet est fixe à 480px de largeur, mais pourrait être adapté pour mobile:

**Suggestions futures:**
- Sur mobile: Volet en plein écran avec modal
- Sur tablette: Volet réduit à 360px
- Sur grand écran: Option pour élargir le volet

## Accessibilité

- Tous les montants sont clairement identifiés
- Contraste élevé pour le texte
- Icônes descriptives
- Structure hiérarchique claire
- Sections bien délimitées

## Performance

- Chargement conditionnel (seulement si showInvoicePreview est true)
- Pas de re-render inutile
- Données calculées une seule fois
- Mise à jour uniquement si les données changent
