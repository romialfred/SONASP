export function gramsToOunces(grams: number): number {
  const ouncesPerGram = 0.03527396195;
  return Math.round(grams * ouncesPerGram * 100) / 100;
}

export function ouncesToGrams(ounces: number): number {
  const gramsPerOunce = 28.349523125;
  return Math.round(ounces * gramsPerOunce * 100) / 100;
}

export function generateBatchNumber(country: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const countryCode = country.substring(0, 2).toUpperCase();
  const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

  return `BT-${year}${month}-${countryCode}-${randomId}`;
}

export function calculateVariance(expected: number, actual: number): {
  difference: number;
  percentage: number;
  isSignificant: boolean;
} {
  const difference = actual - expected;
  const percentage = expected !== 0 ? Math.round((difference / expected) * 10000) / 100 : 0;
  const isSignificant = Math.abs(percentage) > 2;

  return {
    difference: Math.round(difference * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
    isSignificant,
  };
}

export function formatWeight(grams: number, showBoth: boolean = true): string {
  const ounces = gramsToOunces(grams);

  if (showBoth) {
    return `${grams.toFixed(2)}g (${ounces.toFixed(2)} oz)`;
  }

  return `${grams.toFixed(2)}g`;
}

export function calculateFinalFine(
  postMeltingWeight: number,
  fineness: number,
  metalRetained: number
): {
  finalFineGrams: number;
  finalFineOunces: number;
} {
  const finalFineGrams = (postMeltingWeight * (fineness / 100) * (metalRetained / 100));
  const finalFineOunces = gramsToOunces(finalFineGrams);

  return {
    finalFineGrams: Math.round(finalFineGrams * 100) / 100,
    finalFineOunces: Math.round(finalFineOunces * 100) / 100,
  };
}
