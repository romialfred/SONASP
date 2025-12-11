/**
 * Convert numbers to words (English)
 * Supports up to billions with two decimal places
 */

const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

function convertLessThanThousand(num: number): string {
  if (num === 0) return '';

  let result = '';

  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundreds > 0) {
    result += ones[hundreds] + ' hundred';
    if (remainder > 0) result += ' and ';
  }

  if (remainder >= 10 && remainder < 20) {
    result += teens[remainder - 10];
  } else if (remainder >= 20) {
    const tensDigit = Math.floor(remainder / 10);
    const onesDigit = remainder % 10;
    result += tens[tensDigit];
    if (onesDigit > 0) result += '-' + ones[onesDigit];
  } else if (remainder > 0) {
    result += ones[remainder];
  }

  return result;
}

export function numberToWords(num: number): string {
  if (num === 0) return 'zero';

  // Handle negative numbers
  if (num < 0) return 'minus ' + numberToWords(Math.abs(num));

  // Split into integer and decimal parts
  const parts = num.toFixed(2).split('.');
  const integerPart = parseInt(parts[0]);
  const decimalPart = parseInt(parts[1]);

  let result = '';

  // Convert integer part
  if (integerPart >= 1000000000) {
    const billions = Math.floor(integerPart / 1000000000);
    result += convertLessThanThousand(billions) + ' billion';
    const remainder = integerPart % 1000000000;
    if (remainder > 0) result += ' ';

    if (remainder >= 1000000) {
      const millions = Math.floor(remainder / 1000000);
      result += convertLessThanThousand(millions) + ' million';
      const rem2 = remainder % 1000000;
      if (rem2 > 0) result += ' ';

      if (rem2 >= 1000) {
        const thousands = Math.floor(rem2 / 1000);
        result += convertLessThanThousand(thousands) + ' thousand';
        const rem3 = rem2 % 1000;
        if (rem3 > 0) result += ' ' + convertLessThanThousand(rem3);
      } else if (rem2 > 0) {
        result += convertLessThanThousand(rem2);
      }
    } else if (remainder >= 1000) {
      const thousands = Math.floor(remainder / 1000);
      result += convertLessThanThousand(thousands) + ' thousand';
      const rem2 = remainder % 1000;
      if (rem2 > 0) result += ' ' + convertLessThanThousand(rem2);
    } else if (remainder > 0) {
      result += convertLessThanThousand(remainder);
    }
  } else if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    result += convertLessThanThousand(millions) + ' million';
    const remainder = integerPart % 1000000;
    if (remainder > 0) result += ' ';

    if (remainder >= 1000) {
      const thousands = Math.floor(remainder / 1000);
      result += convertLessThanThousand(thousands) + ' thousand';
      const rem2 = remainder % 1000;
      if (rem2 > 0) result += ' ' + convertLessThanThousand(rem2);
    } else if (remainder > 0) {
      result += convertLessThanThousand(remainder);
    }
  } else if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    result += convertLessThanThousand(thousands) + ' thousand';
    const remainder = integerPart % 1000;
    if (remainder > 0) result += ' ' + convertLessThanThousand(remainder);
  } else {
    result += convertLessThanThousand(integerPart);
  }

  // Add decimal part if present
  if (decimalPart > 0) {
    result += ' dollars and ' + decimalPart + '/100 cents';
  } else {
    result += ' dollars';
  }

  return result.trim();
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Convert number to words with proper capitalization
 */
export function formatNumberInWords(num: number): string {
  const words = numberToWords(num);
  return capitalizeWords(words);
}
