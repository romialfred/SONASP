#!/usr/bin/env node

/**
 * VALIDATEUR SQL - Vérifie que RAISE est toujours dans un bloc DO $$
 *
 * RÈGLE: RAISE NOTICE ne peut être utilisé QUE dans un bloc PL/pgSQL (DO $$...$$)
 *
 * Usage: node validate-sql-scripts.mjs <file.sql>
 *        node validate-sql-scripts.mjs --all (valide tous les .sql)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

class SQLValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.filesChecked = 0;
  }

  /**
   * Valide un fichier SQL
   */
  validateFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let inDoBlock = false;
    let doBlockDepth = 0;
    let inComment = false;
    let inString = false;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Check for multi-line comments
      if (trimmed.startsWith('/*')) {
        inComment = true;
      }
      if (trimmed.includes('*/')) {
        inComment = false;
        continue;
      }
      if (inComment) continue;

      // Skip single-line comments
      if (trimmed.startsWith('--')) continue;

      // Detect DO $$ blocks
      if (trimmed.includes('DO $$') || trimmed.includes('DO $function$')) {
        inDoBlock = true;
        doBlockDepth++;
      }

      // Detect end of DO blocks
      if ((trimmed.includes('END $$') || trimmed.includes('$$ LANGUAGE') || trimmed.includes('$$;')) && inDoBlock) {
        doBlockDepth--;
        if (doBlockDepth === 0) {
          inDoBlock = false;
        }
      }

      // Check for RAISE outside DO blocks
      if (trimmed.match(/\bRAISE\s+(NOTICE|WARNING|EXCEPTION|INFO|LOG|DEBUG)\b/i)) {
        if (!inDoBlock) {
          this.errors.push({
            file: filePath,
            line: lineNum,
            content: line,
            message: 'RAISE utilisé en dehors d\'un bloc DO $$'
          });
        }
      }

      // Warn about SELECT for messages (should use RAISE in DO block)
      if (trimmed.match(/^SELECT\s+'.*'\s*;?\s*$/)) {
        this.warnings.push({
          file: filePath,
          line: lineNum,
          content: line,
          message: 'SELECT utilisé pour afficher un message (préférez RAISE NOTICE dans DO $$)'
        });
      }
    }

    this.filesChecked++;
  }

  /**
   * Valide tous les fichiers .sql dans un répertoire
   */
  validateDirectory(dirPath, recursive = true) {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && recursive) {
        // Skip node_modules, .git, etc.
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        this.validateDirectory(fullPath, recursive);
      } else if (stat.isFile() && entry.endsWith('.sql')) {
        this.validateFile(fullPath);
      }
    }
  }

  /**
   * Affiche le rapport
   */
  report() {
    console.log(`\n${BLUE}=== VALIDATION SQL ===${RESET}\n`);
    console.log(`Fichiers vérifiés: ${this.filesChecked}\n`);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(`${GREEN}✓ AUCUNE ERREUR TROUVÉE${RESET}\n`);
      return true;
    }

    if (this.errors.length > 0) {
      console.log(`${RED}✗ ${this.errors.length} ERREUR(S) TROUVÉE(S):${RESET}\n`);

      for (const error of this.errors) {
        console.log(`${RED}ERREUR:${RESET} ${relative(process.cwd(), error.file)}:${error.line}`);
        console.log(`  ${error.message}`);
        console.log(`  ${YELLOW}${error.content.trim()}${RESET}\n`);
      }
    }

    if (this.warnings.length > 0) {
      console.log(`${YELLOW}⚠ ${this.warnings.length} AVERTISSEMENT(S):${RESET}\n`);

      for (const warning of this.warnings) {
        console.log(`${YELLOW}ATTENTION:${RESET} ${relative(process.cwd(), warning.file)}:${warning.line}`);
        console.log(`  ${warning.message}`);
        console.log(`  ${warning.content.trim()}\n`);
      }
    }

    return this.errors.length === 0;
  }

  /**
   * Affiche l'aide
   */
  static showHelp() {
    console.log(`
${BLUE}VALIDATEUR SQL - Vérification RAISE dans DO $$${RESET}

${GREEN}Usage:${RESET}
  node validate-sql-scripts.mjs <fichier.sql>     Valide un fichier
  node validate-sql-scripts.mjs --all             Valide tous les .sql du projet
  node validate-sql-scripts.mjs --dir <chemin>    Valide un répertoire

${GREEN}Règles vérifiées:${RESET}
  ${RED}✗${RESET} RAISE en dehors d'un bloc DO $$        → ERREUR
  ${YELLOW}⚠${RESET} SELECT '...' pour afficher un message  → AVERTISSEMENT

${GREEN}Exemple de code CORRECT:${RESET}
  ${GREEN}DO $$
  BEGIN
    RAISE NOTICE 'Message valide';
  END $$;${RESET}

${RED}Exemple de code INCORRECT:${RESET}
  ${RED}DROP TABLE foo;
  RAISE NOTICE 'Message invalide';  -- ERREUR!${RESET}

${GREEN}Fix:${RESET}
  ${GREEN}DROP TABLE foo;
  DO $$
  BEGIN
    RAISE NOTICE 'Message valide';
  END $$;${RESET}
`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  SQLValidator.showHelp();
  process.exit(0);
}

const validator = new SQLValidator();

if (args[0] === '--all') {
  console.log(`${BLUE}Validation de tous les fichiers .sql du projet...${RESET}`);
  validator.validateDirectory(process.cwd());
} else if (args[0] === '--dir') {
  if (!args[1]) {
    console.error(`${RED}Erreur: --dir nécessite un chemin${RESET}`);
    process.exit(1);
  }
  validator.validateDirectory(args[1]);
} else {
  // Valider un fichier spécifique
  validator.validateFile(args[0]);
}

const success = validator.report();
process.exit(success ? 0 : 1);
