/** Deterministic ID-1 artwork. No UI capture, external resources or member data in the QR. */
import { FONT_ADVANCES } from './affiliation-font-metrics.ts';
export const AFFILIATION_TEMPLATE = 'faso-sanama-id1-v1';
export const CARD_MM = { width: 85.6, height: 53.98 } as const;
export const CARD_PX = { width: 1011, height: 638, dpi: 300 } as const;
export interface CardArtwork {
  nom: string; prenoms: string; societe: string | null; role: string;
  site_nom: string; commune: string; numero_affiliation: string;
  valid_from: string | null; valid_until: string | null;
  issued_on?: string | null;
  activated: boolean; logo: string; photo: string; qr: string;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const date = (v: string | null) => v ? v.split('-').reverse().join('.') : 'Après activation';
const roleName: Record<string, string> = { exploitant: 'Exploitant', fournisseur: 'Fournisseur', aide_exploitant: 'Aide exploitant', intermediaire: 'Intermédiaire', collecteur: 'Collecteur' };
function text(value: string, x: number, y: number, size: number, width: number, bold = false): string {
  // Keep every character, scaling long names instead of ellipsizing an identity.
  const advances: Record<string, number> = FONT_ADVANCES[bold ? 'bold' : 'regular'];
  const emWidth = Array.from(value).reduce((sum, ch) => sum + (advances[ch] ?? 1.2), 0);
  const fontSize = Math.min(size, width / Math.max(1, emWidth * 1.04));
  return `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="${bold ? 700 : 400}">${esc(value)}</text>`;
}
function twoLines(value: string, x: number, y: number, size: number, width: number): string {
  const words = value.split(/\s+/); let cut = 1; let best = Infinity;
  const advances: Record<string, number> = FONT_ADVANCES.bold;
  const measure = (s: string) => Array.from(s).reduce((sum, ch) => sum + (advances[ch] ?? 1.2), 0);
  if (measure(value) * size * 1.04 <= width || words.length < 2) return text(value, x, y, size, width, true);
  for (let i = 1; i < words.length; i++) {
    const score = Math.max(measure(words.slice(0, i).join(' ')), measure(words.slice(i).join(' ')));
    if (score < best) { best = score; cut = i; }
  }
  return text(words.slice(0, cut).join(' '), x, y, size, width, true) + text(words.slice(cut).join(' '), x, y + 25, size, width, true);
}
function image(href: string, x: number, y: number, w: number, h: number, cover = false): string {
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(href)) throw new Error('Ressource graphique embarquée invalide.');
  return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid ${cover ? 'slice' : 'meet'}"/>`;
}
export function renderAffiliationSvg(data: CardArtwork, face: 'recto' | 'verso'): string {
  const waves = Array.from({ length: 22 }, (_, i) => `<path d="M${-90+i*13} 638 C${80+i*12} 405 ${560+i*15} 826 1040 ${205+i*12}"/>`).join('');
  // Header extracted from the supplied PDF: original wordmark, flag and face title.
  // No specimen portrait, identity, date or QR is contained in this immutable asset.
  const header = `<rect width="1011" height="165" fill="url(#gold)"/>${image(data.logo, 0, 0, 1011, 165)}<path d="M0 165H1011" stroke="#b98b22" stroke-width="2"/>`;
  const bottom = `<path d="M44 568H966" stroke="#af811c" stroke-width="2"/>
    ${text(face === 'recto' ? 'Filière artisanale de l’or' : 'Carte personnelle, à présenter lors des opérations.', 48, 592, 16, 715)}
    ${face === 'verso' ? text('En cas de perte, signalez-la au service d’affiliation.', 48, 614, 16, 715) : ''}
    ${!data.activated ? text('NON ACTIVÉE', 816, 613, 15, 150, true) : ''}`;
  let body: string;
  if (face === 'recto') {
    body = `<defs><clipPath id="portrait"><rect x="48" y="192" width="261" height="340" rx="12"/></clipPath></defs>
      <g clip-path="url(#portrait)">${image(data.photo, 48, 192, 261, 340, true)}</g><rect x="48" y="192" width="261" height="340" rx="12" fill="none" stroke="#b98b22"/>
      <rect x="344" y="193" width="315" height="43" rx="13" fill="#fffbee" stroke="#bd902c"/>
      ${text((roleName[data.role] || data.role).toLocaleUpperCase('fr'), 363, 222, 24, 279, true)}
      ${text('Nom', 350, 273, 17, 600)}${text(data.nom, 350, 310, 35, 615, true)}
      ${text('Prénom(s)', 350, 347, 17, 600)}${text(data.prenoms, 350, 384, 33, 615, true)}
      ${text('N° d’affiliation', 350, 422, 17, 600)}${text(data.numero_affiliation, 350, 456, 29, 615, true)}
      ${data.societe ? text(`Société : ${data.societe}`, 350, 483, 16, 615) : ''}
      ${text('Délivrée le', 350, 506, 16, 270)}${text(data.activated ? date(data.issued_on || null) : 'Non activée', 350, 538, 24, 270, true)}
      <path d="M650 490V545" stroke="#b98b22"/>${text('Valable jusqu’au', 681, 506, 16, 283)}${text(date(data.valid_until), 681, 538, 24, 283, true)}`;
  } else {
    body = `<rect x="46" y="192" width="263" height="259" rx="10" fill="white" stroke="#b98b22" stroke-width="2"/>
      ${image(data.qr, 59, 202, 237, 237)}${text('Scanner pour vérifier', 49, 482, 23, 272, true)}${text(data.numero_affiliation, 58, 514, 23, 255)}
      <path d="M344 195V532" stroke="#b98b22" stroke-width="2"/>
      ${text('Une affiliation vérifiable', 373, 246, 38, 592, true)}
      ${text('Scannez le QR code pour consulter', 376, 285, 25, 585)}${text('le statut de la carte.', 376, 317, 25, 585)}
      <path d="M376 338H966" stroke="#b98b22"/>
      ${text('Titulaire', 376, 375, 19, 322)}${twoLines(`${data.prenoms} ${data.nom}`, 376, 403, 24, 337)}
      ${text('Rôle dans la filière', 732, 375, 18, 230)}${text(roleName[data.role] || data.role, 732, 407, 26, 230, true)}
      ${text('Site de rattachement', 376, 458, 19, 337)}${twoLines(data.site_nom || 'Non rattaché', 376, 485, 24, 337)}
      ${text('Commune', 732, 458, 19, 230)}${text(data.commune || 'Non renseignée', 732, 490, 26, 230, true)}
      ${data.societe ? text(`Société : ${data.societe}`, 376, 524, 17, 585) : ''}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1011" height="638" viewBox="0 0 1011 638">
    <defs><linearGradient id="gold"><stop stop-color="#b68c24"/><stop offset=".38" stop-color="#f6dd77"/><stop offset=".63" stop-color="#ffefab"/><stop offset="1" stop-color="#c89e34"/></linearGradient><clipPath id="card"><rect x="2" y="2" width="1007" height="634" rx="26"/></clipPath></defs>
    <g clip-path="url(#card)" fill="#07132c" font-family="Roboto"><rect width="1011" height="638" fill="#fffef7"/>
    <g stroke="#c69839" stroke-width=".45" opacity=".36" fill="none">${waves}</g>${header}${body}${bottom}</g>
    <rect x="2" y="2" width="1007" height="634" rx="26" fill="none" stroke="#ae811c" stroke-width="2"/></svg>`;
}
