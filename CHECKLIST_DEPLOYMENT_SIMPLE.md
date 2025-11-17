# ✅ CHECKLIST DÉPLOIEMENT MODULE FREIGHT & CUSTOMS

## 📋 LISTE SIMPLE À COCHER

### ☐ ÉTAPE 1: MIGRATION DATABASE (2 minutes)

```sql
-- 1. Ouvrir Supabase Dashboard → SQL Editor
-- 2. Copier-coller TOUT le fichier:
supabase/migrations/20251117_002_create_freight_shipments_system.sql
-- 3. Cliquer "Run"
-- 4. Vérifier message "Success" ✅
```

**Vérification:**
```sql
SELECT COUNT(*) FROM freight_shipments;
-- Doit retourner: 0 (table vide mais créée)
```

---

### ☐ ÉTAPE 2: BUCKET STORAGE (2 minutes)

```sql
-- Dans Supabase SQL Editor, exécuter:

-- Créer bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('freight-documents', 'freight-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy SELECT
CREATE POLICY IF NOT EXISTS "freight_docs_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'freight-documents');

-- Policy INSERT
CREATE POLICY IF NOT EXISTS "freight_docs_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'freight-documents');

-- Policy UPDATE
CREATE POLICY IF NOT EXISTS "freight_docs_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'freight-documents')
WITH CHECK (bucket_id = 'freight-documents');

-- Policy DELETE
CREATE POLICY IF NOT EXISTS "freight_docs_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'freight-documents');
```

**Vérification:**
```sql
SELECT * FROM storage.buckets WHERE id = 'freight-documents';
-- Doit retourner: 1 ligne
```

---

### ☐ ÉTAPE 3: ROUTES APPLICATION (1 minute)

**Fichier:** `src/App.tsx`

**Ajouter ces 2 imports** (en haut):
```typescript
import FreightShipmentCreate from '@/pages/freight/FreightShipmentCreate';
import FreightShipmentDetails from '@/pages/freight/FreightShipmentDetails';
```

**Ajouter ces 2 routes** (section freight):
```typescript
<Route path="/freight/shipments/new" element={<FreightShipmentCreate />} />
<Route path="/freight/shipments/:id" element={<FreightShipmentDetails />} />
```

**Sauvegarder le fichier**

---

### ☐ ÉTAPE 4: BUILD (30 secondes)

```bash
npm run build
```

**Attendu:** 
```
✓ built in ~35-40s
0 errors
```

---

### ☐ ÉTAPE 5: TEST CRÉATION EXPÉDITION (3 minutes)

1. Aller sur `/freight/shipments/new`
2. Sélectionner 2 productions
3. Remplir:
   - Prix or: 2650.00
   - Taux: 561.0000
   - Devise: CFA
   - Raffinerie: (sélectionner)
   - Boîtes: 2
4. Cliquer "Créer l'Expédition"
5. ✅ Vérifier notifications succès
6. ✅ Vérifier redirection vers page détails
7. ✅ Vérifier 2 PDFs téléchargeables

---

### ☐ ÉTAPE 6: TEST WORKFLOW (2 minutes)

1. Status "En Attente" → Cliquer "Approuver"
2. ✅ Vérifier status devient "Approuvé"
3. Cliquer "Marquer comme Expédié"
4. ✅ Vérifier status devient "Expédié"
5. Cliquer "Confirmer Réception"
6. ✅ Vérifier status devient "Reçu à Raffinerie"

---

### ☐ ÉTAPE 7: TEST PDFs (1 minute)

1. Onglet "Documents"
2. Télécharger "Bullion Summary"
3. ✅ Vérifier format professionnel
4. Télécharger "Invoice Douane"
5. ✅ Vérifier format professionnel

---

### ☐ ÉTAPE 8: NON-RÉGRESSION (1 minute)

1. Aller sur `/shipping` 
2. ✅ Vérifier module fonctionne
3. Aller sur `/production/in-safe`
4. ✅ Vérifier module fonctionne

---

## ✅ FIN - MODULE DÉPLOYÉ AVEC SUCCÈS

**Temps total: ~12 minutes**

---

## 📞 EN CAS DE PROBLÈME

| Problème | Solution |
|----------|----------|
| Erreur migration SQL | Vérifier syntaxe, relire fichier migration |
| Bucket non créé | Vérifier Supabase Dashboard → Storage |
| Routes non trouvées | Vérifier imports App.tsx, restart dev server |
| PDFs non générés | Vérifier bucket créé, policies actives |
| Productions vides | Mettre status "ready_for_expedition" sur productions |

**Voir documentation complète:** `FREIGHT_CUSTOMS_FINAL_EXECUTION_PLAN.md`

---

**✅ DÉPLOIEMENT TERMINÉ ! MODULE OPÉRATIONNEL 🚀**
