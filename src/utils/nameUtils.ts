/**
 * Formate un nom en mettant le nom de famille en majuscules
 * et les prénoms avec seulement la première lettre en majuscule
 *
 * Exemple: "GEOFFREY PETER EYE" -> "Geoffrey Peter EYE"
 *          "SIDIKI SIDIBE" -> "Sidiki SIDIBE"
 */
export function formatSignatoryName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }

  const words = fullName.trim().split(/\s+/);

  if (words.length === 0) {
    return '';
  }

  if (words.length === 1) {
    return words[0].toUpperCase();
  }

  // Le dernier mot est le nom de famille (en MAJUSCULES)
  const lastName = words[words.length - 1].toUpperCase();

  // Les autres mots sont les prénoms (capitalize seulement)
  const firstNames = words.slice(0, -1).map(word => {
    if (word.length === 0) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return [...firstNames, lastName].join(' ');
}

/**
 * Capitalise la première lettre de chaque mot
 */
export function capitalizeWords(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
