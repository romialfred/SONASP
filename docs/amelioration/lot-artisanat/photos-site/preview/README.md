# Banc SITE-DOC-007 — interface uniquement

`npx vite --config docs/amelioration/lot-artisanat/photos-site/preview/vite.config.ts`

Origine vérifiée libre avant démarrage : `http://127.0.0.1:5188`. Vrais formulaire/détail/aperçu/service photo et véritable compression navigateur ; Auth, services de fiche et transport Supabase sont simulés. Tous les dépôts/sauvegardes sont en mémoire du seul onglet. Un rechargement complet réinitialise les fixtures. Aucun `.env` applicatif chargé et CSP limitant les connexions à cette origine locale. Les autres routes ne conduisent pas à la plateforme réelle.

La fixture initiale contient deux références et tous les champs obligatoires d'un site non formalisé. Les commandes du banc peuvent simuler des refus de dépôt, lecture de la deuxième photo, retrait et sauvegarde. Les boutons « Sélection QA » injectent des fichiers dans le vrai input par l'API navigateur `DataTransfer`, puis déclenchent son événement `change`. Ils ne remplacent pas le gestionnaire applicatif. Le choix natif de fichier par le système d'exploitation n'est pas attesté par ce mécanisme.

L'image valide provient de l'asset local `/login-gold-background.webp` ; l'image illisible contient volontairement du texte. La galerie peut ensuite montrer les véritables blobs recompressés stockés en mémoire par ce transport. La réussite simulée n'est jamais une preuve de persistance réelle, de RLS ni d'accès à un vrai Storage.
