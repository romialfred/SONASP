// Read-only inspection of a pg_dump schema for the historical development dataset.
import { readFileSync } from 'node:fs';

const [path, mode = 'tables', ...names] = process.argv.slice(2);
if (!path) throw new Error('Usage: node inspect-schema.mjs <schema.sql> tables|functions|triggers [names...]');
const sql = readFileSync(path, 'utf8');
if (mode === 'tables' || mode === 'columns') {
  for (const match of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "public"\."([^"]+)" \(([\s\S]*?)\n\);/g)) {
    if (!names.length) console.log(match[1]);
    else if (names.includes(match[1])) console.log(match[0]);
  }
  if (mode === 'tables' && names.length) for (const match of sql.matchAll(/ALTER TABLE ONLY "public"\."([^"]+)"\n\s+ADD CONSTRAINT [\s\S]*?;/g)) {
    if (names.includes(match[1])) console.log(match[0]);
  }
} else if (mode === 'functions') {
  for (const match of sql.matchAll(/CREATE OR REPLACE FUNCTION "public"\."([^"]+)"[\s\S]*?\nALTER FUNCTION [^\n]+/g)) {
    if (names.some(name => match[1] === name)) console.log(match[0]);
  }
} else if (mode === 'triggers') {
  for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?(?:CONSTRAINT )?TRIGGER[^\n]+/g)) {
    if (!names.length || names.some(name => match[0].includes(`ON "public"."${name}"`))) console.log(match[0]);
  }
} else throw new Error('Unknown inspection mode');
