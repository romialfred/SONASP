# Spécification: Refonte Module Invoice & Consignment

## 📋 Vue d'Ensemble

Refonte complète et professionnelle du module **Invoice & Consignment** avec amélioration majeure de l'UX/UI et ajout de nouvelles fonctionnalités logistiques.

---

## 🎯 Objectifs

1. **Table des Expéditions** : Améliorer avec plus d'informations pertinentes
2. **Popup de Détails** : Afficher les détails des productions au survol
3. **Informations d'Expédition** : Ajouter informations de vol complètes
4. **Informations Douanières** : Améliorer la présentation et les champs
5. **Organisation Professionnelle** : Layout moderne et intuitif

---

## 📊 1. TABLE DES EXPÉDITIONS - Modifications

### ❌ Colonnes à SUPPRIMER
- `Destination` (remplacée par mining company info)
- `Designation` (pas pertinent)

### ✅ Colonnes à AJOUTER

| Colonne | Type | Description | Source |
|---------|------|-------------|--------|
| **Lot d'Expédition** | Text | Numéro du lot (ex: HUM-KGM-002:2025) | `expedition_lot_number` |
| **Mining Company** | Text | Société minière | Via `daily_production.mining_company_id` |
| **Date Production** | Date | Date de la première production | `daily_production.production_date` |
| **Bullion (g)** | Number | Poids brut total | Sum `bullion_grams` |
| **Poids Net (g)** | Number | Poids pur total | Sum `pure_gold_grams` |
| **Nb Prod.** | Number | Nombre de productions | Count `items` |

###  🖱️ Interaction: Popup au Survol

**Déclencheur** : Mouse hover sur une ligne

**Contenu du Popup** :
```
┌─────────────────────────────────────────────────┐
│ Détails des Productions - HUM-KGM-002:2025     │
├─────────────────────────────────────────────────┤
│                                                 │
│  #  │ Bar Ref     │ Date       │ Bullion │ Net │
│ ────┼─────────────┼────────────┼─────────┼─────│
│  1  │ HUM-001-25  │ 2025-01-15 │ 5,200g  │ ... │
│  2  │ HUM-002-25  │ 2025-01-16 │ 6,069g  │ ... │
│                                                 │
│  Total: 2 productions | 11,269g bullion         │
└─────────────────────────────────────────────────┘
```

**Implémentation** :
- Component : `<ProductionDetailsPopup />`
- Position : Absolute, suit la souris
- Trigger : `onMouseEnter` / `onMouseLeave`
- Style : Card avec shadow, z-index élevé

---

## 🛫 2. INFORMATIONS D'EXPÉDITION - Nouvelle Structure

### Section: **Départ (Origin)**

```tsx
<Card title="Informations de Départ">
  <div className="grid grid-cols-2 gap-4">
    <Input label="Pays de Départ" value={departureCountry} />
    <Input label="Ville de Départ" value={departureCity} />
    <Input label="Aéroport de Départ"
           value={departureAirport}
           placeholder="Ex: Bamako-Sénou (BKO)" />
    <Input label="Heure de Départ (Local Time)"
           type="time"
           value={departureTime} />
  </div>
</Card>
```

### Section: **Arrivée (Destination)**

```tsx
<Card title="Informations d'Arrivée">
  <div className="grid grid-cols-2 gap-4">
    <Input label="Pays d'Arrivée" value={arrivalCountry} />
    <Input label="Ville d'Arrivée" value={arrivalCity} />
    <Input label="Aéroport d'Arrivée"
           value={arrivalAirport}
           placeholder="Ex: OR Tambo (JNB)" />
    <Input label="Heure d'Arrivée Prévue (Local Time)"
           type="time"
           value={arrivalTime} />
    <Input label="Durée du Trajet"
           value={flightDuration}
           placeholder="Ex: 4h 30min" />
  </div>
</Card>
```

### Section: **Transport & Raffinage**

```tsx
<Card title="Compagnies">
  <div className="grid grid-cols-2 gap-4">
    <Select label="Transport Company"
            value={transportCompanyId}
            options={transportCompanies}
            defaultSelected={true} />

    <Select label="Refinery Company"
            value={destinationRefineryId}
            options={refineries}
            defaultSelected={true} />
  </div>
</Card>
```

### ❌ Éléments à SUPPRIMER
- Nombre de boîtes ("1")
- Type de boîte ("Plastic Box")

**Raison** : Pas pertinent pour une expédition de lingots d'or vers raffinerie.

---

## 💰 3. INFORMATIONS DOUANIÈRES - Améliorations

### Structure Proposée

```tsx
<Card title="Informations Douanières">
  <div className="grid grid-cols-3 gap-4">
    {/* Prix de Vente */}
    <div className="col-span-1">
      <label>Prix de Vente de l'Or ($/oz)</label>
      <Input
        type="number"
        step="0.01"
        value={goldPriceUsdPerOz}
        placeholder="Ex: 2650.00"
        icon={<DollarSign />}
      />
      <span className="text-xs text-gray-500">
        Prix actuel: ${currentGoldPrice}/oz
      </span>
    </div>

    {/* Paire de Devises */}
    <div className="col-span-1">
      <label>Paire de Devises</label>
      <Select value={currencyPair} onChange={setCurrencyPair}>
        <option value="USD/XOF">USD/XOF (Franc CFA BCEAO)</option>
        <option value="EUR/XOF">EUR/XOF (Franc CFA BCEAO)</option>
        <option value="USD/GNF">USD/GNF (Franc Guinéen)</option>
        <option value="EUR/GNF">EUR/GNF (Franc Guinéen)</option>
      </Select>
    </div>

    {/* Taux de Change */}
    <div className="col-span-1">
      <label>Taux de Change</label>
      <Input
        type="number"
        step="0.01"
        value={exchangeRate}
        placeholder="Ex: 656.5"
        icon={<TrendingUp />}
      />
      <span className="text-xs text-gray-500">
        Taux actuel: {currentExchangeRate}
      </span>
    </div>
  </div>

  {/* Calcul Automatique */}
  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div>
        <span className="text-gray-600">Valeur en USD:</span>
        <span className="font-bold text-blue-900 ml-2">
          ${calculatedValueUSD.toLocaleString()}
        </span>
      </div>
      <div>
        <span className="text-gray-600">Valeur en {localCurrency}:</span>
        <span className="font-bold text-blue-900 ml-2">
          {calculatedValueLocal.toLocaleString()} {localCurrency}
        </span>
      </div>
      <div>
        <span className="text-gray-600">Total Oz:</span>
        <span className="font-bold text-blue-900 ml-2">
          {totalPureGoldOz.toFixed(3)} oz
        </span>
      </div>
    </div>
  </div>

  {/* Notes */}
  <div className="mt-4">
    <label>Notes ou Observations</label>
    <TextArea
      value={notes}
      onChange={setNotes}
      rows={3}
      placeholder="Informations complémentaires pour cette expédition..."
    />
  </div>
</Card>
```

### Améliorations
1. **Labels clairs** sur tous les champs
2. **Paire de devises** dropdown au lieu de texte libre
3. **Calculs automatiques** affichés en temps réel
4. **Indicateurs visuels** (prix actuel, taux actuel)

---

## 🎨 4. ORGANISATION PROFESSIONNELLE

### Layout Global

```
┌────────────────────────────────────────────────────┐
│  Header: Nouvelle Expédition vers Raffinerie      │
│  [← Retour]                                        │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  📦 SECTION 1: Sélection des Expéditions          │
│  ├─ Table améliorée avec nouvelles colonnes       │
│  └─ Popup détails au survol                       │
└────────────────────────────────────────────────────┘

┌──────────────────────┬─────────────────────────────┐
│ 🛫 SECTION 2:        │ 🛬 SECTION 3:               │
│ Informations Départ  │ Informations Arrivée        │
│                      │                             │
│ • Pays               │ • Pays                      │
│ • Ville              │ • Ville                     │
│ • Aéroport           │ • Aéroport                  │
│ • Heure départ       │ • Heure arrivée             │
│                      │ • Durée trajet              │
└──────────────────────┴─────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  🏢 SECTION 4: Compagnies                          │
│  ├─ Transport Company (Dropdown)                  │
│  └─ Refinery Company (Dropdown)                   │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  💰 SECTION 5: Informations Douanières            │
│  ├─ Prix de vente                                 │
│  ├─ Paire de devises                              │
│  ├─ Taux de change                                │
│  ├─ Calculs automatiques                          │
│  └─ Notes                                         │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  👥 SECTION 6: Authorised Depositors               │
│  └─ Table en lecture seule                        │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  ℹ️  SECTION 7: Génération Automatique             │
│  └─ Informations sur les PDFs                     │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  [Annuler]                    [Créer l'Expédition]│
└────────────────────────────────────────────────────┘
```

### Principes de Design

1. **Hiérarchie Claire** : Sections numérotées et bien séparées
2. **Grilles Responsives** : 2 colonnes pour desktop, 1 pour mobile
3. **Visual Grouping** : Cards avec icônes et couleurs
4. **White Space** : Espacement généreux entre sections
5. **Typography** : Titres clairs, labels explicites
6. **Feedback Visuel** : Calculs en temps réel, validations

---

## 🔄 5. FLUX UTILISATEUR

```
1. User arrive sur page "Nouvelle Expédition"
   ↓
2. Sélectionne shipping preparation(s) dans table
   • Au survol: voit détails des productions
   • Checkboxes pour sélection multiple
   ↓
3. Remplit informations de départ
   • Pays, Ville, Aéroport, Heure
   ↓
4. Remplit informations d'arrivée
   • Pays, Ville, Aéroport, Heure, Durée
   ↓
5. Vérifie compagnies (pré-sélectionnées)
   • Transport Company
   • Refinery Company
   ↓
6. Entre informations douanières
   • Prix de l'or
   • Sélectionne paire de devises
   • Entre taux de change
   • Voit calculs automatiques
   ↓
7. Vérifie Authorised Depositors (auto-chargés)
   ↓
8. Ajoute notes optionnelles
   ↓
9. Clique "Créer l'Expédition"
   • Validation
   • Création en base
   • Génération PDFs
   • Redirection
```

---

## 📦 6. COMPOSANTS À CRÉER

### 6.1 ProductionDetailsPopup

```tsx
interface ProductionDetailsPopupProps {
  shippingPrepId: string;
  productions: ProductionDetail[];
  visible: boolean;
  position: { x: number; y: number };
}

export function ProductionDetailsPopup({
  shippingPrepId,
  productions,
  visible,
  position
}: ProductionDetailsPopupProps) {
  if (!visible) return null;

  return (
    <div
      className="absolute z-50 bg-white shadow-2xl rounded-lg border-2 border-blue-300"
      style={{ top: position.y, left: position.x }}
    >
      {/* Content */}
    </div>
  );
}
```

### 6.2 FlightInformationSection

```tsx
export function FlightInformationSection({
  departure,
  arrival,
  onDepartureChange,
  onArrivalChange
}: FlightInfoProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <DepartureCard {...departure} onChange={onDepartureChange} />
      <ArrivalCard {...arrival} onChange={onArrivalChange} />
    </div>
  );
}
```

### 6.3 CustomsInformationSection

```tsx
export function CustomsInformationSection({
  goldPrice,
  exchangeRate,
  currencyPair,
  calculations,
  onChange
}: CustomsInfoProps) {
  return (
    <Card>
      {/* Form fields */}
      {/* Automatic calculations display */}
    </Card>
  );
}
```

---

## 🗄️ 7. MODIFICATIONS BASE DE DONNÉES

### Tables Existantes à Utiliser

- `freight_shipments` : Table principale
- `shipping_preparations` : Expéditions sources
- `transport_companies` : Compagnies de transport
- `refineries` : Raffineries destination
- `shipping_signatories` : Signataires autorisés

### Nouveaux Champs à Ajouter (si nécessaire)

```sql
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS departure_country VARCHAR(100);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS departure_city VARCHAR(100);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS departure_airport VARCHAR(200);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS departure_time TIME;
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS arrival_country VARCHAR(100);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS arrival_city VARCHAR(100);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS arrival_airport VARCHAR(200);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS arrival_time TIME;
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS flight_duration VARCHAR(50);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS transport_company_id UUID REFERENCES transport_companies(id);
ALTER TABLE freight_shipments ADD COLUMN IF NOT EXISTS currency_pair VARCHAR(20);
```

---

## ✅ 8. CHECKLIST D'IMPLÉMENTATION

### Phase 1: Table des Expéditions
- [ ] Supprimer colonne "Destination"
- [ ] Ajouter colonnes: Mining Company, Date Production, Bullion(g)
- [ ] Créer composant ProductionDetailsPopup
- [ ] Implémenter logique de hover avec position tracking
- [ ] Charger données mining company depuis relations

### Phase 2: Informations de Vol
- [ ] Créer section Départ (4 champs)
- [ ] Créer section Arrivée (5 champs)
- [ ] Pré-remplir avec valeurs par défaut intelligentes
- [ ] Valider format des heures
- [ ] Supprimer champs Plastic Box et nombre

### Phase 3: Compagnies
- [ ] Charger transport_companies depuis DB
- [ ] Dropdown avec sélection par défaut
- [ ] Raffinerie pré-sélectionnée (Rand Refinery)

### Phase 4: Informations Douanières
- [ ] Ajouter labels clairs sur tous champs
- [ ] Créer dropdown paire de devises (4 options)
- [ ] Implémenter calculs automatiques temps réel
- [ ] Afficher prix actuel or et taux de change

### Phase 5: Layout & UX
- [ ] Organiser en 7 sections claires
- [ ] Responsive design (2 cols → 1 col mobile)
- [ ] Icônes pour chaque section
- [ ] Espacement et padding professionnel
- [ ] États de chargement et validation

### Phase 6: Tests
- [ ] Test sélection multiple expéditions
- [ ] Test popup détails productions
- [ ] Test calculs automatiques
- [ ] Test validation formulaire
- [ ] Test création expédition complète

---

## 🎯 RÉSULTAT ATTENDU

Un module **Invoice & Consignment** moderne, professionnel et complet qui :

1. ✅ Affiche toutes les informations pertinentes dans la table
2. ✅ Permet de voir les détails au survol
3. ✅ Collecte toutes les informations logistiques nécessaires
4. ✅ Présente les informations douanières clairement
5. ✅ Calcule automatiquement les valeurs
6. ✅ Organise l'interface de manière logique et intuitive
7. ✅ Fonctionne parfaitement sur desktop et mobile

**Niveau de qualité** : Production-ready, enterprise-grade application
