import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollectionSalesPage from "./CollectionSalesPage";
const mocks = vi.hoisted(() => ({
  sales: vi.fn(),
  decide: vi.fn(),
  role: "comptoir",
}));
vi.mock("@/services/collectorService", () => ({
  collectorService: { sales: mocks.sales, decideSale: mocks.decide },
}));
vi.mock("@/components/layout/NationalDashboardLayout", () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: mocks.role, is_active: true } }),
}));
const sale = {
  id: "sale-1",
  artisan_name: "Artisan Test",
  collector_name: "Collecteur Test",
  site_name: "Site Test",
  organization_name: "Comptoir A",
  quantity: 20,
  total: 100000,
  date: "2026-09-06",
  status: "submitted",
  can_approve: true,
  can_pay: false,
  notifications: [],
  version: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "comptoir";
  mocks.sales.mockResolvedValue([sale]);
  mocks.decide.mockResolvedValue(undefined);
});
describe("Ventes de collecte", () => {
  it('ouvre uniquement les ventes du collecteur demandé depuis sa fiche', async () => {
    mocks.sales.mockResolvedValue([{ ...sale, collector_id: 'collector-a' }, { ...sale, id: 'sale-2', artisan_name: 'Autre artisan', collector_id: 'collector-b' }]);
    render(<MemoryRouter initialEntries={['/collecte/ventes?collecteur=collector-a']}><CollectionSalesPage /></MemoryRouter>);
    expect(await screen.findByText('Artisan Test')).toBeInTheDocument();
    expect(screen.queryByText('Autre artisan')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir toutes les ventes autorisées' })).toHaveAttribute('href', '/collecte/ventes');
  });
  it("ouvre le paiement existant dans son écran de suivi", async () => {
    mocks.sales.mockResolvedValue([{ ...sale, status: "approved", can_approve: false, can_pay: true, invoice_id: "invoice-1", payment_id: "payment-1" }]);
    render(<MemoryRouter><CollectionSalesPage /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Paiement" })).toHaveAttribute("href", "/artisan-minier/paiements/historique/payment-1");
  });
  it("demande une décision explicite puis recharge le résultat", async () => {
    render(
      <MemoryRouter>
        <CollectionSalesPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));
    expect(mocks.decide).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la décision" }),
    );
    await waitFor(() =>
      expect(mocks.decide).toHaveBeenCalledWith(sale, "approved", ""),
    );
    await waitFor(() => expect(mocks.sales).toHaveBeenCalledTimes(2));
  });
  it("ne montre ni approbation ni paiement au collecteur sans autorisation", async () => {
    mocks.role = "collector";
    mocks.sales.mockResolvedValue([{ ...sale, can_approve: false }]);
    render(
      <MemoryRouter>
        <CollectionSalesPage />
      </MemoryRouter>,
    );
    await screen.findByText("Artisan Test");
    expect(
      screen.queryByRole("button", { name: "Approuver" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Paiement" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Enregistrer une vente" }),
    ).toBeInTheDocument();
  });
  it("conserve une erreur serveur et ne simule pas une approbation", async () => {
    mocks.decide.mockRejectedValue(new Error("Vente déjà traitée"));
    render(
      <MemoryRouter>
        <CollectionSalesPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Approuver" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la décision" }),
    );
    expect(await screen.findByText("Vente déjà traitée")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmer la décision" }),
    ).toBeInTheDocument();
  });
});
