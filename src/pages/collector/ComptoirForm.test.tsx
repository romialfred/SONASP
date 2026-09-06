import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComptoirForm, { ComptoirDossierForm } from "./ComptoirForm";
import {
  authorizationDays,
  authorizationStatus,
  comptoirCompletion,
  comptoirErrors,
  emptyComptoir,
  COMPTOIR_TAX_OFFICES,
} from "@/lib/comptoirDossier";
import type { ComptoirRecord } from "@/services/comptoirService";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  url: vi.fn(),
  removeDocument: vi.fn(),
}));
vi.mock("@/services/comptoirService", () => ({ comptoirService: mocks }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "owner", is_active: true } }),
}));
vi.mock("@/components/layout/NationalDashboardLayout", () => ({
  NationalDashboardLayout: ({ children }: { children: React.ReactNode }) =>
    children,
}));
const record: ComptoirRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "CPT-TEST",
  name: "Comptoir QA",
  is_active: true,
  version: 1,
  organization_updated_at: "2026-09-06T00:00:00Z",
  updated_at: "2026-09-06T00:00:00Z",
  documents: [],
  values: {
    ...emptyComptoir(),
    name: "Comptoir QA",
    legal_form: "SARL",
    city: "Ouagadougou",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:qa");
  URL.revokeObjectURL = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.save.mockResolvedValue({ ...record, version: 2 });
  mocks.get.mockResolvedValue(record);
  mocks.url.mockResolvedValue("https://private.example.test/document");
});
function show(initial?: ComptoirRecord, readOnly = false) {
  const saved = vi.fn();
  render(
    <MemoryRouter>
      <ComptoirDossierForm
        initial={initial}
        readOnly={readOnly}
        onSaved={saved}
        onCancel={vi.fn()}
      />
    </MemoryRouter>,
  );
  return saved;
}
describe("Dossier entreprise du comptoir", () => {
  it.each(["immédiate", "différée"])(
    "relit le dossier après modification avec une réponse %s",
    async (response) => {
      let server = record;
      mocks.get.mockImplementation(() =>
        response === "immédiate"
          ? Promise.resolve(server)
          : new Promise((resolve) => setTimeout(() => resolve(server), 0)),
      );
      mocks.save.mockImplementation(async (values) => {
        server = { ...record, version: 2, values };
        return server;
      });
      render(
        <MemoryRouter
          initialEntries={[`/artisan-minier/comptoirs/${record.id}/modifier`]}
        >
          <Routes>
            <Route
              path="/artisan-minier/comptoirs/:id/modifier"
              element={<ComptoirForm />}
            />
            <Route
              path="/artisan-minier/comptoirs/:id"
              element={<ComptoirForm readOnly />}
            />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.change(await screen.findByLabelText("Nom du responsable"), {
        target: { value: "Responsable actualisé" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Enregistrer le dossier" }),
      );
      await screen.findByRole("link", { name: "Modifier le dossier" });
      expect(
        await screen.findByText("Responsable actualisé", { selector: "p" }),
      ).toBeInTheDocument();
      expect(mocks.get.mock.calls.length).toBeGreaterThanOrEqual(3);
    },
  );
  it("recalcule la validité lorsque les deux dates sont renseignées", () => {
    show(record);
    fireEvent.change(
      screen.getByLabelText("Date de délivrance de l’autorisation"),
      { target: { value: "2026-01-01" } },
    );
    fireEvent.change(
      screen.getByLabelText("Date d’expiration de l’autorisation"),
      { target: { value: "2026-12-31" } },
    );
    expect(
      screen.getByText("365 jours · dates de début et de fin incluses"),
    ).toBeInTheDocument();
  });
  it("présente les champs entreprise, fiscalité, autorisation et responsable sans tutelle institutionnelle", () => {
    show();
    expect(screen.getByLabelText(/Type d’entreprise/).tagName).toBe("SELECT");
    expect(screen.getByLabelText("Régime d’imposition").tagName).toBe("SELECT");
    expect(
      screen.queryByLabelText(/Ministère de tutelle/),
    ).not.toBeInTheDocument();
    for (const label of [
      "Nom du responsable",
      "Prénom(s) du responsable",
      "Fonction",
      "Téléphone du responsable",
      "E-mail du responsable",
      "Numéro RCCM",
      "Numéro IFU",
      "Quartier / secteur",
    ])
      expect(
        screen.getByLabelText(label, { exact: false }),
      ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Joindre — Logo de la société"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Joindre — Photo d’identité du responsable"),
    ).toBeInTheDocument();
  });
  it("empêche un enregistrement vide et indique le champ à corriger", () => {
    show();
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le dossier" }),
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Dénomination sociale/)).toHaveFocus();
  });
  it("enregistre les nouveaux champs, puis relit le serveur avant navigation", async () => {
    const saved = show(record);
    fireEvent.change(screen.getByLabelText("Nom du responsable"), {
      target: { value: "Kaboré" },
    });
    fireEvent.change(screen.getByLabelText("Régime d’imposition"), {
      target: { value: "RSI" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le dossier" }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalledWith(record.id));
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        representative_last_name: "Kaboré",
        tax_regime: "RSI",
        legal_form: "SARL",
      }),
      record.id,
      record,
      expect.any(String),
    );
    expect(mocks.get).toHaveBeenCalledWith(record.id);
  });
  it("conserve la même clé de reprise quand la réponse de création est perdue", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Réseau interrompu"));
    show();
    fireEvent.change(screen.getByLabelText(/Dénomination sociale/), {
      target: { value: "Comptoir nouveau" },
    });
    fireEvent.change(screen.getByLabelText(/Type d’entreprise/), {
      target: { value: "EI" },
    });
    fireEvent.change(screen.getByLabelText(/Ville \/ commune/), {
      target: { value: "Bobo-Dioulasso" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le dossier" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enregistrer le dossier" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le dossier" }),
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[0][1]).toBe(mocks.save.mock.calls[1][1]);
    expect(mocks.save.mock.calls[0][3]).toBe(mocks.save.mock.calls[1][3]);
  });
  it("réessaie uniquement la pièce échouée sans recréer le comptoir ni perdre les fichiers", async () => {
    const saved = show(record);
    fireEvent.change(screen.getByLabelText("Nom du responsable"), {
      target: { value: "Test" },
    });
    const file = new File(["%PDF-1.7\n%%EOF"], "rccm.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Joindre — Extrait RCCM"), {
      target: { files: [file] },
    });
    mocks.upload
      .mockRejectedValueOnce(new Error("Indisponible"))
      .mockResolvedValueOnce({
        id: "doc-qa",
        kind: "rccm",
        file_name: "rccm.pdf",
      });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le dossier" }),
    );
    await screen.findByText(/Certaines pièces n’ont pas été envoyées/);
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le dossier" }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[0][1].id).toBe(
      mocks.upload.mock.calls[1][1].id,
    );
  });
  it("refuse un PDF dans la photo et un document trop volumineux", async () => {
    show(record);
    fireEvent.change(
      screen.getByLabelText("Joindre — Photo d’identité du responsable"),
      {
        target: {
          files: [new File(["pdf"], "photo.pdf", { type: "application/pdf" })],
        },
      },
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("À envoyer")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Joindre — Extrait RCCM"), {
      target: {
        files: [
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });
    expect(screen.queryByText("À envoyer")).not.toBeInTheDocument();
  });
  it("affiche en détail toutes les données enregistrées, sans action d’enregistrement", () => {
    show(
      {
        ...record,
        values: {
          ...record.values,
          representative_last_name: "Kaboré",
          authorization_number: "ACH-2026-01",
          authorization_issued_on: "2026-01-01",
          authorization_expires_on: "2026-12-31",
          tax_office_code: "DGE",
        },
      },
      true,
    );
    expect(screen.getByText("Kaboré")).toBeInTheDocument();
    expect(screen.getByText("ACH-2026-01")).toBeInTheDocument();
    expect(
      screen.getByText("Direction des grandes entreprises"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enregistrer le dossier" }),
    ).not.toBeInTheDocument();
  });
  it("n’annonce pas 100 % lorsque les pièces ou le responsable sont absents", () => {
    expect(comptoirCompletion(record.values, []).percent).toBeLessThan(100);
  });
  it("gère les années bissextiles, les expirations et les dates invalides", () => {
    expect(
      authorizationDays({
        authorization_issued_on: "2024-02-28",
        authorization_expires_on: "2024-03-01",
      }),
    ).toBe(3);
    expect(
      comptoirErrors({
        ...record.values,
        authorization_issued_on: "2026-02-31",
      }).authorization_issued_on,
    ).toBeTruthy();
    expect(
      comptoirErrors({
        ...record.values,
        authorization_issued_on: "2026-12-31",
        authorization_expires_on: "2026-01-01",
      }).authorization_expires_on,
    ).toBeTruthy();
    expect(
      authorizationStatus(
        {
          ...record.values,
          authorization_number: "A",
          authorization_issued_on: "2025-01-01",
          authorization_expires_on: "2025-12-31",
        },
        "2026-01-01",
      ).label,
    ).toBe("Expirée");
  });
  it("propose les 70 structures DGI sourcées et la DME Centre V", () => {
    expect(COMPTOIR_TAX_OFFICES).toHaveLength(70);
    expect(COMPTOIR_TAX_OFFICES.some((o) => o.code === "DME-C-V")).toBe(true);
    expect(new Set(COMPTOIR_TAX_OFFICES.map((o) => o.code)).size).toBe(70);
  });
});
