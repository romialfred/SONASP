# Contrôle visuel isolé du simulateur de vente

Lancer `npx vite --config tests/visual/sale-simulator/vite.config.ts`, puis ouvrir
`http://127.0.0.1:5183/`.

Le banc charge les vrais composants du simulateur avec un contexte synthétique local.
Il ne dépend d’aucune session, n’appelle aucune API et n’écrit aucune donnée. Il permet
de contrôler le rendu, les calculs, le curseur, la synthèse, l’export et le tiroir du
cours de l’or aux largeurs de référence. Il n’est importé par aucune route de production.

Les variantes `/?width=375`, `/?width=768` et `/?width=1024` isolent la page dans un
cadre de largeur contrôlée pour vérifier les points de rupture réactifs.
