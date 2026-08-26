/**
 * Utilitaires pour le formatage des dates
 * Format standard de la plateforme: "27-oct-25"
 */

/**
 * Formatte une date au format standard de la plateforme: "DD-mmm-YY"
 * Exemple: "27-oct-25"
 *
 * @param date - Date à formater (Date, string ISO, ou null)
 * @param locale - Locale à utiliser ('fr' par défaut)
 * @returns Date formatée au format "DD-mmm-YY"
 */
export function formatDateStandard(date: Date | string | null | undefined, locale: string = 'fr'): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString(locale, { month: 'short' }).toLowerCase();
    const year = d.getFullYear().toString().slice(-2);

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formatte une date au format court: "DD/MM/YYYY"
 * Exemple: "27/10/2025"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formatte une date au format long: "27 octobre 2025"
 */
export function formatDateLong(date: Date | string | null | undefined, locale: string = 'fr'): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formatte une date au format complet avec jour de semaine: "lundi 27 octobre 2025"
 */
export function formatDateFull(date: Date | string | null | undefined, locale: string = 'fr'): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    return d.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Formatte une date avec heure: "27-oct-25 14:30"
 */
export function formatDateTimeStandard(date: Date | string | null | undefined, locale: string = 'fr'): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const dateStr = formatDateStandard(d, locale);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');

    return `${dateStr} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
}

/**
 * Formatte une plage de dates: "27-oct-25 - 30-oct-25"
 */
export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  locale: string = 'fr'
): string {
  const start = formatDateStandard(startDate, locale);
  const end = formatDateStandard(endDate, locale);

  if (!start && !end) return '';
  if (!start) return end;
  if (!end) return start;

  return `${start} - ${end}`;
}

/**
 * Formatte une date relative: "il y a 2 jours", "dans 3 jours"
 */
export function formatDateRelative(date: Date | string | null | undefined, _locale: string = 'fr'): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Demain";
    if (diffDays === -1) return "Hier";
    if (diffDays > 0) return `Dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    return `Il y a ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? 's' : ''}`;
  } catch (error) {
    console.error('Error formatting relative date:', error);
    return '';
  }
}

/**
 * Parse une date au format standard "DD-mmm-YY" vers Date
 */
export function parseDateStandard(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Essayer de parser le format "27-oct-25"
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);

    // Map des mois français
    const months: Record<string, number> = {
      'jan': 0, 'janv': 0, 'fév': 1, 'mar': 2, 'mars': 2, 'avr': 3,
      'mai': 4, 'jun': 5, 'juin': 5, 'jul': 6, 'juil': 6, 'aoû': 7,
      'août': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11
    };

    const month = months[monthStr];
    if (month === undefined) return null;

    // Année sur 2 chiffres -> ajouter 2000
    const fullYear = year < 100 ? 2000 + year : year;

    return new Date(fullYear, month, day);
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * Vérifie si une date est valide
 */
export function isValidDate(date: any): boolean {
  if (!date) return false;

  try {
    const d = date instanceof Date ? date : new Date(date);
    return !isNaN(d.getTime());
  } catch {
    return false;
  }
}

/**
 * Retourne la date du jour au format standard
 */
export function getTodayStandard(locale: string = 'fr'): string {
  return formatDateStandard(new Date(), locale);
}

/**
 * Retourne le premier jour du mois en cours au format standard
 */
export function getFirstDayOfMonth(date: Date | string = new Date(), locale: string = 'fr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return formatDateStandard(firstDay, locale);
}

/**
 * Retourne le dernier jour du mois en cours au format standard
 */
export function getLastDayOfMonth(date: Date | string = new Date(), locale: string = 'fr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return formatDateStandard(lastDay, locale);
}
