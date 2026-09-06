import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useArtisanUnsavedChanges } from "./useArtisanUnsavedChanges";

afterEach(() => vi.restoreAllMocks());
describe("protection du brouillon artisan", () => {
  it("annule un retour natif sans laisser le routeur démonter le formulaire", () => {
    window.history.replaceState({ idx: 3 }, "");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const go = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => undefined);
    const routeListener = vi.fn();
    window.addEventListener("popstate", routeListener);
    const { unmount } = renderHook(() => useArtisanUnsavedChanges(true));
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 2 } }));
    expect(go).toHaveBeenCalledWith(1);
    expect(routeListener).not.toHaveBeenCalled();
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 3 } }));
    expect(routeListener).not.toHaveBeenCalled();
    unmount();
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 2 } }));
    expect(routeListener).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", routeListener);
  });
  it("laisse partir après confirmation et ne bloque plus une fiche enregistrée", () => {
    window.history.replaceState({ idx: 3 }, "");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const go = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => undefined);
    const { rerender } = renderHook(
      ({ dirty }) => useArtisanUnsavedChanges(dirty),
      { initialProps: { dirty: true } },
    );
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 2 } }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(go).not.toHaveBeenCalled();
    rerender({ dirty: false });
    document.dispatchEvent(
      new Event("sonasp:artisan-before-leave", { cancelable: true }),
    );
    expect(confirm).toHaveBeenCalledOnce();
  });
});
