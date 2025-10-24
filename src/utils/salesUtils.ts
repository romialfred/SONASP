export interface SaleCalculation {
  quantity: number;
  londonAMRate: number;
  freightCost: number;
  otherCosts: number;
  grossProceeds: number;
  totalCosts: number;
  netProceeds: number;
  royalties: number;
  netSmeltedRoyalties: number;
  finalProceeds: number;
}

export function calculateSaleProceeds(
  quantityInOunces: number,
  londonAMRate: number,
  freightCost: number = 0,
  otherCosts: number = 0
): SaleCalculation {
  const grossProceeds = quantityInOunces * londonAMRate;
  const totalCosts = freightCost + otherCosts;
  const netProceeds = grossProceeds - totalCosts;
  const royalties = netProceeds * 0.03;
  const netSmeltedRoyalties = royalties;
  const finalProceeds = netProceeds - netSmeltedRoyalties;

  return {
    quantity: quantityInOunces,
    londonAMRate,
    freightCost,
    otherCosts,
    grossProceeds,
    totalCosts,
    netProceeds,
    royalties,
    netSmeltedRoyalties,
    finalProceeds,
  };
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatWeight(grams: number, unit: 'g' | 'oz' = 'g'): string {
  if (unit === 'oz') {
    const ounces = grams / 31.1035;
    return `${ounces.toFixed(3)} oz`;
  }
  return `${grams.toFixed(2)} g`;
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function calculateFXSpread(rate1: number, rate2: number): number {
  return Math.abs(rate1 - rate2) / rate1;
}

export interface CustomerPerformance {
  totalPurchases: number;
  totalSpent: number;
  averageOrderValue: number;
  onTimePaymentRate: number;
  lastPurchaseDate: Date | null;
}

export function calculateCustomerPerformance(
  purchases: Array<{
    amount: number;
    paymentDate: Date;
    expectedPaymentDate: Date;
  }>
): CustomerPerformance {
  if (purchases.length === 0) {
    return {
      totalPurchases: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      onTimePaymentRate: 0,
      lastPurchaseDate: null,
    };
  }

  const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
  const onTimePayments = purchases.filter(
    p => p.paymentDate <= p.expectedPaymentDate
  ).length;

  return {
    totalPurchases: purchases.length,
    totalSpent,
    averageOrderValue: totalSpent / purchases.length,
    onTimePaymentRate: onTimePayments / purchases.length,
    lastPurchaseDate: purchases[purchases.length - 1]?.paymentDate || null,
  };
}
