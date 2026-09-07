import { COUNTRIES } from '@/constants/countries';

// Labels only: existing country strings remain the values sent to the API.
const regionCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const english = new Intl.DisplayNames(['en'], { type: 'region' });
const french = new Intl.DisplayNames(['fr'], { type: 'region' });
const regions = new Map(regionCodes.map(code => [english.of(code), code]));
const historicalNames: Record<string, string> = {
  'Ivory Coast': 'CI', 'East Timor (Timor-Leste)': 'TL', 'Turkey': 'TR',
  'Congo': 'CG', 'Democratic Republic of the Congo': 'CD', 'Myanmar': 'MM',
  'Cabo Verde': 'CV', 'Micronesia': 'FM', 'Vatican City': 'VA', 'Palestine': 'PS',
  'Antigua and Barbuda': 'AG', 'Bosnia and Herzegovina': 'BA', 'Czech Republic': 'CZ',
  'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent and the Grenadines': 'VC',
  'Sao Tome and Principe': 'ST', 'Trinidad and Tobago': 'TT',
};

export function customerCountryLabel(value: string): string {
  const region = historicalNames[value] ?? regions.get(value);
  return region ? french.of(region) ?? value : value;
}

export const CUSTOMER_COUNTRY_OPTIONS = COUNTRIES.map(value => ({ value, label: customerCountryLabel(value) }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
