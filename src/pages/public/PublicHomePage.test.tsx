import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicHomePage, { SectorIndicators } from "./PublicHomePage";
import { PublicLocaleProvider } from "./PublicLocaleContext";
import {
  hasPublishableValue,
  sectorIndicators,
} from "./content/sectorIndicators";

const media = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
function renderHome() {
  return render(
    <MemoryRouter>
      <PublicLocaleProvider>
        <PublicHomePage />
      </PublicLocaleProvider>
    </MemoryRouter>,
  );
}
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("vitrine complète de la Présidence du Faso", () => {
  beforeEach(() => {
    window.localStorage.clear();
    media.matches = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("intègre les neuf sections centrales entre le header et le footer et tous les raccordements", () => {
    const { container } = renderHome();
    expect(container.querySelectorAll(".fs-home > section")).toHaveLength(9);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer les taxes.",
    );
    expect(document.title).toContain("Faso SANAMA | Présidence du Faso");
    for (const link of container.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/#"]',
    )) {
      expect(document.getElementById(link.hash.slice(1))).not.toBeNull();
    }
    expect(
      screen.getByRole("link", { name: "Notre cadre de protection" }),
    ).toHaveAttribute("href", "/securite");
    expect(
      screen.getByRole("link", { name: "Besoin d’accompagnement ?" }),
    ).toHaveAttribute("href", "/assistance");
  });
  it("qualifie la projection et garde les cinq statistiques indisponibles distinctes de zéro", () => {
    renderHome();
    expect(
      screen.getByText(
        "Scénario indicatif à valider. Référence et horizon à préciser.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Donnée non disponible")).toHaveLength(5);
    const indicator = {
      ...sectorIndicators[0],
      value: 0,
      date: "2026-01-01",
      sourceTitle: "Recensement approuvé",
    };
    expect(hasPublishableValue(indicator)).toBe(true);
    expect(hasPublishableValue({ ...indicator, sourceTitle: null })).toBe(
      false,
    );
    expect(hasPublishableValue({ ...indicator, value: null })).toBe(false);
    expect(hasPublishableValue({ ...indicator, value: NaN })).toBe(false);
  });
  it("avance toutes les huit secondes, boucle et garde un seul H1 et un seul visuel accessible", () => {
    renderHome();
    tick(8000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Préserver l’or",
    );
    tick(8000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "De la mine",
    );
    tick(8000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      within(
        screen.getByRole("region", { name: "Les missions de FASO SANAMA" }),
      ).getAllByRole("img"),
    ).toHaveLength(1);
  });
  it("affiche une valeur documentée et un vrai zéro sans les confondre avec une absence", () => {
    const indicators = sectorIndicators.map((entry, index) => ({
      ...entry,
      value: index === 0 ? 17 : index === 1 ? 0 : null,
      date: "2026-01-01",
      sourceTitle: "Source de test, non publiée",
    }));
    const { container } = render(<SectorIndicators indicators={indicators} />);
    const values = Array.from(
      container.querySelectorAll(".fs-sector__numbers strong"),
    ).map((node) => node.textContent);
    expect(values).toEqual(["17", "0", "—", "—", "—"]);
    expect(screen.getAllByText("Donnée non disponible")).toHaveLength(3);
  });
  it("conserve la progression pendant le survol et suspend la lecture en arrière-plan", () => {
    renderHome();
    tick(4000);
    const hero = screen.getByRole("region", {
      name: "Les missions de FASO SANAMA",
    });
    fireEvent.mouseEnter(hero);
    tick(24000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer",
    );
    fireEvent.mouseLeave(hero);
    tick(4000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Préserver l’or",
    );
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    tick(24000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Préserver l’or",
    );
  });
  it("exige une reprise explicite après un choix manuel ou une navigation clavier", () => {
    renderHome();
    const third = screen.getByRole("button", { name: "03 Traçabilité" });
    fireEvent.click(third);
    tick(24000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "De la mine",
    );
    fireEvent.keyDown(third, { key: "ArrowRight" });
    tick(24000);
    expect(
      screen.getByRole("button", { name: "01 Recettes fiscales" }),
    ).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reprendre le défilement" }),
    );
    fireEvent.blur(
      screen.getByRole("button", { name: "01 Recettes fiscales" }),
      { relatedTarget: document.body },
    );
    tick(8000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Préserver l’or",
    );
  });
  it("permet de mettre en pause et de reprendre avec Entrée sur la commande de lecture", () => {
    renderHome();
    const playback = screen.getByRole("button", {
      name: "Mettre le défilement en pause",
    });
    fireEvent.keyDown(playback, { key: "Enter" });
    fireEvent.click(playback);
    expect(playback).toHaveAccessibleName("Reprendre le défilement");
    tick(16000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer",
    );
    fireEvent.keyDown(playback, { key: "Enter" });
    fireEvent.click(playback);
    expect(playback).toHaveAccessibleName("Mettre le défilement en pause");
    tick(8000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Préserver l’or",
    );
  });
  it("commence en pause si les animations sont réduites et suspend la lecture au focus", () => {
    media.matches = true;
    renderHome();
    tick(24000);
    expect(
      screen.getByRole("button", { name: "Reprendre le défilement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reprendre le défilement" }),
    );
    fireEvent.focus(
      screen.getByRole("link", { name: "Découvrir la plateforme" }),
    );
    tick(24000);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Mieux recouvrer",
    );
  });
  it("présente les sept portails sans changement de rôle et avec un aperçu sans données privées", () => {
    renderHome();
    const labels = [
      "Présidence du Faso",
      "Ministère des Mines",
      "Finances & DGI",
      "SONASP",
      "Sociétés minières",
      "Comptoirs d’achat",
      "Collecteurs",
    ];
    expect(screen.getAllByRole("tab")).toHaveLength(7);
    for (const label of labels) {
      const tab = screen.getByRole("tab", { name: label });
      fireEvent.click(tab);
      expect(tab).toHaveAttribute("aria-selected", "true");
      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
      expect(within(panel).getAllByRole("heading", { level: 4 })).toHaveLength(
        3,
      );
      expect(within(panel).getByText("Aperçu illustratif")).toBeInTheDocument();
      expect(within(panel).getByRole("link")).toHaveAttribute("href", "/login");
    }
  });
  it("conserve les règles commerciales et le parcours clavier des portails", () => {
    renderHome();
    const first = screen.getByRole("tab", { name: "Présidence du Faso" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(
      screen.getByRole("tab", { name: "Ministère des Mines" }),
    ).toHaveFocus();
    fireEvent.keyDown(
      screen.getByRole("tab", { name: "Ministère des Mines" }),
      { key: "End" },
    );
    expect(screen.getByRole("tab", { name: "Collecteurs" })).toHaveFocus();
    expect(
      screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Sociétés minières" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "conditions contractuelles acceptées par la société minière",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Comptoirs d’achat" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "cession de leur or à la SONASP",
    );
  });
  it("actualise chacune des huit étapes et ses informations sans lancer de transaction", () => {
    renderHome();
    const titles = [
      "Production",
      "Collecte",
      "Contrôle",
      "Achat & vente",
      "Stockage & lots",
      "Expédition",
      "Raffinage",
      "Fiscalité",
    ];
    const trace = screen.getByRole("region", {
      name: "L’or circule. Son histoire reste.",
    });
    for (const title of titles) {
      const button = within(trace).getByRole("button", {
        name: new RegExp(title.replace("&", "&") + "$"),
      });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(document.getElementById("trace-detail")).toHaveTextContent(title);
      expect(document.querySelectorAll("#trace-detail li")).toHaveLength(3);
    }
    expect(document.getElementById("trace-detail")).toHaveTextContent(
      "Règlements suivis",
    );
  });
});
