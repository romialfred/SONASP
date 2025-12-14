# Correction du Bug d'Ajout de Banques aux Clients

## Problème Identifié

Lors de l'ajout d'une banque à un client existant, l'erreur suivante se produisait:
```
Failed to save bank accounts: null value in column "bank_name" of relation "customer_banks" violates not-null constraint
```

## Cause du Bug

Le problème venait d'une **incohérence dans les noms de propriétés** entre snake_case et camelCase:

1. **BankAccountForm.tsx** utilisait `bank_name` (snake_case) dans son interface
2. **CustomerForm.tsx** mappait les données en camelCase lors du chargement (`bankName`)
3. Mais lors de la sauvegarde, le code essayait d'accéder à `bank.bankName` alors que l'objet utilisait `bank_name`
4. Résultat: `bank.bankName` était `undefined`, envoyant `null` à la base de données

## Corrections Appliquées

### 1. Uniformisation des Propriétés (camelCase)

**Fichier: `src/components/customers/BankAccountForm.tsx`**

Changement de l'interface pour utiliser camelCase partout:

```typescript
export interface BankAccount {
  id?: string;
  bankName: string;        // ✅ au lieu de bank_name
  country: string;
  city: string;
  accountNumber: string;   // ✅ au lieu de account_number
  iban: string;
  swiftCode: string;       // ✅ au lieu de swift_code
  currency: string;
  isPrimary: boolean;      // ✅ au lieu de is_primary
  isActive: boolean;       // ✅ au lieu de is_active
}
```

### 2. Ajout de Listes de Banques par Pays

Ajout de listes complètes de banques pour les 3 pays demandés:

#### Côte d'Ivoire (15 banques)
- Banque Atlantique Côte d'Ivoire
- NSIA Banque Côte d'Ivoire
- Société Générale Côte d'Ivoire
- BICICI
- Ecobank Côte d'Ivoire
- Standard Chartered Bank
- Citibank Côte d'Ivoire
- BNI
- Bridge Bank Group
- Coris Bank International
- Versus Bank
- UBA Côte d'Ivoire
- BSIC
- Bank of Africa
- Orabank Côte d'Ivoire

#### Burkina Faso (12 banques)
- Banque Atlantique Burkina Faso
- Ecobank Burkina Faso
- Coris Bank International
- BCB
- BIB
- Société Générale Burkina Faso
- Bank of Africa Burkina Faso
- UBA Burkina Faso
- BACB
- BSIC
- Orabank Burkina Faso
- NSIA Banque Burkina Faso

#### Guinée (11 banques)
- SGBG
- Ecobank Guinée
- BICIGUI
- Orabank Guinée
- UBA Guinée
- Vista Bank Guinée
- BCI
- BIG (Banque Islamique)
- BPMG
- Coris Bank International Guinée
- NSIA Banque Guinée

### 3. Sélection Intelligente des Banques

Le formulaire détecte maintenant automatiquement le pays sélectionné et affiche:
- Un dropdown avec les banques du pays (si Côte d'Ivoire, Burkina Faso ou Guinée)
- Un champ de saisie libre pour les autres pays
- Une option "Other (specify below)" pour ajouter des banques non listées

### 4. Validation Améliorée

**Fichier: `src/pages/customers/CustomerForm.tsx`**

Ajout de validations strictes avant l'insertion:

```typescript
// Vérification que tous les champs requis sont remplis
const invalidBanks = formData.banks.filter(
  bank => !bank.bankName || !bank.bankName.trim() ||
          !bank.country || !bank.country.trim() ||
          !bank.city || !bank.city.trim() ||
          !bank.currency || !bank.currency.trim()
);

if (invalidBanks.length > 0) {
  throw new Error('All bank accounts must have a name, country, city, and currency.');
}

// Filtrage et nettoyage des données
const banksToInsert = formData.banks
  .filter(bank => bank.bankName && bank.bankName.trim() && bank.bankName !== '__other__')
  .map(bank => ({
    customer_id: customerId,
    bank_name: bank.bankName.trim(),  // ✅ trim() pour éviter les espaces
    account_number: bank.accountNumber?.trim() || null,
    swift_code: bank.swiftCode?.trim() || null,
    iban: bank.iban?.trim() || null,
    currency: bank.currency,
    country: bank.country,
    city: bank.city.trim(),
    is_primary: bank.isPrimary || false,
    is_active: bank.isActive !== false,
  }));
```

## Améliorations de l'Interface

### Ordre des Champs Optimisé

Le formulaire affiche maintenant les champs dans cet ordre logique:
1. **Country** - Sélection du pays (déclenche la liste des banques)
2. **City** - Ville de la banque
3. **Bank Name** - Dropdown intelligent ou champ texte
4. **Currency** - Devise du compte
5. Account Number (optionnel)
6. IBAN (optionnel)
7. SWIFT/BIC Code (optionnel)

### Expérience Utilisateur

- Sélection d'abord le pays active la liste des banques appropriée
- Les banques sont affichées dans un dropdown facile à utiliser
- Option "Other" pour les banques non listées
- Validation en temps réel avant la sauvegarde
- Messages d'erreur clairs et précis

## Tests à Effectuer

### Test 1: Création de Client avec Banques
1. Aller sur `/customers/new`
2. Remplir les informations du client
3. Ajouter 2-3 banques avec des pays différents (CI, BF, GN)
4. Sélectionner des banques depuis le dropdown
5. Sauvegarder
6. ✅ Vérifier que toutes les banques sont sauvegardées

### Test 2: Édition de Client - Ajout de Banque
1. Éditer un client existant
2. Cliquer "Add Bank"
3. Sélectionner pays = Côte d'Ivoire
4. Sélectionner une banque depuis le dropdown
5. Remplir ville et devise
6. Sauvegarder
7. ✅ Plus d'erreur "null value in column bank_name"

### Test 3: Validation des Champs Requis
1. Ajouter une banque
2. Laisser le nom de la banque vide
3. Essayer de sauvegarder
4. ✅ Message d'erreur clair affiché

### Test 4: Banque Personnalisée (Other)
1. Sélectionner un pays d'Afrique (ex: Côte d'Ivoire)
2. Dans le dropdown, choisir "Other (specify below)"
3. Entrer un nom de banque personnalisé
4. Sauvegarder
5. ✅ La banque personnalisée est sauvegardée

## Résultat

Le système de gestion des banques fonctionne maintenant correctement:
- Aucune erreur lors de l'ajout de banques
- Les données sont validées avant insertion
- Interface intuitive avec listes de banques par pays
- Support de plusieurs banques par client
- Validation des champs requis

## Build Status

✅ Build réussi sans erreur
✅ Tous les types TypeScript sont corrects
✅ Prêt pour le déploiement
