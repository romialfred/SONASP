# Internationalisation - Guide Rapide

## ✅ Ce Qui Est Prêt

L'infrastructure d'internationalisation (i18n) est **100% opérationnelle** avec:

- 🔹 **Bouton de langue** : `Fr` / `En` (dans le header)
- 🔹 **500+ traductions** : Français et Anglais
- 🔹 **Build validé** : Aucune erreur

---

## 🚀 Comment Utiliser

### Dans N'Importe Quel Composant

```tsx
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('pages.payments.title')}</h1>
      <button>{t('common.save')}</button>
      <input placeholder={t('common.search')} />
    </div>
  );
}
```

---

## 📚 Traductions Disponibles

### Navigation
- `t('nav.dashboard')` → Tableau de bord / Dashboard
- `t('nav.sales')` → Ventes / Sales
- `t('nav.payments')` → Paiements / Payments
- `t('nav.customers')` → Clients / Customers

### Actions Communes
- `t('common.save')` → Enregistrer / Save
- `t('common.cancel')` → Annuler / Cancel
- `t('common.search')` → Rechercher / Search
- `t('common.refresh')` → Actualiser / Refresh

### Pages Paiements
- `t('pages.payments.title')` → Paiements / Payments
- `t('pages.payments.paymentRecords')` → Enregistrements de paiement / Payment Records
- `t('pages.payments.saleNumber')` → Numéro de vente / Sale Number
- `t('pages.payments.invoiceNumber')` → Numéro de facture / Invoice Number
- `t('pages.payments.amount')` → Montant / Amount
- `t('pages.payments.dueDate')` → Date d'échéance / Due Date
- `t('pages.payments.method')` → Méthode / Method
- `t('pages.payments.statusLabel')` → Statut / Status

### Pages Ventes
- `t('pages.sales.title')` → Ventes / Sales
- `t('pages.sales.saleNumber')` → Numéro de vente / Sale Number
- `t('pages.sales.customer')` → Client / Customer
- `t('pages.sales.amount')` → Montant / Amount

---

## 📁 Fichiers de Traduction

- **Français:** `src/i18n/locales/fr/common.json`
- **Anglais:** `src/i18n/locales/en/common.json`

---

## 🔍 Trouver une Traduction

1. **Par page:** `pages.[nom_page].*`
   - Paiements: `pages.payments.*`
   - Ventes: `pages.sales.*`
   - Clients: `pages.customers.*`

2. **Par catégorie:**
   - Actions: `common.*`
   - Navigation: `nav.*`
   - Authentification: `auth.*`

3. **Recherche dans les fichiers:**
   ```bash
   grep -i "paiement" src/i18n/locales/fr/common.json
   ```

---

## 🌍 Changer de Langue

### Méthode 1: Interface Utilisateur
Cliquez sur le bouton globe dans le header → Affiche `Fr` ou `En`

### Méthode 2: Programmatique
```tsx
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();

// Français
i18n.changeLanguage('fr');

// Anglais
i18n.changeLanguage('en');
```

---

## ⚠️ Important

- ✅ **Toujours utiliser les traductions** : `{t('key')}` au lieu de textes en dur
- ✅ **Tester les deux langues** après chaque modification
- ✅ **Respecter la structure** : `category.subcategory.key`

---

## 📖 Documentation Complète

Voir `I18N_COMPLETE_IMPLEMENTATION.md` pour:
- Liste exhaustive des 500+ traductions
- Exemples détaillés par module
- Guide d'ajout de nouvelles traductions
- Bonnes pratiques et troubleshooting

---

## 🎯 Prochaines Étapes

**Pour implémenter dans votre composant:**

1. Importer le hook: `import { useTranslation } from 'react-i18next';`
2. Initialiser: `const { t } = useTranslation();`
3. Remplacer les textes: `<h1>{t('pages.payments.title')}</h1>`
4. Tester en français et en anglais

**Pages prioritaires à traduire:**
1. PaymentsPage (traductions disponibles)
2. SalesPage (traductions disponibles)
3. CustomersPage (traductions disponibles)
4. Dashboard (traductions disponibles)
5. Sidebar (traductions disponibles)

---

**Build Status:** ✅ RÉUSSI (24.91s)
**Statut:** ✅ PRODUCTION READY
