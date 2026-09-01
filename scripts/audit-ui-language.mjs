import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Read-only inventory of potential French UI copy, not an automatic translation.
// References, identifiers, database values and comments are never rewritten.
const root = process.argv[2] || 'src';
const findings = [];
const french = /[àâçéèêëîïôùûüœ]|\b(?:Aucun|Aucune|Veuillez|Annuler|Enregistrer|Ajouter|Supprimer|Modifier|Retour|Chargement|Erreur|Tous|Toutes|Voir|Statut|Montant|Fermer|Compte|Nouvelle|Nouveau|Choisir)\b/iu;
function inspect(file) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const copy = node.text.trim();
      if (french.test(copy) && copy.length > 2 && copy.length < 800) {
        findings.push({ file: file.replaceAll('\\', '/'), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text: copy });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file)) inspect(file);
  }
}
walk(root);
const byFile = Object.fromEntries([...new Set(findings.map(item => item.file))].map(file => [file, findings.filter(item => item.file === file).length]));
console.log(JSON.stringify(process.argv.includes('--details') ? { candidates: findings.length, findings } : { candidates: findings.length, files: byFile }, null, 2));
