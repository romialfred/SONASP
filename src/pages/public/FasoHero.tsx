import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Pause, Play } from "lucide-react";
import content from "./content/hero-content.fr.json";

/** Local editorial carousel: no auth, data requests or focus changes on automatic advance. */
export function FasoHero() {
  const [selected, setSelected] = useState(0);
  const [manualPause, setManualPause] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const selectors = useRef<Array<HTMLButtonElement | null>>([]);
  const running = !manualPause && !hovered && !focused && !hidden;

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => {
      if (media.matches) setManualPause(true);
    };
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsedRef.current += now - previous;
      previous = now;
      if (elapsedRef.current >= content.carousel.intervalMs) {
        elapsedRef.current = 0;
        setSelected((index) => (index + 1) % content.slides.length);
      }
      setElapsed(elapsedRef.current);
    }, 100);
    return () => window.clearInterval(timer);
  }, [running]);

  function select(index: number) {
    setSelected((index + content.slides.length) % content.slides.length);
    setManualPause(true);
    elapsedRef.current = 0;
    setElapsed(0);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % 3
        : event.key === "ArrowLeft"
          ? (index + 2) % 3
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 2
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    selectors.current[next]?.focus();
  }

  return (
    <section
      className="fs-hero"
      aria-label="Les missions de FASO SANAMA"
      aria-roledescription="carrousel"
      onKeyDownCapture={(event) => {
        // Playback controls own their pause state, including native Enter/Space clicks.
        if (!(event.target as HTMLElement).closest(".fs-hero__playback"))
          setManualPause(true);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div
        className="fs-hero__slides public-shell"
        aria-live={manualPause ? "polite" : "off"}
      >
        {content.slides.map((slide, index) => {
          const active = selected === index;
          const Title = active ? "h1" : "div";
          const [first, second] = slide.title.split("\n");
          const imagePath = "/vitrine/ia/" + slide.image.src.split("/").pop();
          return (
            <div
              className={`fs-hero__slide${active ? " is-active" : ""}`}
              key={slide.id}
              aria-hidden={!active}
            >
              <div className="fs-hero__copy">
                <p className="fs-eyebrow">{slide.eyebrow}</p>
                <Title className="fs-hero__title">
                  {first} <span>{second}</span>
                </Title>
                <p className="fs-hero__description">{slide.description}</p>
                {slide.projection ? (
                  <div className="fs-projection">
                    <p>
                      <strong>{slide.projection.display}</strong>
                      <span>{slide.projection.label}</span>
                    </p>
                    <small>{slide.projection.qualification}</small>
                  </div>
                ) : (
                  <div className="fs-hero__benefits">
                    <ul>
                      {slide.benefits?.map((benefit) => (
                        <li key={benefit}>
                          <Check aria-hidden="true" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                    {slide.qualification && (
                      <small>{slide.qualification}</small>
                    )}
                  </div>
                )}
                <a
                  className="fs-button fs-button--gold"
                  href={`/#${slide.cta.targetSection}`}
                  tabIndex={active ? 0 : -1}
                >
                  {slide.cta.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <figure className="fs-hero__visual">
                <picture>
                  <source
                    srcSet={imagePath.replace(".png", ".webp")}
                    type="image/webp"
                  />
                  <img
                    src={imagePath}
                    alt={slide.image.alt}
                    width={slide.image.width}
                    height={slide.image.height}
                    loading={index === 0 ? "eager" : "lazy"}
                    {...{ fetchpriority: index === 0 ? "high" : "low" }}
                    decoding="async"
                  />
                </picture>
                <figcaption>
                  Illustration générée · Les effets numériques sont
                  illustratifs.
                </figcaption>
              </figure>
            </div>
          );
        })}
      </div>
      <div className="public-shell fs-hero__controls">
        <div
          className="fs-hero__selectors"
          role="group"
          aria-label="Choisir une diapositive"
        >
          {content.slides.map((slide, index) => (
            <button
              key={slide.id}
              ref={(node) => {
                selectors.current[index] = node;
              }}
              type="button"
              aria-label={`${String(index + 1).padStart(2, "0")} ${slide.tabLabel}`}
              aria-pressed={index === selected}
              onClick={() => select(index)}
              onKeyDown={(event) => navigate(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {slide.tabLabel}
              <span className="fs-hero__progress" aria-hidden="true">
                <i
                  style={{
                    width:
                      index === selected
                        ? `${(elapsed / content.carousel.intervalMs) * 100}%`
                        : "0%",
                  }}
                />
              </span>
            </button>
          ))}
        </div>
        <div
          className="fs-hero__playback"
          role="group"
          aria-label="Lecture du carrousel"
        >
          <button
            type="button"
            aria-label="Diapositive précédente"
            onClick={() => select(selected - 1)}
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={
              manualPause
                ? "Reprendre le défilement"
                : "Mettre le défilement en pause"
            }
            onClick={() => setManualPause((paused) => !paused)}
          >
            {manualPause ? (
              <Play aria-hidden="true" />
            ) : (
              <Pause aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            aria-label="Diapositive suivante"
            onClick={() => select(selected + 1)}
          >
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
