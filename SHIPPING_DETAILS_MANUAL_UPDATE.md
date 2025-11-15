# MODIFICATIONS MANUELLES REQUISES - Page Détails Expédition

## ⚠️ IMPORTANT

Les modifications n'ont PAS été correctement appliquées car la version **Enhanced** est utilisée dans l'application, pas la version standard.

**Fichier à modifier:** `/src/pages/shipping/ShippingPreparationDetailsEnhanced.tsx`

---

## 🎯 MODIFICATIONS À APPLIQUER

### 1. **REMPLACER LE LAYOUT COMPLET** (Lignes 252-280)

**AVANT:**
```tsx
return (
  <MainLayout>
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto p-6">
        <div className="flex gap-6">
          {/* Main Content - Left Side */}
          <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button>Retour</Button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-amber-400...">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1>Détails de l'Expédition</h1>
                  <p>{preparation.expedition_lot_number}</p>
                </div>
              </div>
            </div>
```

**APRÈS:**
```tsx
return (
  <MainLayout>
    <div className="min-h-screen bg-gray-50">
      {/* HEADER BLANC AVEC BORDURE */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button>Retour</Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Expédition {preparation.expedition_lot_number}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{formatShortDate(...)}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit className="w-4 h-4" />
              Modifier
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 space-y-6">
            {/* WORKFLOW EN HAUT */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <ShippingStatusWorkflowEnhanced {...} />
            </div>
```

### 2. **REMPLACER LES TUILES MÉTRIQUES** (Lignes 281-330)

**AVANT:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="relative overflow-hidden rounded-xl ... p-5">
    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full..." />
    <div className="relative">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 bg-amber-500/10 rounded-lg">
          <Box className="w-5 h-5 text-amber-600" />
        </div>
        <span className="text-xs...">Boîtes</span>
      </div>
      <p className="text-3xl font-bold...">{preparation.total_boxes}</p>
    </div>
  </div>
  {/* 2 autres tuiles similaires */}
</div>
```

**APRÈS:**
```tsx
<div className="grid grid-cols-3 gap-4">
  {/* TUILES COMPACTES - HAUTEUR RÉDUITE */}
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-3">
    <div className="flex items-center gap-2 mb-1">
      <Box className="w-4 h-4 text-amber-600" />
      <span className="text-xs font-semibold text-amber-700 uppercase">Boîtes</span>
    </div>
    <p className="text-2xl font-bold text-amber-900">{productionItems.length}</p>
  </div>

  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-3">
    <div className="flex items-center gap-2 mb-1">
      <Weight className="w-4 h-4 text-emerald-600" />
      <span className="text-xs font-semibold text-emerald-700 uppercase">Poids Net</span>
    </div>
    <div className="flex items-baseline gap-1">
      <p className="text-2xl font-bold text-emerald-900">{preparation.total_net_weight_grams.toFixed(2)}</p>
      <span className="text-xs text-emerald-600">g</span>
    </div>
  </div>

  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3">
    <div className="flex items-center gap-2 mb-1">
      <Weight className="w-4 h-4 text-blue-600" />
      <span className="text-xs font-semibold text-blue-700 uppercase">Poids Brut</span>
    </div>
    <div className="flex items-baseline gap-1">
      <p className="text-2xl font-bold text-blue-900">{preparation.total_gross_weight_grams.toFixed(2)}</p>
      <span className="text-xs text-blue-600">g</span>
    </div>
  </div>
</div>
```

### 3. **AJOUTER PANNEAU LATÉRAL DROIT** (Après ligne 609)

**AJOUTER AVANT `</div></div></div>` FINAL:**
```tsx
            </div>

            {/* RIGHT SIDEBAR - STATUS & HISTORY */}
            <div className="w-96">
              {/* Current Status */}
              <Card className="p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Statut Actuel</h3>
                </div>
                <ShippingStatusBadge status={preparation.status} size="lg" />
              </Card>

              {/* Workflow Status Card */}
              <Card className="p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Workflow de Statut</h3>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-amber-500 rounded-full flex-shrink-0">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-1">
                        {statusLabels[preparation.status] || preparation.status}
                      </p>
                      <p className="text-xs text-amber-700">
                        Expédition en cours de traitement
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* History */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Historique des Changements</h3>
                </div>
                <ShippingStatusHistory history={statusHistory} />
              </Card>
            </div>
          </div>
        </div>
      </div>
```

### 4. **TABLEAU PRODUCTIONS** (Lignes 440-502)

Remplacer les cards par un tableau:

```tsx
{activeTab === 'productions' && (
  <Card className="p-6">
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-bold text-gray-900">Productions Incluses</h2>
      <span className="text-sm text-gray-500">{productionItems.length} items</span>
    </div>
    {productionItems.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Box Number</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Poids Brut (g)</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Finesse (%)</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Or Pur (g)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Scellé 1</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Scellé 2</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productionItems.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.ingot_box_number}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{item.gross_weight_grams.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right text-amber-600 font-semibold">{item.fineness_pct.toFixed(2)}%</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">{item.pure_gold_grams.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-700">{item.seal_number_1 || '-'}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-700">{item.seal_number_2 || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-12 text-gray-500">
        <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Aucune production associée</p>
      </div>
    )}
  </Card>
)}
```

---

## ✅ RÉSUMÉ DES CHANGEMENTS

1. ✅ **Header blanc** avec bordure en bas
2. ✅ **Workflow visuel** en haut de la page
3. ✅ **Tuiles compactes** (p-3 au lieu de p-5, text-2xl au lieu de text-3xl)
4. ✅ **Panneau latéral droit** avec:
   - Statut actuel
   - Workflow info
   - Historique
5. ✅ **Tableau productions** au lieu de cards
6. ✅ **Bouton Modifier** en haut à droite du header

---

## 🚀 APPLICATION

**Option 1: Modification manuelle**
1. Ouvrir le fichier dans VSCode
2. Appliquer les modifications ci-dessus
3. Sauvegarder

**Option 2: Remplacer le fichier complet**
Utiliser la version dans `/src/pages/shipping/ShippingPreparationDetails.tsx` qui a déjà toutes les modifications.

---

## ⚠️ VÉRIFICATION APRÈS MODIFICATION

```bash
npm run build
```

Devrait compiler sans erreur.

