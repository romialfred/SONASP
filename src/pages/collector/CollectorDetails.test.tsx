import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectorDetails } from "./CollectorDetails";
import type { CollectorRecord } from "@/services/collectorService";
const mocks = vi.hoisted(() => ({ activity: vi.fn() }));
vi.mock("@/services/collectorActivityService", () => ({
  collectorActivityService: { get: mocks.activity },
}));
const record: CollectorRecord = {
  id: "collector-a",
  identity: {
    id: "collector-a",
    numero_carte: null,
    nom: "TEST",
    prenoms: "Aminata",
    type_personne: "physique",
    type_artisan: "collecteur",
    telephone: "+22670000000",
    whatsapp_identique: true,
  },
  organization_id: "",
  organization_name: "",
  organization_type: null,
  site_ids: [],
  version: 0,
  payment_authorized_until: null,
  account_user_id: null,
  is_legacy: true,
};
const empty = {
  declarations: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  cancelled: 0,
  paid: 0,
  turnover: 0,
  taxes: 0,
  quantity: 0,
  lastDeclaration: null,
};
function view(props: Partial<Parameters<typeof CollectorDetails>[0]> = {}) {
  return render(
    <MemoryRouter>
      <CollectorDetails
        record={record}
        manage
        canDelegate={false}
        onRefresh={vi.fn()}
        paymentForm={
          <label>
            Justification
            <input />
          </label>
        }
        {...props}
      />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.activity.mockResolvedValue(empty);
});
describe("Fiche collecteur", () => {
  it("présente le dossier incomplet et une activité vide vérifiée sans inventer de référence", async () => {
    view();
    expect(
      await screen.findByText(
        "Aucune vente de collecte enregistrée pour ce dossier.",
      ),
    ).toBeInTheDocument();
    expect(mocks.activity).toHaveBeenCalledWith("collector-a");
    expect(screen.getByText("Dossier incomplet")).toBeInTheDocument();
    expect(screen.getByText("Identifiant du dossier")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Consulter les ventes/ }),
    ).toHaveAttribute("href", "/collecte/ventes?collecteur=collector-a");
    expect(
      screen.queryByRole("button", { name: "Configurer la délégation" }),
    ).not.toBeInTheDocument();
  });
  it("n’affiche pas de zéros trompeurs en cas d’échec et permet une nouvelle tentative", async () => {
    mocks.activity
      .mockRejectedValueOnce(new Error("Forbidden"))
      .mockResolvedValueOnce(empty);
    view();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "n’ont pas pu être chargés",
    );
    expect(
      screen.queryByText("Chiffre d’affaires suivi (HT)"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(
      await screen.findByText("Chiffre d’affaires suivi (HT)"),
    ).toBeInTheDocument();
  });
  it("réserve la configuration aux habilités et distingue une délégation expirée", async () => {
    view({
      canDelegate: true,
      record: { ...record, payment_authorized_until: "2000-01-01T23:59:59Z" },
    });
    expect(screen.getByText(/Délégation expirée/)).toBeInTheDocument();
    const configure = screen.getByRole("button", {
      name: "Configurer la délégation",
    });
    expect(configure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(configure);
    expect(screen.getByLabelText("Justification")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Fermer la configuration" }),
    ).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(mocks.activity).toHaveBeenCalled());
  });
  it("masque les actions de gestion pour une lecture seule", async () => {
    view({ manage: false });
    expect(
      screen.queryByRole("link", { name: "Modifier le dossier" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Associer un compte utilisateur" }),
    ).not.toBeInTheDocument();
    await screen.findByText("Chiffre d’affaires suivi (HT)");
  });
  it("ignore la réponse tardive d’un dossier quitté", async () => {
    let resolveOld!: (value: typeof empty) => void;
    mocks.activity
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...empty, turnover: 1234 });
    const result = view();
    result.rerender(
      <MemoryRouter>
        <CollectorDetails
          record={{ ...record, id: "collector-b" }}
          manage={false}
          canDelegate={false}
          onRefresh={vi.fn()}
          paymentForm={null}
        />
      </MemoryRouter>,
    );
    await screen.findByText(/1\s234/);
    resolveOld({ ...empty, turnover: 9876 });
    await waitFor(() =>
      expect(screen.queryByText(/9\s876/)).not.toBeInTheDocument(),
    );
  });
});
