#!/bin/bash

# Script de Nettoyage des Données Transactionnelles
# Usage: ./scripts/clean-data.sh [--auto]

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_header() {
  echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
  print_error "Ce script doit être exécuté depuis la racine du projet"
  exit 1
fi

# Vérifier que les fichiers SQL existent
if [ ! -f "scripts/clean-transactional-data.sql" ]; then
  print_error "Fichier clean-transactional-data.sql introuvable"
  exit 1
fi

# Bannière
clear
print_header "Nettoyage des Données Transactionnelles"
echo ""

# Avertissement
print_warning "ATTENTION: Ce script va supprimer toutes les données transactionnelles!"
print_warning "Les données suivantes seront SUPPRIMÉES:"
echo "  • Productions journalières"
echo "  • Documents de production"
echo "  • Historique des statuts"
echo "  • Expéditions"
echo "  • Inventaire"
echo "  • Ventes"
echo "  • Paiements"
echo ""
print_success "Les données suivantes seront PRÉSERVÉES:"
echo "  • Utilisateurs et permissions"
echo "  • Stakeholders (sociétés minières, raffineries, etc.)"
echo "  • Taux de change"
echo "  • Prix de l'or"
echo "  • Prévisions et budgets"
echo ""

# Mode automatique?
AUTO_MODE=false
if [ "$1" = "--auto" ]; then
  AUTO_MODE=true
  print_warning "Mode automatique activé - Pas de confirmation"
fi

# Confirmation
if [ "$AUTO_MODE" = false ]; then
  echo -e "${YELLOW}Avez-vous fait une sauvegarde de votre base de données? (oui/non)${NC}"
  read -p "> " backup_confirm

  if [ "$backup_confirm" != "oui" ]; then
    print_error "Veuillez d'abord faire une sauvegarde!"
    echo "Vous pouvez la faire via:"
    echo "  • Supabase Dashboard → Settings → Backups"
    echo "  • supabase db dump -f backup.sql"
    exit 1
  fi

  echo ""
  echo -e "${RED}Êtes-vous ABSOLUMENT SÛR de vouloir supprimer toutes les données transactionnelles? (oui/non)${NC}"
  read -p "> " final_confirm

  if [ "$final_confirm" != "oui" ]; then
    print_warning "Opération annulée"
    exit 0
  fi
fi

# Vérifier les variables d'environnement Supabase
if [ -z "$SUPABASE_DB_URL" ]; then
  if [ ! -f ".env" ]; then
    print_error "Fichier .env introuvable et SUPABASE_DB_URL non défini"
    exit 1
  fi

  # Charger les variables d'environnement
  source .env

  if [ -z "$SUPABASE_DB_URL" ]; then
    print_error "SUPABASE_DB_URL non défini dans .env"
    exit 1
  fi
fi

echo ""
print_header "Exécution du script de nettoyage"
echo ""

# Choisir le script selon le mode
if [ "$AUTO_MODE" = true ]; then
  SQL_FILE="scripts/clean-transactional-data-auto.sql"
  print_warning "Exécution en mode automatique (COMMIT automatique)"
else
  SQL_FILE="scripts/clean-transactional-data.sql"
  print_warning "Exécution en mode interactif (nécessite COMMIT manuel)"
fi

# Exécuter le script
if command -v psql &> /dev/null; then
  print_success "Connexion à la base de données..."
  psql "$SUPABASE_DB_URL" -f "$SQL_FILE"

  if [ $? -eq 0 ]; then
    echo ""
    print_success "Script exécuté avec succès!"

    if [ "$AUTO_MODE" = false ]; then
      echo ""
      print_warning "N'oubliez pas de:"
      echo "  1. Lire attentivement les logs ci-dessus"
      echo "  2. Exécuter COMMIT; pour confirmer"
      echo "  3. Ou ROLLBACK; pour annuler"
    fi
  else
    print_error "Erreur lors de l'exécution du script"
    exit 1
  fi
else
  print_error "psql n'est pas installé"
  echo "Veuillez exécuter le script manuellement via:"
  echo "  • Supabase SQL Editor"
  echo "  • ou installer PostgreSQL client"
  exit 1
fi

echo ""
print_header "Terminé"
echo ""
