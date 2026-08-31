#!/usr/bin/env node
// Non-mutating release probes: no valid credentials, account payload or email.
import assert from 'node:assert/strict';

const endpoint = 'https://yyverzuhkdonjjuficor.supabase.co/functions/v1/create-user';
const allowedOrigin = 'http://127.0.0.1:5180';
const probes = [
  { name: 'method-not-allowed', method: 'GET', expected: 405 },
  { name: 'missing-session', method: 'POST', expected: 401 },
  { name: 'invalid-session', method: 'POST', expected: 401,
    headers: { Authorization: 'Bearer deliberately-invalid-deployment-probe' } },
  { name: 'allowed-preflight', method: 'OPTIONS', expected: 204,
    headers: { Origin: allowedOrigin, 'Access-Control-Request-Method': 'POST' } },
  { name: 'forbidden-preflight', method: 'OPTIONS', expected: 403,
    headers: { Origin: 'https://unauthorized-deployment-probe.invalid',
      'Access-Control-Request-Method': 'POST' } },
];

const results = [];
for (const probe of probes) {
  const response = await fetch(endpoint, {
    method: probe.method,
    headers: { ...(probe.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...probe.headers },
    ...(probe.method === 'POST' ? { body: '{}' } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  await response.arrayBuffer();
  assert.equal(response.status, probe.expected, `${probe.name}: unexpected HTTP status`);
  const origin = response.headers.get('access-control-allow-origin');
  if (probe.name === 'allowed-preflight') assert.equal(origin, allowedOrigin);
  if (probe.name === 'forbidden-preflight') assert.equal(origin, null);
  if (probe.method !== 'OPTIONS') {
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  }
  results.push({ name: probe.name, status: response.status, passed: true });
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), endpoint, results,
  note: 'Contrôles négatifs uniquement ; ne prouvent pas la création authentifiée ni la livraison SMTP.',
}, null, 2));
