import { describe, expect, it } from 'vitest';
import { CUSTOMER_COUNTRY_OPTIONS, customerCountryLabel } from './customerCountryLabels';

describe('Libellés des pays clients', () => {
  it('traduit les libellés sans changer les valeurs du contrat existant', () => {
    expect(CUSTOMER_COUNTRY_OPTIONS.find(option => option.value === 'Ivory Coast')?.label).toBe('Côte d’Ivoire');
    expect(CUSTOMER_COUNTRY_OPTIONS.find(option => option.value === 'Switzerland')?.label).toBe('Suisse');
    expect(customerCountryLabel('United Arab Emirates')).toBe('Émirats arabes unis');
    expect(customerCountryLabel('Guinea')).toBe('Guinée');
    expect(customerCountryLabel('Papua New Guinea')).toBe('Papouasie-Nouvelle-Guinée');
  });
  it('préserve les libellés historiques français et les valeurs hors catalogue', () => {
    expect(customerCountryLabel('Suisse')).toBe('Suisse');
    expect(customerCountryLabel('Valeur historique')).toBe('Valeur historique');
  });
});
