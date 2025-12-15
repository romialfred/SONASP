#!/bin/bash

echo "🚀 Déploiement des fonctions Edge pour mise à jour automatique des taux FX"
echo ""

# Vérifier que Supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI n'est pas installé"
    echo ""
    echo "Installation:"
    echo "  - Via npm: npm install -g supabase"
    echo "  - Via brew: brew install supabase/tap/supabase"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI détecté: $(supabase --version)"
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "supabase/functions/fetch-daily-fx-rates" ]; then
    echo "❌ Erreur: Répertoire supabase/functions/fetch-daily-fx-rates non trouvé"
    echo "Assurez-vous d'être dans le répertoire racine du projet"
    exit 1
fi

if [ ! -d "supabase/functions/scheduled-tasks" ]; then
    echo "❌ Erreur: Répertoire supabase/functions/scheduled-tasks non trouvé"
    echo "Assurez-vous d'être dans le répertoire racine du projet"
    exit 1
fi

echo "✅ Répertoires des fonctions vérifiés"
echo ""

# Vérifier que le projet est lié
echo "🔍 Vérification de la liaison du projet..."
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Vous devez vous connecter et lier le projet"
    echo ""
    echo "Exécutez:"
    echo "  1. supabase login"
    echo "  2. supabase link --project-ref boolqagzdqbahqnpawpb"
    echo ""
    exit 1
fi

echo "✅ Projet lié avec succès"
echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# Déployer fetch-daily-fx-rates
echo "📤 Déploiement de fetch-daily-fx-rates..."
echo ""
supabase functions deploy fetch-daily-fx-rates

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ fetch-daily-fx-rates déployé avec succès!"
    echo "   URL: https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates"
else
    echo ""
    echo "❌ Erreur lors du déploiement de fetch-daily-fx-rates"
    echo ""
    echo "Suggestions:"
    echo "  - Vérifiez votre connexion internet"
    echo "  - Relancez: supabase login"
    echo "  - Consultez les logs: supabase functions logs fetch-daily-fx-rates"
    exit 1
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

# Déployer scheduled-tasks
echo "📤 Déploiement de scheduled-tasks..."
echo ""
supabase functions deploy scheduled-tasks

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ scheduled-tasks déployé avec succès!"
    echo "   URL: https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/scheduled-tasks"
else
    echo ""
    echo "❌ Erreur lors du déploiement de scheduled-tasks"
    echo ""
    echo "Suggestions:"
    echo "  - Vérifiez votre connexion internet"
    echo "  - Relancez: supabase login"
    echo "  - Consultez les logs: supabase functions logs scheduled-tasks"
    exit 1
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS!"
echo ""
echo "✅ Fonctions déployées:"
echo "   • fetch-daily-fx-rates"
echo "   • scheduled-tasks"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1️⃣  Configurer les cron jobs dans la base de données:"
echo "    → Ouvrez Supabase Dashboard > SQL Editor"
echo "    → Exécutez le fichier: setup_fx_auto_update.sql"
echo ""
echo "2️⃣  Tester immédiatement:"
echo "    → node manual_fx_update.mjs"
echo ""
echo "3️⃣  Vérifier les logs:"
echo "    → supabase functions logs fetch-daily-fx-rates --tail"
echo ""
echo "4️⃣  Vérifier les données dans la base:"
echo "    → SELECT * FROM fx_rates_daily ORDER BY rate_date DESC LIMIT 5;"
echo ""
echo "📖 Consultez GUIDE_DEPLOIEMENT_EDGE_FUNCTIONS.md pour plus de détails"
echo ""
