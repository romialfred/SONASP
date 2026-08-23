const cryptoApi = () => {
  const value = globalThis.crypto;
  if (!value || typeof value.getRandomValues !== 'function') {
    throw new Error('Générateur aléatoire cryptographique indisponible.');
  }
  return value;
};

/** Produit un identifiant local non prédictible sans dépendance externe. */
export function secureRandomId(): string {
  const api = cryptoApi();
  if (typeof api.randomUUID === 'function') return api.randomUUID();

  const bytes = new Uint8Array(16);
  api.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Produit un code numérique uniforme destiné aux références de sécurité. */
export function secureNumericCode(length: number): string {
  if (!Number.isInteger(length) || length < 1 || length > 128) {
    throw new Error('Longueur de code de sécurité invalide.');
  }

  const api = cryptoApi();
  let result = '';
  while (result.length < length) {
    const bytes = new Uint8Array(Math.max(16, length - result.length));
    api.getRandomValues(bytes);
    for (const value of bytes) {
      // 250 est le plus grand multiple de 10 inférieur à 256 : cela évite le biais modulo.
      if (value < 250) result += String(value % 10);
      if (result.length === length) break;
    }
  }
  return result;
}
