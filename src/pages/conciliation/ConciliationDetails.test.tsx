import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPABILITIES } from '@/lib/capabilities';
import type { Conciliation, ContexteConciliation } from '@/services/conciliationService';
import type { DossierComplet } from '@/services/dossierService';
import { ConciliationDetails, etapeStatut, formatMontantDetail } from './ConciliationDetails';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  parIdentifiant: vi.fn(),
  contexte: vi.fn(),
  ecarts: vi.fn(),
  enregistrerAnalyse: vi.fn(),
  valider: vi.fn(),
  impactsFiscaux: vi.fn(),
  chargerDossier: vi.fn(),
  urlPourDocument: vi.fn(),
  exportWorkbook: vi.fn(),
  authUser: {
    id: 'owner-1', role: 'owner', is_active: true,
    capabilities: [
      'reconciliation.edit',
      'reconciliation.approve',
      'reconciliation.export',
    ],
  } as Record<string, unknown>,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'conciliation-38' }),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.authUser }) }));

vi.mock('@/services/conciliationService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/conciliationService')>();
  return {
    ...original,
    conciliationService: {
      ...original.conciliationService,
      parIdentifiant: mocks.parIdentifiant,
      contexte: mocks.contexte,
      ecarts: mocks.ecarts,
      enregistrerAnalyse: mocks.enregistrerAnalyse,
      valider: mocks.valider,
      impactsFiscaux: mocks.impactsFiscaux,
    },
  };
});

vi.mock('@/services/dossierService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/dossierService')>();
  return {
    ...original,
    dossierService: {
      ...original.dossierService,
      charger: mocks.chargerDossier,
      urlPourDocument: mocks.urlPourDocument,
    },
  };
});

vi.mock('@/lib/excelExport', () => ({ downloadExcelWorkbook: mocks.exportWorkbook }));

const dossier: Conciliation = {
  id: 'conciliation-38',
  reference: 'REC-2026-00038',
  sale_id: 'sale-38',
  contrat_id: null,
  mining_company_id: 'sonasp',
  customer_id: 'customer-1',
  source_analyse_type: null,
  assay_certificate_id: null,
  analyse_teneur_id: null,
  poids_initial_g: 607.42,
  teneur_initiale_pct: 91.7,
  or_fin_initial_g: 557.54,
  prix_initial: 85_000,
  devise_initiale: 'XOF',
  ca_initial: 51_633_700,
  poids_final_g: null,
  teneur_finale_pct: null,
  or_fin_final_g: null,
  prix_final: null,
  devise_finale: null,
  date_fixing: null,
  ca_final: null,
  statut: 'en_attente_analyse',
  motif_statut: null,
  observations: 'Vérifier le résultat reçu.',
  version: 1,
  soumis_par: null,
  soumis_le: null,
  valide_par: null,
  valide_le: null,
  cloture_le: null,
  created_at: '2026-08-27T08:00:00Z',
  updated_at: '2026-08-27T08:00:00Z',
  sale: {
    id: 'sale-38', sale_number: 'VE-OR-2026-00038', sale_date: '2026-08-27',
    quantity_oz: 17.925, currency: 'XOF', seller_id: 'sonasp', seller_type: 'sonasp',
    gross_proceeds: 51_633_700, total_amount: 52_150_037, net_proceeds: 51_633_700,
    royalty_amount: 516_337, freight_cost: null, other_costs: null,
    london_am_rate: 2_644, final_price_per_oz: 2_650, status: 'completed',
    metal_type: 'gold', order_type: 'market', shipping_preparation_id: 'ship-1',
    customer_notes: 'Réception confirmée.',
  },
  customer: { id: 'customer-1', name: 'Raffinerie Africaine', phone: '+226 70 00 00 00' },
  mining_company: { id: 'sonasp', name: 'SONASP', code: 'SONASP', contact_person_phone: '+226 25 00 00 00' },
};

const contexte: ContexteConciliation = {
  lignes: [{ id: 'line-1', line_number: 1, metal_type: 'gold', quantity_grams: 607.42, quantity_oz: 19.529, fine_weight_oz: 17.925, fineness_percentage: 91.7, unit_price: 85_000, line_total: 51_633_700 }],
  certificat: {
    id: 'cert-1', certificate_number: 'CERT-2026-991', certificate_date: '2026-08-29',
    issuing_laboratory: 'Laboratoire Raffinerie', sample_id: 'ECH-38', sample_weight_grams: 25,
    fineness: 916.5, purity_percent: 91.65, gold_content_percent: 91.65,
    file_name: 'resultats.pdf', file_path: 'certificats/resultats.pdf', file_size: 1_200_000,
    mime_type: 'application/pdf', approval_status: 'approved', approved_by: 'reviewer-2', approved_at: '2026-08-29T11:00:00Z', shipping_preparation_id: 'ship-1', created_at: '2026-08-29T10:00:00Z',
  },
  donneesCertificat: { total_weight_g: 601.31, gold_purity_percentage: 91.65, is_verified: true },
  analyseTeneur: null,
  expedition: {
    id: 'ship-1', expedition_lot_number: 'LOT-2026-38', refinery_id: 'refinery-1',
    shipped_to_company: 'Raffinerie Africaine', shipped_to_country: 'Suisse',
    total_gross_weight_grams: 607.42, total_net_weight_grams: 603.2, total_weight_oz: 19.529,
    prepared_at: '2026-08-27T08:00:00Z', shipped_at: '2026-08-28T08:00:00Z', status: 'shipped',
  },
  raffinerie: { id: 'refinery-1', name: 'Raffinerie Africaine', country: 'Suisse' },
  paiement: { id: 'pay-1', invoice_number: 'FACT-2026-00891', reference_number: 'PAY-38', amount: 52_150_037, currency: 'XOF', status: 'completed', created_at: '2026-08-27T09:00:00Z' },
  origines: [{ source_type: 'achat_artisan', source_id: 'artisan-sale-1', reference: 'REC-ART-1', origine: 'Clarisse ILBOUDO', quantite_oz: 19.529 }],
  reception: { received_at: '2026-08-29T07:30:00Z' },
};

const dossierComplet: DossierComplet = {
  ancre: { type: 'conciliation', id: dossier.id },
  chaine: {},
  documents: [{ etape: 'analyse', source: 'assay_certificates', id: 'doc-1', nom: 'Résultats de raffinage.pdf', chemin: 'certificats/resultats.pdf', taille: 1_200_000, date: '2026-08-29' }],
  chronologie: [{ etape: 'conciliation', date: '2026-08-27T08:00:00Z', titre: 'Dossier ouvert', acteur: 'Agent SONASP' }],
  comptes: {},
};

describe('modèle de la fiche de conciliation', () => {
  it('formate la devise réelle et suit les étapes métier existantes', () => {
    expect(formatMontantDetail(1_733_604_400, 'XOF')).toContain('FCFA');
    expect(etapeStatut('en_attente_analyse')).toBe(0);
    expect(etapeStatut('analyse_recue')).toBe(1);
    expect(etapeStatut('validee')).toBe(2);
    expect(etapeStatut('cloturee')).toBe(3);
  });
});

describe('ConciliationDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authUser = {
      id: 'owner-1', role: 'owner', is_active: true,
      capabilities: [CAPABILITIES.RECONCILIATION_EDIT, CAPABILITIES.RECONCILIATION_APPROVE, CAPABILITIES.RECONCILIATION_EXPORT],
    };
    mocks.parIdentifiant.mockResolvedValue(dossier);
    mocks.contexte.mockResolvedValue(contexte);
    mocks.ecarts.mockResolvedValue([]);
    mocks.impactsFiscaux.mockResolvedValue([]);
    mocks.chargerDossier.mockResolvedValue(dossierComplet);
    mocks.urlPourDocument.mockResolvedValue('https://signed.example/resultats.pdf');
    mocks.exportWorkbook.mockResolvedValue(undefined);
    mocks.enregistrerAnalyse.mockResolvedValue({ reference: dossier.reference, or_fin_final_g: 551.06, ca_final: 46_000_000 });
    mocks.valider.mockResolvedValue({ reference: dossier.reference, ecart_commercial: -5_633_700, sans_second_regard: false, taxes_ajustees: [], taxes_sans_regle: [] });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('affiche les données relationnelles et les sept onglets fonctionnels', async () => {
    render(<ConciliationDetails />);
    expect(await screen.findByRole('heading', { name: 'VE-OR-2026-00038' })).toBeInTheDocument();
    expect(screen.getAllByText('Clarisse ILBOUDO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Raffinerie Africaine').length).toBeGreaterThan(0);
    expect(screen.getByText('FACT-2026-00891')).toBeInTheDocument();
    expect(screen.getByText('29/08/2026')).toBeInTheDocument();

    const tabs = within(screen.getByRole('tablist', { name: 'Sections du dossier' }));
    expect(tabs.getAllByRole('tab')).toHaveLength(7);
    fireEvent.click(tabs.getByRole('tab', { name: /Détails de la vente/ }));
    expect(screen.getByRole('heading', { name: 'Informations commerciales' })).toBeInTheDocument();
  });

  it('gère le clavier dans la barre d’onglets', async () => {
    render(<ConciliationDetails />);
    const tabs = within(await screen.findByRole('tablist', { name: 'Sections du dossier' }));
    const apercu = tabs.getByRole('tab', { name: 'Aperçu' });
    apercu.focus();
    fireEvent.keyDown(apercu, { key: 'ArrowRight' });
    expect(tabs.getByRole('tab', { name: /Détails de la vente/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('le bouton principal ouvre le workflow réel puis enregistre la preuve approuvée', async () => {
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('button', { name: /Lancer la conciliation/ }));
    expect(screen.getByRole('heading', { name: 'Lancer la conciliation' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('601.31')).toBeInTheDocument();
    expect(screen.getByDisplayValue('91.65')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }));
    await waitFor(() => expect(mocks.enregistrerAnalyse).toHaveBeenCalledWith(expect.objectContaining({
      conciliationId: dossier.id,
      sourceType: 'certificat_acheteur',
      sourceId: 'cert-1',
      poidsFinalG: 601.31,
      teneurFinalePct: 91.65,
    })));
  });

  it('ouvre les documents via une URL privée résolue par le service', async () => {
    render(<ConciliationDetails />);
    const bouton = await screen.findByRole('button', { name: 'Télécharger Résultats de raffinage.pdf' });
    fireEvent.click(bouton);
    await waitFor(() => expect(mocks.urlPourDocument).toHaveBeenCalledWith(dossierComplet.documents[0]));
    expect(window.open).toHaveBeenCalledWith('https://signed.example/resultats.pdf', '_blank', 'noopener,noreferrer');
  });

  it('exporte un classeur construit avec le dossier chargé', async () => {
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('button', { name: 'Exporter le dossier' }));
    await waitFor(() => expect(mocks.exportWorkbook).toHaveBeenCalledWith(expect.any(Array), 'dossier-VE-OR-2026-00038.xlsx'));
  });

  it('ouvre directement la preuve sélectionnée avec une URL privée', async () => {
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('button', { name: /Lancer la conciliation/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le certificat sélectionné' }));
    await waitFor(() => expect(mocks.urlPourDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'cert-1', source: 'assay_certificates', chemin: 'certificats/resultats.pdf' })));
    expect(window.open).toHaveBeenCalledWith('https://signed.example/resultats.pdf', '_blank', 'noopener,noreferrer');
  });

  it('laisse consulter une preuve non approuvée sans permettre son enregistrement', async () => {
    mocks.contexte.mockResolvedValue({ ...contexte, certificat: { ...contexte.certificat, approved_by: null, approved_at: null } });
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('button', { name: /Lancer la conciliation/ }));
    expect(screen.getByRole('button', { name: 'Ouvrir le certificat sélectionné' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Enregistrer le résultat' })).not.toBeInTheDocument();
  });

  it('masque les actions sensibles lorsque les capacités serveur sont absentes', async () => {
    mocks.authUser = { id: 'reader', role: 'manager', is_active: true, capabilities: [CAPABILITIES.RECONCILIATION_READ] };
    render(<ConciliationDetails />);
    await screen.findByRole('heading', { name: 'VE-OR-2026-00038' });
    expect(screen.queryByRole('button', { name: /Lancer la conciliation/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exporter le dossier' })).not.toBeInTheDocument();
  });

  it('affiche un état introuvable sans injecter de données de démonstration', async () => {
    mocks.parIdentifiant.mockResolvedValue(null);
    render(<ConciliationDetails />);
    expect(await screen.findByRole('heading', { name: 'Dossier introuvable' })).toBeInTheDocument();
    expect(screen.queryByText('VE-OR-2026-00038')).not.toBeInTheDocument();
  });

  it('permet de réessayer après une erreur API', async () => {
    mocks.parIdentifiant.mockRejectedValueOnce(new Error('Réseau indisponible')).mockResolvedValueOnce(dossier);
    render(<ConciliationDetails />);
    expect(await screen.findByText('Réseau indisponible')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('heading', { name: 'VE-OR-2026-00038' })).toBeInTheDocument();
    expect(mocks.parIdentifiant).toHaveBeenCalledTimes(2);
  });

  it('ne transforme pas une panne technique en insuffisance de droits Owner', async () => {
    mocks.contexte.mockResolvedValue({ ...contexte, incidents: [{ section: 'Origine des lots', type: 'technique', code: 'PGRST200' }] });
    render(<ConciliationDetails />);
    expect(await screen.findByText(/Origine des lots \(erreur de chargement/)).toBeInTheDocument();
    expect(screen.getByText('FACT-2026-00891')).toBeInTheDocument();
    expect(screen.queryByText(/avec vos droits actuels/)).not.toBeInTheDocument();
  });

  it('explique le dossier sans expédition et interdit l’enregistrement', async () => {
    mocks.contexte.mockResolvedValue({ ...contexte, expedition: null, certificat: null, donneesCertificat: null });
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('button', { name: /Lancer la conciliation/ }));
    expect(screen.getByText(/Aucune expédition n’est rattachée/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer le résultat' })).not.toBeInTheDocument();
  });

  it('montre les écarts et conserve la distinction entre estimation, dette et versement', async () => {
    mocks.impactsFiscaux.mockResolvedValue([{ code_taxe: 'fndl', assiette: 'ca_ht', initial: 100, definitif: 90, ecart: -10, versements: 100, devise: 'USD', etat: 'calculable' }]);
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('button', { name: /Lancer la conciliation/ }));
    expect(await screen.findByRole('table', { name: 'Simulation des régularisations fiscales' })).toBeInTheDocument();
    expect(screen.getByText('Estimation · à valider')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix retenu / once')).toHaveValue('2650');
    expect(screen.getByLabelText('Date de fixing')).toHaveValue('2026-08-27');
    expect(mocks.valider).not.toHaveBeenCalled();
  });

  it('ne valide rien tant que le nouveau moteur fiscal serveur est indisponible', async () => {
    mocks.parIdentifiant.mockResolvedValue({ ...dossier, statut: 'analyse_recue', ca_final: 46_000_000, date_fixing: '2026-08-27' });
    mocks.impactsFiscaux.mockRejectedValue(new Error('RPC absente'));
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('tab', { name: /Écarts et analyse/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la conciliation' }));
    expect(await screen.findByText(/La validation est suspendue/)).toBeInTheDocument();
    expect(mocks.valider).not.toHaveBeenCalled();
  });

  it('actualise les mesures affichées lorsqu’un autre certificat du même lot est sélectionné', async () => {
    mocks.parIdentifiant.mockResolvedValue({ ...dossier, statut: 'analyse_recue', poids_final_g: 601.31, teneur_finale_pct: 91.65 });
    mocks.contexte.mockResolvedValue({ ...contexte, certificats: [contexte.certificat, { ...contexte.certificat, id: 'cert-2', certificate_number: 'CERT-2', purity_percent: 90 }], mesuresCertificats: [{ certificate_id: 'cert-2', total_weight_g: 589.42, gold_purity_percentage: 90, is_verified: true }] });
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('tab', { name: /Résultats de raffinage/ }));
    fireEvent.change(screen.getByLabelText('Rapport de raffinage'), { target: { value: 'cert-2' } });
    const resultat = screen.getByRole('heading', { name: 'Résultat du raffinage' }).closest('section')!;
    expect(within(resultat).getByText(/589,42\s*g/)).toBeInTheDocument();
    expect(within(resultat).queryByText(/601,31\s*g/)).not.toBeInTheDocument();
  });

  it('vérifie le moteur fiscal avant de demander une validation au serveur', async () => {
    mocks.parIdentifiant.mockResolvedValue({ ...dossier, statut: 'analyse_recue', ca_final: 46_000_000, date_fixing: '2026-08-27' });
    render(<ConciliationDetails />);
    fireEvent.click(await screen.findByRole('tab', { name: /Écarts et analyse/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider la conciliation' }));
    await waitFor(() => expect(mocks.valider).toHaveBeenCalledWith(dossier.id));
    expect(mocks.impactsFiscaux).toHaveBeenCalledWith(dossier.id, null, null, null, '2026-08-27');
    expect(mocks.impactsFiscaux.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.valider.mock.invocationCallOrder.at(-1)!);
  });
});
