# 📸 Démonstration Visuelle - Système d'Invoices

## 🎯 Ce Que Vous Allez Voir

Ce document montre visuellement comment utiliser le nouveau système d'invoices professionnelles.

---

## 1️⃣ Accéder à la Page Payment Details

### URL
```
/payments/{payment_id}
```

### Vue de la Page
```
┌────────────────────────────────────────────────────────┐
│ ← Back    Payment Details                 [Export PDF]│
│           INV-2025-001                         [PAID]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ Payment Info    │  │ Customer Information     │   │
│  │ Amount: $50,000 │  │ Name: Auramet Trading   │   │
│  │ Currency: USD   │  │ Email: trading@...       │   │
│  │ Date: Jan 15    │  │ Country: United States  │   │
│  └─────────────────┘  └──────────────────────────┘   │
│                                                        │
├────────────────────────────────────────────────────────┤
│  [Timeline]  [Gold Sold]  [Documents]  [History]      │
└────────────────────────────────────────────────────────┘
```

---

## 2️⃣ Cliquer sur l'Onglet "Documents"

### État Initial (Aucun Document)
```
┌────────────────────────────────────────────────────────┐
│  Payment Documents              [Upload Document]       │
├────────────────────────────────────────────────────────┤
│                                                        │
│                     📄                                 │
│              No documents available                    │
│                                                        │
│             [Generate Invoice] ← CLIQUEZ ICI          │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 3️⃣ Génération de l'Invoice

### État: En Cours de Génération
```
┌────────────────────────────────────────────────────────┐
│  Payment Documents              [Upload Document]       │
├────────────────────────────────────────────────────────┤
│                                                        │
│                     ⚙️                                 │
│           Generating professional                      │
│                invoice...                              │
│         This may take a few moments                    │
│                                                        │
│           [Animation de Spinner]                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Durée:** 3-5 secondes

---

## 4️⃣ Invoice Générée - Liste des Documents

### Vue avec Documents
```
┌────────────────────────────────────────────────────────┐
│  Payment Documents              [Upload Document]       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📄  INV-SALE-001-2025.pdf                        │ │
│  │     invoice • Jan 15, 2025 10:30 AM              │ │
│  │     Double-click to view   [👁 View PDF] [↓]     │ │
│  └──────────────────────────────────────────────────┘ │
│  ← Double-cliquez ici pour ouvrir le PDF             │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 📄  Payment_Proof.pdf                     ✓      │ │
│  │     payment_proof • Jan 15, 2025 11:00 AM        │ │
│  │     Double-click to view   [👁 View PDF] [↓]     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Actions Disponibles:
- **Double-clic** sur la ligne → Ouvre le PDF Viewer
- **Bouton "View PDF"** → Ouvre le PDF Viewer
- **Bouton "↓"** → Télécharge le PDF directement

---

## 5️⃣ PDF Viewer - Plein Écran

### Interface du Viewer
```
┌──────────────────────────────────────────────────────────┐
│ INV-SALE-001-2025.pdf                                    │
│ PDF Document                                             │
│                                                          │
│  [-] 100% [+]   [↻]   [↓]   [✕]                        │
│  ↑    ↑    ↑     ↑     ↑     ↑                          │
│ Zoom Zoom Zoom  Rotate Down Close                       │
│ Out  %    In                                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ╔═════════════════════════════════════════════════╗   │
│  ║                                                 ║   │
│  ║   INVOICE                    Mansa Resources   ║   │
│  ║   INV-SALE-001-2025         Conakry, Guinea    ║   │
│  ║                                                 ║   │
│  ║   BILL TO                 INVOICE DETAILS       ║   │
│  ║   Auramet Trading LLC     Date: Jan 15, 2025   ║   │
│  ║   New York, USA           Due: Feb 14, 2025    ║   │
│  ║   trading@auramet.com     Sale: SALE-001       ║   │
│  ║                                                 ║   │
│  ║   LINE ITEMS                                    ║   │
│  ║   ┌─────────────────────────────────────────┐  ║   │
│  ║   │ Desc  │ Batch│Qty │%│Weight│Price│Total│  ║   │
│  ║   │ Gold  │ B-001│10oz│99│10oz │$1850│18500│  ║   │
│  ║   │ Gold  │ B-002│5oz │99│ 5oz │$1850│ 9250│  ║   │
│  ║   └─────────────────────────────────────────┘  ║   │
│  ║                                                 ║   │
│  ║                        Subtotal:     $27,750   ║   │
│  ║                        Freight:         $500   ║   │
│  ║                        Royalty (3%):    $832   ║   │
│  ║                        ════════════════════════║   │
│  ║                        TOTAL:        $29,082   ║   │
│  ║                                                 ║   │
│  ║   PAYMENT TERMS                                 ║   │
│  ║   Payment due within 30 days...                ║   │
│  ║                                                 ║   │
│  ║   BANK DETAILS                                  ║   │
│  ║   Bank: International Bank of Commerce         ║   │
│  ║   Account: ****1234                            ║   │
│  ║   SWIFT: IBCGNGNA                              ║   │
│  ║                                                 ║   │
│  ╚═════════════════════════════════════════════════╝   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ Double-click outside to close • Use toolbar controls    │
└──────────────────────────────────────────────────────────┘
     ↑ Cliquez ici pour fermer
```

---

## 6️⃣ Contrôles du PDF Viewer

### Zoom Out (-)
```
Before: 100%                    After: 75%
┌─────────────┐               ┌──────────┐
│             │               │          │
│   INVOICE   │    [Click]    │ INVOICE  │
│   Content   │    ------>    │ Content  │
│             │               │          │
└─────────────┘               └──────────┘
      ^                             ^
   Normal                      Plus petit
```

### Zoom In (+)
```
Before: 100%                    After: 125%
┌─────────────┐               ┌──────────────────┐
│             │               │                  │
│   INVOICE   │    [Click]    │    INVOICE       │
│   Content   │    ------>    │    Content       │
│             │               │                  │
└─────────────┘               └──────────────────┘
      ^                             ^
   Normal                      Plus grand
```

### Rotate (↻)
```
Before                          After
┌─────────────┐               ┌──────┐
│   INVOICE   │               │      │
│   Content   │    [Click]    │ I C  │
│   Here      │    ------>    │ N O  │
│             │               │ V N  │
└─────────────┘               │ O T  │
                              │ I E  │
    Portrait                  │ C N  │
                              │ E T  │
                              └──────┘
                               Paysage (90°)
```

### Download (↓)
```
┌─────────────┐
│   [Click]   │
│      ↓      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Téléchargement en cours │
│ INV-SALE-001-2025.pdf   │
│ ████████░░░░ 80%        │
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Téléchargement terminé! │
│ Fichier dans Downloads/ │
└─────────────────────────┘
```

---

## 7️⃣ Fermer le Viewer

### Méthode 1: Bouton X
```
┌──────────────────────────────────┐
│  Invoice.pdf          [✕] ← Cliquez ici
└──────────────────────────────────┘
         ↓
   Viewer se ferme
         ↓
  Retour à Documents tab
```

### Méthode 2: Clic Extérieur
```
   ┌────────────────┐
   │   PDF Viewer   │
   │   [Document]   │
   │                │
   └────────────────┘
← Cliquez ici (zone sombre)
         ↓
   Viewer se ferme
```

### Méthode 3: Double-Clic Extérieur
```
   ┌────────────────┐
   │   PDF Viewer   │
   │   [Document]   │
   │                │
   └────────────────┘
← Double-cliquez ici
         ↓
   Viewer se ferme
```

---

## 8️⃣ Design de l'Invoice (Aperçu)

### En-tête Professionnel
```
╔═══════════════════════════════════════════════════════╗
║ [FOND OR PROFOND #B8860B]                            ║
║                                                       ║
║  INVOICE                          Mansa Resources    ║
║  INV-SALE-001-2025               Conakry, Guinea     ║
║                                  Tel: +224 123...    ║
║                                  info@mansa...       ║
╚═══════════════════════════════════════════════════════╝
```

### Section Client et Détails
```
┌─────────────────────────┐  ┌─────────────────────────┐
│ [FOND GRIS CLAIR]       │  │ [FOND GRIS CLAIR]       │
│ BILL TO                 │  │ INVOICE DETAILS         │
│ Auramet Trading LLC     │  │ Invoice Date: Jan 15    │
│ trading@auramet.com     │  │ Due Date: Feb 14        │
│ +1 555 0100             │  │ Sale Number: SALE-001   │
│ New York, USA           │  │ Sale Date: Jan 15       │
└─────────────────────────┘  └─────────────────────────┘
```

### Tableau des Items
```
╔═══════════════════════════════════════════════════════╗
║ LINE ITEMS                                            ║
╠═══════════════════════════════════════════════════════╣
║ Description│Batch│Quantity│Fine%│Weight│Price│Total  ║
╠═══════════════════════════════════════════════════════╣
║ Gold-Fine  │B-001│ 10.000oz│99.9%│10.00oz│$1850│$18500║
║ Gold-Fine  │B-002│  5.000oz│99.9%│ 5.00oz│$1850│ $9250║
╚═══════════════════════════════════════════════════════╝
```

### Section Totaux
```
                                    Subtotal:    $27,750
                                    Freight:        $500
                                    Royalty (3%):   $832
                                    ═══════════════════
╔═══════════════════════════════╗
║ [FOND OR] TOTAL AMOUNT: $29,082 ║
╚═══════════════════════════════╝
```

### Coordonnées Bancaires
```
┌─────────────────────────────────────────────────────┐
│ BANK DETAILS                                        │
│ Bank Name: International Bank of Commerce          │
│ Account Number: ****1234                           │
│ SWIFT Code: IBCGNGNA                               │
│ IBAN: GN89 1234 5678 9012 3456 7890               │
└─────────────────────────────────────────────────────┘
```

### Footer Légal
```
────────────────────────────────────────────────────────
This is a computer-generated invoice and does not
require a signature.
Generated on January 15, 2025
Tax ID: GN-TAX-123456789
────────────────────────────────────────────────────────
```

---

## 9️⃣ Palette de Couleurs Utilisée

```
┌──────────────┬─────────────┬──────────────────────┐
│ Couleur      │ Hex Code    │ Utilisation          │
├──────────────┼─────────────┼──────────────────────┤
│ Deep Gold    │ #B8860B     │ • En-tête principal  │
│              │             │ • Total amount       │
│              │             │ • Titres sections    │
├──────────────┼─────────────┼──────────────────────┤
│ Slate Blue   │ #475569     │ • Texte secondaire   │
│              │             │ • Bordures           │
├──────────────┼─────────────┼──────────────────────┤
│ Light Gray   │ #F5F5F5     │ • Fonds sections     │
│              │             │ • Lignes alternées   │
├──────────────┼─────────────┼──────────────────────┤
│ White        │ #FFFFFF     │ • Fond principal     │
│              │             │ • Texte sur or       │
├──────────────┼─────────────┼──────────────────────┤
│ Dark Gray    │ #333333     │ • Texte principal    │
├──────────────┼─────────────┼──────────────────────┤
│ Medium Gray  │ #969696     │ • Footer             │
│              │             │ • Mentions légales   │
└──────────────┴─────────────┴──────────────────────┘
```

---

## 🔟 Exemple Complet - De A à Z

### Étape par Étape

```
STEP 1: Accéder aux Paiements
/payments → Liste des paiements
              ↓
STEP 2: Cliquer sur un Paiement
Click → /payments/{id}
              ↓
STEP 3: Onglet Documents
Click "Documents" tab
              ↓
STEP 4: Voir État Initial
[Generate Invoice] button visible
              ↓
STEP 5: Générer Invoice
Click "Generate Invoice"
              ↓
STEP 6: Attendre (3-5 sec)
⚙️ Generating professional invoice...
              ↓
STEP 7: Invoice Créée
✅ Invoice appears in list
✅ PDF Viewer opens automatically
              ↓
STEP 8: Interagir avec PDF
• Zoom in/out
• Rotate
• Scroll
• Review content
              ↓
STEP 9: Télécharger (optionnel)
Click download button → PDF saved
              ↓
STEP 10: Fermer Viewer
Click X or outside → Back to documents
              ↓
STEP 11: Consulter Plus Tard
Double-click invoice → Opens viewer
```

---

## 1️⃣1️⃣ Cas d'Usage Réels

### Cas 1: Envoyer Invoice au Client

```
1. Générer l'invoice
2. Télécharger le PDF
3. Ouvrir email client
4. Attacher INV-XXX.pdf
5. Envoyer au customer
```

### Cas 2: Vérifier les Détails

```
1. Ouvrir payment details
2. Double-clic sur invoice
3. Zoomer pour voir détails
4. Vérifier montants
5. Fermer viewer
```

### Cas 3: Archiver pour Comptabilité

```
1. Accéder à tous les payments
2. Pour chaque payment:
   - Ouvrir documents
   - Télécharger invoice
3. Organiser dans dossiers
4. Conserver pour audit
```

---

## 📊 Performance et Timing

```
┌────────────────────────┬──────────────┐
│ Action                 │ Temps        │
├────────────────────────┼──────────────┤
│ Générer Invoice        │ 3-5 secondes │
│ Upload Supabase        │ < 1 seconde  │
│ Ouvrir PDF Viewer      │ Instantané   │
│ Zoom/Rotation          │ Temps réel   │
│ Téléchargement         │ 1-2 secondes │
│ Charger PDF dans iframe│ 1-3 secondes │
└────────────────────────┴──────────────┘
```

---

## ✅ Checklist Utilisateur

### Avant d'Utiliser
- [ ] Connexion à l'application OK
- [ ] Paiement existe avec sale_id
- [ ] Accès à /payments/{id}

### Pendant l'Utilisation
- [ ] Bouton "Generate Invoice" visible
- [ ] Clic fonctionne
- [ ] Spinner s'affiche
- [ ] Invoice générée en 3-5 sec
- [ ] PDF viewer s'ouvre automatiquement

### Vérifications
- [ ] Nom client correct
- [ ] Montants corrects
- [ ] Dates correctes
- [ ] Line items présents
- [ ] Coordonnées bancaires affichées

### Actions de Suivi
- [ ] Téléchargement fonctionne
- [ ] Zoom in/out opérationnel
- [ ] Rotation fonctionne
- [ ] Fermeture OK
- [ ] Double-clic pour réouvrir OK

---

## 🎓 Guide Rapide pour Formation

### 30 Secondes - Génération
```
1. Aller sur payment → Documents
2. Cliquer "Generate Invoice"
3. Attendre → Invoice créée!
```

### 30 Secondes - Visualisation
```
1. Documents tab
2. Double-cliquer invoice
3. Viewer s'ouvre!
```

### 30 Secondes - Contrôles
```
1. Dans viewer
2. Utiliser +/- pour zoom
3. Cliquer ↻ pour rotation
4. Cliquer ↓ pour download
```

---

## 🎉 Résumé Visuel

```
┌─────────────────────────────────────────────────┐
│           SYSTÈME D'INVOICES COMPLET            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✅ Génération automatique en 1 clic           │
│  ✅ Design professionnel Mansa Resources       │
│  ✅ PDF Viewer intégré avec contrôles          │
│  ✅ Double-clic pour ouverture rapide          │
│  ✅ Zoom, rotation, téléchargement             │
│  ✅ Tous calculs automatiques (royalties)      │
│  ✅ Coordonnées bancaires incluses             │
│  ✅ Multi-pages avec pagination                │
│  ✅ États de chargement clairs                 │
│  ✅ Interface intuitive et professionnelle     │
│                                                 │
│           🚀 PRÊT POUR PRODUCTION 🚀           │
└─────────────────────────────────────────────────┘
```

---

**Date:** 31 Octobre 2025
**Status:** ✅ Complet et Testé
**Build:** ✅ Successful (11.03s)

💎 **Système Professionnel Opérationnel!**
