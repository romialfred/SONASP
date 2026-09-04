import { TROY_OZ_GRAMS, GOLD_ROYALTY_RATE } from '@/constants/goldConstants';

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatWeight(grams: number, _unit?: 'g' | 'oz'): string {
  // Always display in oz with grams equivalent (new platform standard)
  const ounces = grams / TROY_OZ_GRAMS;
  return `${formatNumber(ounces, 3)} oz (${formatNumber(grams, 2)} g)`;
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${formatNumber(value, decimals)} %`;
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

export function calculateGrossProceeds(
  weight: number,
  pricePerOz: number
): number {
  return weight * pricePerOz;
}

export function calculateNetProceeds(
  grossProceeds: number,
  freight: number = 0,
  otherCosts: number = 0
): number {
  return grossProceeds - freight - otherCosts;
}

export function calculateRoyalties(netProceeds: number, royaltyRate: number = GOLD_ROYALTY_RATE): number {
  return netProceeds * royaltyRate;
}

export function convertGramsToOunces(grams: number): number {
  return grams / TROY_OZ_GRAMS;
}

export function convertOuncesToGrams(ounces: number): number {
  return ounces * TROY_OZ_GRAMS;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export interface SaleProceedsCalculation {
  grossProceeds: number;
  freight: number;
  otherCosts: number;
  netProceeds: number;
  royalties: number;
  finalAmount: number;
}

export function calculateSaleProceeds(
  weight: number,
  pricePerOz: number,
  freight: number = 0,
  otherCosts: number = 0,
  royaltyRate: number = GOLD_ROYALTY_RATE
): SaleProceedsCalculation {
  const grossProceeds = calculateGrossProceeds(weight, pricePerOz);
  const netProceeds = calculateNetProceeds(grossProceeds, freight, otherCosts);
  const royalties = calculateRoyalties(netProceeds, royaltyRate);
  const finalAmount = netProceeds - royalties;

  return {
    grossProceeds,
    freight,
    otherCosts,
    netProceeds,
    royalties,
    finalAmount,
  };
}

export function calculateFXSpread(
  customerRate: number,
  marketRate: number
): number {
  if (marketRate === 0) return 0;
  return ((customerRate - marketRate) / marketRate) * 100;
}
