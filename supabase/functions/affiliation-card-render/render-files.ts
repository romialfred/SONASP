import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
import QRCode from 'npm:qrcode@1.5.4';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { PNG } from 'npm:pngjs@7.0.0';
import jpeg from 'npm:jpeg-js@0.4.4';
import { Buffer } from 'node:buffer';
import { renderAffiliationSvg, CARD_MM, type CardArtwork } from '../_shared/affiliation-card-template.ts';

export const base64 = (bytes: Uint8Array): string => {
  let raw = '';
  for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
};
const dataUrl = (bytes: Uint8Array, mime = 'image/png') => `data:${mime};base64,${base64(bytes)}`;
const readAsset = (name: string) => Deno.readFile(new URL(`./assets/${name}`, import.meta.url));
let ready: Promise<void> | undefined;
function png(svg: string, fonts: Uint8Array[]): Uint8Array {
  const renderer = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Roboto' }, dpi: 300 });
  const rendered = renderer.render();
  try { return withPrintDensity(rendered.asPng()); } finally { rendered.free(); renderer.free(); }
}
/** PNG physical pixel density, matching the separately fixed ID-1 PDF dimensions. */
function withPrintDensity(bytes: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(21); const view = new DataView(chunk.buffer);
  view.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4);
  view.setUint32(8, 11811); view.setUint32(12, 11811); chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const result = new Uint8Array(bytes.length + 21); result.set(bytes.subarray(0, 33)); result.set(chunk, 33); result.set(bytes.subarray(33), 54); return result;
}
function validatePhoto(bytes: Uint8Array, mime: string) {
  if (bytes.length < 24 || bytes.length > 5242880) throw new Error('Photographie invalide');
  if (mime === 'image/png') {
    if (![137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) throw new Error('Photographie PNG invalide');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16); const height = view.getUint32(20);
    if (!width || !height || width * height > 16_000_000) throw new Error('Dimensions de photographie invalides');
    PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
  } else if (mime === 'image/jpeg') {
    if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Photographie JPEG invalide');
    jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 16, maxMemoryUsageInMB: 128, tolerantDecoding: false });
  } else throw new Error('Format de photographie invalide');
}
export interface RenderInput {
  snapshot: Omit<CardArtwork, 'valid_from' | 'valid_until' | 'activated' | 'photo' | 'qr' | 'logo'>;
  valid_from: string | null; valid_until: string | null; activated_at: string | null;
  issued_on?: string | null;
  verification_token: string;
}
export async function generateAffiliationFiles(card: RenderInput, photoBytes: Uint8Array, photoMime: string, publicOrigin: string) {
  const verificationOrigin = new URL(publicOrigin);
  if (verificationOrigin.protocol !== 'https:' || /^(localhost|127\.|0\.|\[::1\])/.test(verificationOrigin.hostname) || verificationOrigin.hostname.endsWith('.localhost') || verificationOrigin.pathname !== '/' || verificationOrigin.search || verificationOrigin.hash || verificationOrigin.username || verificationOrigin.password) throw new Error('Origine de vérification invalide');
  validatePhoto(photoBytes, photoMime);
  ready ??= initWasm(readAsset('resvg.wasm')); await ready;
  const [regular, bold, rectoHeader, versoHeader] = await Promise.all([readAsset('Roboto-Regular.ttf'), readAsset('Roboto-Bold.ttf'), readAsset('header-recto.png'), readAsset('header-verso.png')]);
  const fonts = [regular, bold];
  const photo = dataUrl(photoBytes, photoMime);
  const portrait = png(`<svg xmlns="http://www.w3.org/2000/svg" width="522" height="680"><image href="${photo}" width="522" height="680" preserveAspectRatio="xMidYMid slice"/></svg>`, fonts);
  const qrUrl = `${verificationOrigin.origin}/verifier-carte/${card.verification_token}`;
  const qr = await QRCode.toDataURL(qrUrl, { width: 472, margin: 4, errorCorrectionLevel: 'M' });
  const artwork: CardArtwork = { ...card.snapshot, valid_from: card.valid_from, valid_until: card.valid_until, issued_on: card.issued_on, activated: Boolean(card.activated_at), photo: dataUrl(portrait), qr, logo: dataUrl(rectoHeader) };
  const recto = png(renderAffiliationSvg(artwork, 'recto'), fonts);
  const verso = png(renderAffiliationSvg({ ...artwork, logo: dataUrl(versoHeader) }, 'verso'), fonts);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_MM.width, CARD_MM.height], compress: true });
  pdf.addImage(recto, 'PNG', 0, 0, CARD_MM.width, CARD_MM.height);
  pdf.addPage([CARD_MM.width, CARD_MM.height], 'landscape');
  pdf.addImage(verso, 'PNG', 0, 0, CARD_MM.width, CARD_MM.height);
  return { recto, verso, pdf: new Uint8Array(pdf.output('arraybuffer')), portrait };
}
