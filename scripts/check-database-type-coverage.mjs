import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const propertyName = (node) => {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return undefined;
};

const memberType = (typeNode, name) => {
  if (!typeNode || !ts.isTypeLiteralNode(typeNode)) return undefined;
  const member = typeNode.members.find(
    (candidate) => ts.isPropertySignature(candidate) && propertyName(candidate.name) === name,
  );
  return member?.type;
};

export function databaseRelationNames(sourceText, fileName = 'database.ts') {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const databaseAlias = source.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Database',
  );

  if (!databaseAlias) {
    throw new Error(`Le type Database est introuvable dans ${fileName}.`);
  }

  const publicSchema = memberType(databaseAlias.type, 'public');
  const relations = new Set();

  for (const sectionName of ['Tables', 'Views']) {
    const section = memberType(publicSchema, sectionName);
    if (!section || !ts.isTypeLiteralNode(section)) continue;
    for (const member of section.members) {
      if (!ts.isPropertySignature(member)) continue;
      const name = propertyName(member.name);
      if (name) relations.add(name);
    }
  }

  return relations;
}

export function directSupabaseRelations(sourceText, fileName = 'source.ts') {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const references = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'supabase' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const position = source.getLineAndCharacterOfPosition(node.arguments[0].getStart(source));
      references.push({
        relation: node.arguments[0].text,
        file: fileName,
        line: position.line + 1,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return references;
}

const sourceFiles = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(target));
    else if (/\.tsx?$/u.test(entry.name)) files.push(target);
  }
  return files;
};

export function findMissingRelations({ sourceDirectory, databaseFile }) {
  const databaseRelations = databaseRelationNames(
    fs.readFileSync(databaseFile, 'utf8'),
    databaseFile,
  );
  const references = sourceFiles(sourceDirectory).flatMap((file) =>
    directSupabaseRelations(fs.readFileSync(file, 'utf8'), file),
  );

  return references
    .filter(({ relation }) => !databaseRelations.has(relation))
    .sort((left, right) =>
      left.relation.localeCompare(right.relation) ||
      left.file.localeCompare(right.file) ||
      left.line - right.line,
    );
}

export function runCoverageCheck({ cwd = process.cwd() } = {}) {
  const sourceDirectory = path.join(cwd, 'src');
  const databaseFile = path.join(sourceDirectory, 'types', 'database.ts');
  const missing = findMissingRelations({ sourceDirectory, databaseFile });

  if (missing.length === 0) {
    console.log('Couverture des types Supabase valide : toutes les relations directes sont typées.');
    return 0;
  }

  const grouped = new Map();
  for (const reference of missing) {
    if (!grouped.has(reference.relation)) grouped.set(reference.relation, []);
    grouped.get(reference.relation).push(reference);
  }

  console.error(
    `Couverture des types Supabase invalide : ${grouped.size} relation(s) utilisée(s) par supabase.from() sont absentes de Database.public.Tables/Views.`,
  );
  for (const [relation, references] of grouped) {
    const locations = references
      .slice(0, 3)
      .map(({ file, line }) => `${path.relative(cwd, file)}:${line}`)
      .join(', ');
    const suffix = references.length > 3 ? ` (+${references.length - 3})` : '';
    console.error(`- ${relation}: ${locations}${suffix}`);
  }
  console.error(
    'Régénérez src/types/database.ts depuis le schéma versionné avant de lancer le compilateur TypeScript.',
  );
  return 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = runCoverageCheck();
