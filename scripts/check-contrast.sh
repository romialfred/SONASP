#!/bin/bash

# ============================================
# Script de Vérification des Contrastes
# ============================================
# Détecte les combinaisons de couleurs problématiques
# dans le projet Gold Shipper

echo "🔍 Vérification des contrastes de couleurs..."
echo "=============================================="
echo ""

FOUND_ISSUES=0

# Fonction pour chercher et afficher
check_pattern() {
  local pattern=$1
  local description=$2

  echo "🔎 $description"

  RESULT=$(grep -rn "$pattern" src/ 2>/dev/null | grep -v "node_modules" | grep -v ".git")

  if [ ! -z "$RESULT" ]; then
    echo "❌ PROBLÈME TROUVÉ:"
    echo "$RESULT"
    echo ""
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
  else
    echo "✅ OK - Aucun problème"
    echo ""
  fi
}

# Vérifications
check_pattern "text-white.*bg-white\|bg-white.*text-white" "Texte blanc sur fond blanc (INVISIBLE)"
check_pattern "text-gray-50.*bg-gray-50\|bg-gray-50.*text-gray-50" "Texte gris-50 sur fond gris-50"
check_pattern "text-gray-100.*bg-gray-100\|bg-gray-100.*text-gray-100" "Texte gris-100 sur fond gris-100"
check_pattern "text-gray-200.*bg-gray-200\|bg-gray-200.*text-gray-200" "Texte gris-200 sur fond gris-200"
check_pattern "text-white.*bg-gray-50\|bg-gray-50.*text-white" "Texte blanc sur fond gris-50 (mauvais contraste)"

echo "=============================================="
if [ $FOUND_ISSUES -eq 0 ]; then
  echo "✅ SUCCÈS: Aucun problème de contraste détecté"
  exit 0
else
  echo "❌ ATTENTION: $FOUND_ISSUES type(s) de problème(s) détecté(s)"
  echo ""
  echo "📖 Consultez: GUIDE_CONTRASTE_COULEURS.md"
  exit 1
fi
