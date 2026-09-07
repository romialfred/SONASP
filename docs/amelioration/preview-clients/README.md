# Aperçu Clients isolé — présentation uniquement

```powershell
npx vite --config docs/amelioration/preview-clients/vite.config.ts
```

Origine dédiée : `http://127.0.0.1:5187/customers`. Le serveur ne remplace pas 5180/5186. Aucun navigateur piloté par l'agent de préparation.

- Liste : 25 clients explicitement fictifs, filtres/statuts et pagination réels.
- Détail : `/customers/ca000000-0000-4000-8000-000000000001` (2 ventes et 1 compte bancaire fictifs).
- Second détail : `/customers/ca000000-0000-4000-8000-000000000002` (aucune vente ni banque).
- Création : `/customers/new` ; modification : suffixe `/edit` du premier détail.
- États : `?mode=empty`, `?mode=error`, `?mode=sales-error` sur la route utile. Le paramètre porte uniquement sur la page ouverte ; le remettre après navigation si nécessaire.

Les vrais composants et les vrais agrégats `customerActivity` sont importés. Seuls chargements, Auth et services périphériques sont remplacés par des fixtures de lecture. Toute sauvegarde rejette explicitement ; elle ne crée **aucun succès simulé**. Les mutations Supabase/Storage/Edge sont interdites. `envDir` est le dossier de l'aperçu, sans chargement du `.env` production. Une CSP limite les connexions à cette origine locale. Le bandeau permanent distingue l'aperçu de l'application réelle. HMR désactivé : recharger explicitement après modification du code.

Cette présentation permet d'examiner design, navigation, filtres, champs et erreurs visibles. Elle ne prouve pas une connexion/MFA réelle, un enregistrement, une persistance ni une recette métier. Les liens de vente/paiement hors des routes Clients ouvrent un message explicite de périmètre indisponible, jamais un faux détail. Ne pas activer le lien de messagerie pendant la revue : aucune communication externe n'est autorisée par ce banc.
