import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginInstitutions } from "./LoginInstitutions";

describe("bandeau des institutions", () => {
  const scrollTo = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockReturnValue({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
    );
    HTMLElement.prototype.scrollTo = scrollTo;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("défile automatiquement puis se met en pause au survol et sur demande", () => {
    render(<LoginInstitutions />);
    act(() => vi.advanceTimersByTime(4500));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(screen.getByRole("region"));
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre le défilement en pause" }),
    );
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Reprendre le défilement" }),
    );
    act(() => vi.advanceTimersByTime(4500));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("ouvre la définition au survol, permet de la parcourir et ferme avec Échap", () => {
    render(<LoginInstitutions />);
    const sonasp = screen.getByRole("button", { name: "À propos de SONASP" });
    fireEvent.mouseEnter(sonasp);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Société Nationale des Substances Précieuses",
    );
    expect(sonasp).toHaveAttribute(
      "aria-describedby",
      "login-institution-definition",
    );
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(sonasp, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("ouvre au focus et au toucher, ferme au clic extérieur et ne défile pas pendant la lecture", () => {
    render(<LoginInstitutions />);
    const bumigeb = screen.getByRole("button", { name: "À propos de BUMIGEB" });
    fireEvent.focus(bumigeb);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Service géologique national",
    );
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(bumigeb);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("respecte la réduction des animations tout en conservant la navigation manuelle", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    render(<LoginInstitutions />);
    act(() => vi.advanceTimersByTime(9000));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Mettre le défilement en pause" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Institutions suivantes" }),
    );
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "instant" }),
    );
  });

  it('conserve la définition après le défilement natif provoqué par la tabulation', () => {
    render(<LoginInstitutions />);
    const button = screen.getByRole('button', { name: 'À propos de BUMIGEB' });
    act(() => button.focus());
    fireEvent.scroll(screen.getByRole('list'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Service géologique national');
    expect(button).toHaveFocus();
  });
});
