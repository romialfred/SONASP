-- Ajouter une compagnie de transport exemple

INSERT INTO transport_companies (
  name,
  email,
  phone,
  company_type,
  address,
  contact_person,
  is_active
) VALUES (
  'Brinks Freight Express Limited',
  'contact@brinks.com',
  '+27 11 444 0000',
  'both',
  'Johannesburg, South Africa',
  'John Smith',
  true
) ON CONFLICT DO NOTHING;

-- Vérifier
SELECT id, name, email, phone, address, is_active 
FROM transport_companies;
