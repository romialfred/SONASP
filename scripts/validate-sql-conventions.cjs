#!/usr/bin/env node

/**
 * Script de Validation des Conventions SQL
 *
 * Vérifie que tous les scripts SQL respectent les conventions:
 * - Toutes les tables doivent avoir le préfixe snp_
 * - Pas de RAISE NOTICE en dehors des blocs DO $$
 * - Structure organisée
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Règles de validation
const validationRules = [
  {
    name: 'Préfixe SNP_ sur CREATE TABLE',
    pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?!snp_|storage\.|auth\.|pg_|information_schema)/gi,
    message: 'Les tables doivent commencer par snp_',
    severity: 'error',
  },
  {
    name: 'Préfixe SNP_ sur ALTER TABLE',
    pattern: /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?!snp_|storage\.|auth\.|pg_|information_schema)/gi,
    message: 'Les tables doivent commencer par snp_',
    severity: 'error',
  },
  {
    name: 'RAISE NOTICE hors DO block',
    pattern: /^[^$]*RAISE\s+NOTICE[^;]*;/gm,
    message: 'RAISE NOTICE doit être dans un bloc DO $$...$$',
    severity: 'error',
    validator: (content, match) => {
      const beforeMatch = content.substring(0, match.index);
      const openDoBlocks = (beforeMatch.match(/DO\s+\$\$/gi) || []).length;
      const closeDoBlocks = (beforeMatch.match(/END\s+\$\$/gi) || []).length;

      // Si on est dans un bloc DO (plus d'ouvertures que de fermetures)
      if (openDoBlocks > closeDoBlocks) {
        return null; // Pas d'erreur
      }
      return match;
    },
  },
  {
    name: 'Références FK sans préfixe SNP_',
    pattern: /REFERENCES\s+(?!snp_|auth\.|pg_|information_schema)(\w+)/gi,
    message: 'Les références FK doivent pointer vers des tables snp_',
    severity: 'warning',
  },
  {
    name: 'Bucket storage sans préfixe SNP-',
    pattern: /bucket_id\s*=\s*'(?!snp-)([^']+)'/gi,
    message: 'Les buckets storage doivent commencer par snp-',
    severity: 'error',
  },
  {
    name: 'INSERT INTO storage.buckets sans préfixe',
    pattern: /INSERT\s+INTO\s+storage\.buckets[^)]+VALUES\s*\(\s*'(?!snp-)([^']+)'/gi,
    message: 'Les buckets storage doivent commencer par snp-',
    severity: 'error',
  },
];

// Fichiers à ignorer
const ignoreFiles = [
  'database-schema.json',
  'README.md',
  'README-',
  'GUIDE-',
  'SQL-QUALITY-CHECKLIST.md',
  'ANALYSE-',
  'DIAGNOSTIC-',
  'EXAMPLE-',
  'INDEX-',
  'INSTRUCTIONS-',
  'RESUME-',
  'SETUP-',
  'COMMENT-FAIRE.md',
  'ERREUR-CORRIGEE',
];

// Fonction pour vérifier si un fichier doit être ignoré
function shouldIgnoreFile(filename) {
  return ignoreFiles.some(ignore => filename.includes(ignore));
}

// Fonction pour valider un fichier SQL
function validateSqlFile(filePath) {
  const filename = path.basename(filePath);

  if (shouldIgnoreFile(filename)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];

  // Vérifier chaque règle
  for (const rule of validationRules) {
    const matches = [...content.matchAll(rule.pattern)];

    for (const match of matches) {
      // Si la règle a un validateur personnalisé
      if (rule.validator) {
        const validatedMatch = rule.validator(content, match);
        if (!validatedMatch) continue;
      }

      const lineNumber = content.substring(0, match.index).split('\n').length;
      const violation = {
        rule: rule.name,
        message: rule.message,
        line: lineNumber,
        match: match[0].substring(0, 100),
      };

      if (rule.severity === 'error') {
        errors.push(violation);
      } else {
        warnings.push(violation);
      }
    }
  }

  return {
    filename,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}

// Fonction principale
function main() {
  log('\n========================================', 'cyan');
  log('  VALIDATION DES CONVENTIONS SQL', 'cyan');
  log('========================================\n', 'cyan');

  const scriptsDir = __dirname;
  const files = fs.readdirSync(scriptsDir)
    .filter(f => f.endsWith('.sql'))
    .map(f => path.join(scriptsDir, f));

  const results = files
    .map(validateSqlFile)
    .filter(r => r !== null);

  let totalErrors = 0;
  let totalWarnings = 0;
  let validFiles = 0;

  // Afficher les résultats
  for (const result of results) {
    if (result.valid && result.warnings.length === 0) {
      log(`✅ ${result.filename}`, 'green');
      validFiles++;
    } else {
      if (result.errors.length > 0) {
        log(`❌ ${result.filename}`, 'red');
        totalErrors += result.errors.length;

        for (const error of result.errors) {
          log(`   Ligne ${error.line}: ${error.message}`, 'red');
          log(`   Règle: ${error.rule}`, 'yellow');
          log(`   Code: ${error.match}`, 'reset');
        }
      }

      if (result.warnings.length > 0) {
        if (result.errors.length === 0) {
          log(`⚠️  ${result.filename}`, 'yellow');
        }
        totalWarnings += result.warnings.length;

        for (const warning of result.warnings) {
          log(`   Ligne ${warning.line}: ${warning.message}`, 'yellow');
          log(`   Règle: ${warning.rule}`, 'yellow');
          log(`   Code: ${warning.match}`, 'reset');
        }
      }
    }
  }

  // Résumé
  log('\n========================================', 'cyan');
  log('  RÉSUMÉ', 'cyan');
  log('========================================', 'cyan');
  log(`Fichiers analysés: ${results.length}`, 'blue');
  log(`Fichiers valides: ${validFiles}`, 'green');
  log(`Erreurs trouvées: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green');
  log(`Avertissements: ${totalWarnings}`, totalWarnings > 0 ? 'yellow' : 'green');
  log('========================================\n', 'cyan');

  // Code de sortie
  if (totalErrors > 0) {
    log('❌ Validation ÉCHOUÉE - Corrigez les erreurs avant de continuer', 'red');
    process.exit(1);
  } else {
    log('✅ Validation RÉUSSIE - Tous les scripts respectent les conventions', 'green');
    process.exit(0);
  }
}

// Exécuter
if (require.main === module) {
  main();
}

module.exports = { validateSqlFile };
