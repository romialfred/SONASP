import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CollectorDossierForm } from "./CollectorForm";
import { collectorErrors, emptyCollector } from "@/lib/collectorDossier";
import type { CollectorRecord } from "@/services/collectorService";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  upload: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@/services/collectorService", () => ({
  collectorService: { save: mocks.save },
}));
vi.mock("@/services/artisanDocumentService", () => ({
  artisanDocumentService: {
    upload: mocks.upload,
    list: mocks.list,
    url: vi.fn(),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "owner", is_active: true } }),
}));
vi.mock("@/components/layout/NationalDashboardLayout", () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) =>
    children,
}));
const references = {
  sites: [
    {
      id: "site-1",
      name: "Site artisanal Nongtaaba",
      locality: "Ouagadougou",
      region: "Centre",
    },
    {
      id: "site-2",
      name: "Site artisanal Wend-Panga",
      locality: "Ziniaré",
      region: "Plateau-Central",
    },
  ],
  organizations: [
    {
      id: "org-1",
      name: "Comptoir Faso Or",
      code: "CFO",
      organization_type: "comptoir" as const,
    },
    {
      id: "org-sonasp",
      name: "SONASP",
      code: "SONASP",
      organization_type: "sonasp" as const,
    },
  ],
};
const initial: CollectorRecord = {
  id: "collector-1",
  identity: {
    id: "collector-1",
    type_artisan: "collecteur",
    type_personne: "physique",
    nom: "Test",
    prenoms: "Collecteur",
    telephone: "+22670000000",
    date_naissance: "1990-01-01",
    pays: "Burkina Faso",
    region: "Centre",
    commune: "Ouagadougou",
    type_piece_identite: "CNI",
    numero_piece_identite: "TEST-123",
    numero_carte: null,
  },
  organization_id: "org-1",
  organization_name: "Comptoir Faso Or",
  organization_type: "comptoir",
  site_ids: ["site-1"],
  version: 1,
  payment_authorized_until: null,
  account_user_id: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.list.mockResolvedValue([]);
  mocks.save.mockResolvedValue({ ...initial, version: 2 });
});
function renderForm(value?: CollectorRecord) {
  const onSaved = vi.fn();
  render(
    <MemoryRouter>
      <CollectorDossierForm
        references={references}
        initial={value}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onSaved;
}
describe("Dossier collecteur", () => {
  it("exige un organisme et des sites, sans choix de personne morale", () => {
    renderForm();
    expect(screen.queryByText("Personne morale")).not.toBeInTheDocument();
    expect(screen.getAllByText("Personne physique").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le collecteur" }),
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choisissez un comptoir ou la SONASP."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ajoutez au moins un site de collecte."),
    ).toBeInTheDocument();
  });
  it("calcule la complétion sur les champs réels et enregistre les données du collecteur", async () => {
    const saved = renderForm(initial);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    fireEvent.change(screen.getByLabelText(/^Nom/), {
      target: { value: "Modifié" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le collecteur" }),
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0]).toMatchObject({
      type_personne: "physique",
      type_artisan: "collecteur",
      organization_id: "org-1",
      site_ids: ["site-1"],
      nom: "Modifié",
    });
    await waitFor(() => expect(saved).toHaveBeenCalledWith("collector-1"));
  });
  it("conserve les deux sites et retire uniquement le site demandé", async () => {
    renderForm({ ...initial, site_ids: ["site-1", "site-2"] });
    expect(screen.getByText("Site artisanal Nongtaaba")).toBeInTheDocument();
    expect(screen.getByText("Site artisanal Wend-Panga")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Retirer le site Site artisanal Nongtaaba",
      }),
    );
    expect(
      screen.queryByText("Site artisanal Nongtaaba"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Site artisanal Wend-Panga")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le collecteur" }),
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].site_ids).toEqual(["site-2"]);
  });
  it("reprend un dépôt échoué sans créer un second dossier", async () => {
    const saved = renderForm(initial);
    mocks.upload
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        id: "file-1",
        type_document: "cni",
        nom_fichier: "identite.pdf",
      });
    fireEvent.change(screen.getByLabelText(/^Nom/), {
      target: { value: "Dossier conservé" },
    });
    const file = new File(["%PDF-1.4 test"], "identite.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Pièces du collecteur"), {
      target: { files: [file] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le collecteur" }),
    );
    await screen.findByText(
      /Le dossier est enregistré. Certaines pièces ont échoué/,
    );
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le collecteur" }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
  });
  it("refuse les dates incohérentes et l’identité d’un mineur", () => {
    const v = {
      ...emptyCollector(),
      ...initial.identity,
      organization_id: "org-1",
      site_ids: ["site-1"],
      date_naissance: "2020-01-01",
    };
    expect(
      collectorErrors(v as ReturnType<typeof emptyCollector>).date_naissance,
    ).toBeTruthy();
  });
});
