import { useEffect } from "react";

export const confirmArtisanLeave = () =>
  window.confirm(
    "Des modifications ne sont pas enregistrées. Quitter le formulaire ?",
  );

/** Protects the form within BrowserRouter, including native back/forward navigation. */
export function useArtisanUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        link.target === "_blank" ||
        link.getAttribute("href")?.startsWith("#") ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (!confirmArtisanLeave()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const leave = (event: Event) => {
      if (!confirmArtisanLeave()) event.preventDefault();
    };
    let restoring = false;
    let currentIndex: unknown = window.history.state?.idx;
    const pop = (event: PopStateEvent) => {
      if (restoring) {
        restoring = false;
        event.stopImmediatePropagation();
        return;
      }
      const nextIndex: unknown = event.state?.idx;
      if (
        typeof currentIndex !== "number" ||
        typeof nextIndex !== "number" ||
        !Number.isSafeInteger(currentIndex) ||
        !Number.isSafeInteger(nextIndex) ||
        nextIndex === currentIndex
      )
        return;
      if (confirmArtisanLeave()) {
        currentIndex = nextIndex;
        return;
      }
      restoring = true;
      event.stopImmediatePropagation();
      window.history.go(currentIndex - nextIndex);
    };
    window.addEventListener("beforeunload", unload);
    // Capture runs before BrowserRouter's popstate listener so a cancelled
    // navigation cannot unmount the form while its history position is restored.
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", click, true);
    document.addEventListener("sonasp:artisan-before-leave", leave);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("sonasp:artisan-before-leave", leave);
    };
  }, [dirty]);
}
