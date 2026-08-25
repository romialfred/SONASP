const ORIGINES_PAR_DEFAUT = [
  'https://sonasp.data-univers.com',
  'https://sonasp.vercel.app',
  'http://127.0.0.1:5180',
  'http://localhost:5180',
];

function originesAutorisees(): Set<string> {
  const environnement = (globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (nom: string) => string | undefined } };
  }).Deno?.env;
  const configurees = [
    environnement?.get?.('ALLOWED_ORIGINS'),
    environnement?.get?.('ALLOWED_ORIGIN'),
  ]
    .filter(Boolean)
    .flatMap((valeur) => String(valeur).split(','))
    .map((valeur) => valeur.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return new Set([...ORIGINES_PAR_DEFAUT, ...configurees]);
}

/**
 * CORS strict pour les fonctions administratives.
 *
 * Les fonctions vérifient elles-mêmes le JWT afin que le relais Supabase ne
 * rejette pas la requête OPTIONS, qui ne contient volontairement aucun jeton.
 */
export function origineAutorisee(req: Request): string | null {
  const origine = req.headers.get('Origin')?.replace(/\/$/, '') ?? null;
  if (!origine) return null;
  if (originesAutorisees().has(origine)) return origine;

  // Les aperçus Vercel de ce projet sont éphémères. On n'autorise pas tous les
  // domaines vercel.app : uniquement le projet SONASP.
  try {
    const url = new URL(origine);
    if (url.protocol === 'https:' && /^(?:sonasp(?:-[a-z0-9-]+)?|sonasp-git-[a-z0-9-]+)\.vercel\.app$/i.test(url.hostname)) {
      return origine;
    }
  } catch {
    return null;
  }

  return null;
}

export function entetesCors(req: Request): HeadersInit {
  const origine = origineAutorisee(req);
  return {
    ...(origine ? { 'Access-Control-Allow-Origin': origine } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-upload-metadata',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function reponsePrevol(req: Request): Response {
  if (req.headers.get('Origin') && !origineAutorisee(req)) {
    return new Response(JSON.stringify({ error: 'Origine non autorisée.' }), {
      status: 403,
      headers: { ...entetesCors(req), 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 204, headers: entetesCors(req) });
}

export function reponseJson(req: Request, corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      ...entetesCors(req),
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
