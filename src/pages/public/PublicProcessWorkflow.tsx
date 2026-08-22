import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  Check,
  ClipboardPenLine,
  Flag,
  FlaskConical,
  PackageCheck,
  Pause,
  Play,
  ReceiptText,
  Scale,
  Sparkles,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { usePublicLocale } from './PublicLocaleContext';

const workflowIcons: LucideIcon[] = [
  ClipboardPenLine,
  CalendarClock,
  Truck,
  Scale,
  FlaskConical,
  BadgeCheck,
  ReceiptText,
  Banknote,
  PackageCheck,
];

const workflowColors = [
  '#0891a5',
  '#07894c',
  '#c98200',
  '#d95f16',
  '#7040d8',
  '#2563c7',
  '#c72a6c',
  '#0f766e',
  '#9c5a07',
];

const phaseIndexes = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
];

export function PublicProcessWorkflow() {
  const { content, locale } = usePublicLocale();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const steps = content.process.steps;
  const activeStep = steps[activeIndex];
  const nextStep = steps[activeIndex + 1];
  const phases = locale === 'fr'
    ? [
        { label: 'Préparer le flux', description: 'De la déclaration à la prise en charge.' },
        { label: 'Contrôler la matière', description: 'De la réception à la validation.' },
        { label: 'Finaliser l’opération', description: 'Du document financier au marché.' },
      ]
    : [
        { label: 'Prepare the flow', description: 'From declaration to custody.' },
        { label: 'Control the material', description: 'From reception to approval.' },
        { label: 'Complete the operation', description: 'From financial record to market.' },
      ];

  useEffect(() => {
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [paused, steps.length]);

  const setActiveStep = (index: number) => {
    setActiveIndex(index);
    setPaused(true);
  };

  return (
    <section className="public-section public-process" id="processus" aria-labelledby="public-process-title">
      <div className="public-shell">
        <header className="public-process__header">
          <div>
            <span>{content.process.eyebrow}</span>
            <h2 id="public-process-title">{content.process.title}</h2>
          </div>
          <p>
            {content.process.description}{' '}
            {locale === 'fr'
              ? 'Sélectionnez une étape pour comprendre la circulation de l’information.'
              : 'Select a stage to understand how information moves.'}
          </p>
        </header>

        <div className={`public-workflow${paused ? ' public-workflow--paused' : ''}`}>
          <div className="public-workflow__boundaries" aria-label={locale === 'fr' ? 'Bornes du processus' : 'Process boundaries'}>
            <div className="public-workflow__boundary public-workflow__boundary--start">
              <span><Sparkles aria-hidden="true" /></span>
              <div><small>{locale === 'fr' ? 'Début du processus' : 'Process start'}</small><strong>{steps[0].title}</strong></div>
            </div>
            <div className="public-workflow__boundary-line" aria-hidden="true"><ArrowRight /></div>
            <div className="public-workflow__boundary public-workflow__boundary--end">
              <span><Flag aria-hidden="true" /></span>
              <div><small>{locale === 'fr' ? 'Fin du processus' : 'Process end'}</small><strong>{steps[steps.length - 1].title}</strong></div>
            </div>
          </div>

          <button
            className="public-workflow__control"
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused
              ? (locale === 'fr' ? 'Relancer la progression automatique' : 'Resume automatic progression')
              : (locale === 'fr' ? 'Mettre la progression automatique en pause' : 'Pause automatic progression')}
          >
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            <span>{paused ? (locale === 'fr' ? 'Relancer' : 'Resume') : 'Pause'}</span>
          </button>

          <div className="public-workflow__phases">
            {phaseIndexes.map((indexes, phaseIndex) => (
              <div className="public-workflow__phase-wrap" key={phases[phaseIndex].label}>
                <section className="public-workflow__phase" aria-labelledby={`public-workflow-phase-${phaseIndex}`}>
                  <header>
                    <span aria-hidden="true" />
                    <div>
                      <h3 id={`public-workflow-phase-${phaseIndex}`}>{phases[phaseIndex].label}</h3>
                      <p>{phases[phaseIndex].description}</p>
                    </div>
                  </header>
                  <div className="public-workflow__phase-steps">
                    {indexes.map((index) => {
                      const step = steps[index];
                      const Icon = workflowIcons[index] ?? PackageCheck;
                      const isActive = activeIndex === index;
                      const isComplete = activeIndex > index;
                      const nodeStyle = { '--node-accent': workflowColors[index] } as CSSProperties;

                      return (
                        <button
                          type="button"
                          className={`public-workflow__step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                          style={nodeStyle}
                          key={step.title}
                          onMouseEnter={() => setActiveIndex(index)}
                          onFocus={() => setActiveIndex(index)}
                          onClick={() => setActiveStep(index)}
                          aria-pressed={isActive}
                          aria-describedby="public-workflow-active-description"
                        >
                          <span className="public-workflow__step-icon">
                            {isComplete ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
                          </span>
                          <span className="public-workflow__step-copy">
                            <strong>{step.title}</strong>
                            <small>{step.description}</small>
                          </span>
                          <ArrowRight aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </section>
                {phaseIndex < phases.length - 1 && (
                  <span className="public-workflow__phase-arrow" aria-hidden="true"><ArrowRight /></span>
                )}
              </div>
            ))}
          </div>

          <div className="public-workflow__detail" aria-live="polite">
            <div className="public-workflow__detail-brand">
              <img src="/SONASP v2.png" alt="" width="621" height="211" />
              <span>SONASP 360</span>
            </div>
            <div className="public-workflow__detail-copy">
              <small>{locale === 'fr' ? 'Information actuellement suivie' : 'Information currently tracked'}</small>
              <strong>{activeStep.title}</strong>
              <p id="public-workflow-active-description">{activeStep.description}</p>
            </div>
            <div className="public-workflow__next">
              <small>{nextStep ? (locale === 'fr' ? 'Étape suivante' : 'Next stage') : (locale === 'fr' ? 'Parcours finalisé' : 'Flow completed')}</small>
              <strong>{nextStep?.title ?? (locale === 'fr' ? 'Prêt pour le marché' : 'Ready for market')}</strong>
              <div className="public-workflow__progress" aria-hidden="true">
                <span style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
