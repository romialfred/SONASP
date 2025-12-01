# ⚡ Quick Start: Numérotation BAR Reference HUMSMK-1204

## 🎯 Objectif

Faire en sorte que la prochaine production Kouroussa génère `HUMSMK-1204` au lieu de `HUMSMK-0001`.

## 🚀 Solution en 3 Étapes

### 1. Ouvrir Supabase SQL Editor
https://supabase.com/dashboard/project/_/sql

### 2. Copier et Exécuter
Copier **TOUT** le fichier `SET_BAR_REFERENCE_START_NUMBER.sql` et cliquer **RUN**

### 3. Vérifier
Le script affichera:
```
🎯 La prochaine production générera: HUMSMK-1204
```

## ✅ C'est Tout !

Créez maintenant une production Kouroussa → Elle sera numérotée `HUMSMK-1204` ✅

---

## 🔍 Ce Que Fait le Script

Le script cherche vos productions existantes:

**Cas 1**: Si vous avez des productions `HUMKGM-xxxx`
→ Les convertit en `HUMSMK-xxxx`

**Cas 2**: Si vous n'avez rien
→ Crée une production "placeholder" `HUMSMK-1203`

**Résultat**: La prochaine sera automatiquement `HUMSMK-1204` ✅

---

## 📚 Documentation Complète

Voir `BAR_REFERENCE_START_GUIDE.md` pour plus de détails.

---

**Durée**: 2 secondes  
**Fichier**: `SET_BAR_REFERENCE_START_NUMBER.sql`  
**Réversible**: Oui
