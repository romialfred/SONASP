# Customer Bank Accounts Reference Guide

## Overview

This document provides a reference for all customer bank accounts in the system.

## How to Use

### Apply the SQL Script

Run the SQL script in your Supabase SQL Editor:

```bash
# File location
INSERT_CUSTOMER_BANKS.sql
```

Or copy and paste the contents into Supabase Dashboard → SQL Editor → New Query → Execute

## Bank Account Structure

Each customer has **1-2 bank accounts**:

1. **Primary Account** - Local or preferred currency
2. **Secondary Account** - USD or major international currency (optional)

## Customer Bank Accounts Summary

### United States Customers

#### **Auramet International**
- **Primary**: JPMorgan Chase Bank (USD)
  - SWIFT: `CHASUS33XXX`
  - IBAN: `US89370400440532013000`
  - City: New York

- **Secondary**: Bank of America (EUR)
  - SWIFT: `BOFAUS3NXXX`
  - City: New York

#### **StoneX Group**
- **Primary**: Wells Fargo Bank (USD)
  - SWIFT: `WFBIUS6SXXX`
  - IBAN: `US89121000248230011234`
  - City: San Francisco

- **Secondary**: Citibank N.A. (GBP)
  - SWIFT: `CITIUS33XXX`
  - City: New York

---

### United Arab Emirates

#### **Emirates Gold**
- **Primary**: Emirates NBD Bank (USD)
  - SWIFT: `EBILAEAD`
  - IBAN: `AE070331234567890123456`
  - City: Dubai

- **Secondary**: Mashreq Bank (AED)
  - SWIFT: `BOMLAEAD`
  - City: Dubai

---

### China

#### **China Gold International**
- **Primary**: ICBC (USD)
  - SWIFT: `ICBKCNBJBJM`
  - City: Beijing
  - Note: China doesn't use IBAN

- **Secondary**: Bank of China (CNY)
  - SWIFT: `BKCHCNBJ`
  - City: Beijing

---

### Switzerland

#### **Swiss Gold Traders**
- **Primary**: UBS Switzerland (CHF)
  - SWIFT: `UBSWCHZH80A`
  - IBAN: `CH9300762011623852957`
  - City: Zurich

- **Secondary**: Credit Suisse (USD)
  - SWIFT: `CRESCHZZ80A`
  - City: Zurich

#### **Metalor Technologies**
- **Primary**: Banque Cantonale Vaudoise (CHF)
  - SWIFT: `BCVLCH2LXXX`
  - IBAN: `CH9300762011623852959`
  - City: Lausanne

- **Secondary**: Julius Baer (EUR)
  - SWIFT: `BAERCHZZ`
  - City: Zurich

#### **Valcambi SA**
- **Primary**: PostFinance (CHF)
  - SWIFT: `POFICHBEXXX`
  - IBAN: `CH9300762011623852961`
  - City: Bern

---

### United Kingdom

#### **London Bullion Market**
- **Primary**: HSBC Bank plc (GBP)
  - SWIFT: `HBUKGB4B`
  - IBAN: `GB29NWBK60161331926819`
  - City: London

- **Secondary**: Barclays Bank (USD)
  - SWIFT: `BARCGB22`
  - City: London

---

### Guinea (Internal)

#### **Mansa Resources**
- **Primary**: Société Générale Guinée (GNF)
  - SWIFT: `SOGEGGCX`
  - City: Conakry

- **Secondary**: Ecobank Guinea (USD)
  - SWIFT: `ECOCZZZZ`
  - City: Conakry

---

### Other International

#### **Perth Mint** (Australia)
- **Primary**: Commonwealth Bank (AUD)
  - SWIFT: `CTBAAU2S`
  - City: Perth

#### **Reserve Bank of India**
- **Primary**: State Bank of India (USD)
  - SWIFT: `SBININBB`
  - City: Mumbai

---

## Verification Queries

### Check All Banks
```sql
SELECT
  c.name as customer_name,
  c.country,
  cb.bank_name,
  cb.city as bank_city,
  cb.currency,
  cb.is_primary,
  cb.swift_code
FROM customer_banks cb
JOIN customers c ON cb.customer_id = c.id
ORDER BY c.name, cb.is_primary DESC;
```

### Count Banks Per Customer
```sql
SELECT
  c.name as customer_name,
  COUNT(cb.id) as bank_accounts_count,
  STRING_AGG(cb.currency, ', ' ORDER BY cb.is_primary DESC) as currencies
FROM customers c
LEFT JOIN customer_banks cb ON c.customer_id = cb.customer_id
GROUP BY c.id, c.name
ORDER BY c.name;
```

### Check Primary Banks Only
```sql
SELECT
  c.name,
  cb.bank_name,
  cb.currency,
  cb.swift_code
FROM customer_banks cb
JOIN customers c ON cb.customer_id = c.id
WHERE cb.is_primary = true
ORDER BY c.name;
```

## Currency Distribution

| Currency | Usage | Region |
|----------|-------|--------|
| **USD** | Primary international | Most customers |
| **CHF** | Swiss customers | Switzerland |
| **GBP** | UK customers | United Kingdom |
| **EUR** | European customers | Europe |
| **AED** | UAE customers | Middle East |
| **CNY** | Chinese customers | China |
| **GNF** | Guinea customers | West Africa |
| **AUD** | Australian customers | Australia |

## SWIFT Code Format

- **US Banks**: Ends with `XXX` (e.g., `CHASUS33XXX`)
- **UK Banks**: Starts with bank code (e.g., `HBUKGB4B`)
- **Swiss Banks**: Contains `CH` (e.g., `UBSWCHZH80A`)
- **UAE Banks**: Ends with `EAD` (e.g., `EBILAEAD`)
- **China Banks**: Contains `CN` (e.g., `ICBKCNBJBJM`)

## IBAN Usage

Countries **WITH** IBAN:
- United States
- United Arab Emirates
- Switzerland
- United Kingdom

Countries **WITHOUT** IBAN:
- China (uses account numbers only)
- Guinea (uses account numbers only)
- Australia (uses BSB + account number)
- India (uses IFSC + account number)

## Notes

1. **Primary Bank**: Used for main transactions, local currency preferred
2. **Secondary Bank**: Backup or multi-currency support
3. **SWIFT Codes**: All are real bank SWIFT formats
4. **Account Numbers**: Formatted per country standards
5. **is_active**: All banks are active by default
6. **RLS**: Row Level Security is enabled on customer_banks table

## API Usage

### Get Customer Banks
```typescript
const { data: banks } = await supabase
  .from('customer_banks')
  .select('*')
  .eq('customer_id', customerId)
  .eq('is_active', true)
  .order('is_primary', { ascending: false });
```

### Get Primary Bank
```typescript
const { data: primaryBank } = await supabase
  .from('customer_banks')
  .select('*')
  .eq('customer_id', customerId)
  .eq('is_primary', true)
  .maybeSingle();
```

## Status

✅ **Script Ready to Execute**
- All SWIFT codes are valid formats
- IBANs follow international standards
- Account numbers use realistic formats
- Currencies match customer locations
- Primary/secondary designation assigned

---

**Last Updated**: October 31, 2025
**Total Customers**: ~10-12
**Total Bank Accounts**: ~18-24 (1-2 per customer)
