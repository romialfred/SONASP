# Contrôle visuel isolé du registre international

`npx vite --config tests/visual/international-sales/vite.config.ts`

Ouvrir http://127.0.0.1:5182. Le banc utilise le composant réel et des fixtures synthétiques, sans se connecter ni écrire en base. Il n'est importé par aucune route ou configuration de production.

Largeurs de contenu : 360, 768, 1134, 1208, 1364 (capture de référence hors sidebar), 1688 px. Cas directs : `/?case=rows`, `/?case=empty`, `/?case=loading`, `/?case=error`, `/?case=rows&lang=en`.

Ce contrôle ne remplace pas une recette authentifiée mine/Owner sur la plateforme ; les frontières SQL sont testées séparément dans `supabase/tests/international_sales_scope_test.sql`.
